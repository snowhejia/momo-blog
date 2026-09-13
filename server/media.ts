import { randomUUID } from "node:crypto";
import { mkdir, unlink, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { fileTypeFromFile } from "file-type";
import { parseFile } from "music-metadata";
import { createRequire } from "node:module";
const ffmpeg =
  process.env.FFMPEG_BIN ||
  (createRequire(import.meta.url)("ffmpeg-static") as string | null);
import type { DatabaseSync } from "node:sqlite";
const exec = promisify(execFile);
type Pictures = Awaited<ReturnType<typeof parseFile>>["common"]["picture"];

async function writeAudioCover(
  uploads: string,
  id: string,
  pictures: Pictures,
) {
  const filename = `${id}-cover.webp`;
  const target = join(uploads, filename);
  // Prefer the front cover, but try another embedded picture if it is invalid.
  const ordered = [...(pictures || [])].sort(
    (a, b) =>
      Number(b.type === "Cover (front)") - Number(a.type === "Cover (front)"),
  );
  for (const picture of ordered) {
    if (!picture.data.length || picture.data.length > 10 * 1024 * 1024)
      continue;
    try {
      const image = sharp(Buffer.from(picture.data), {
        limitInputPixels: 40_000_000,
        failOn: "error",
      });
      const meta = await image.metadata();
      if (
        !meta.format ||
        !["jpeg", "png", "webp"].includes(meta.format) ||
        (meta.pages || 1) > 1
      )
        continue;
      await image
        .rotate()
        .resize({
          width: 800,
          height: 800,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 88 })
        .toFile(target);
      return filename;
    } catch {
      await removeFiles([target]);
    }
  }
  return "";
}

export function createAudioCoverReader(db: DatabaseSync, uploads: string) {
  const pending = new Map<string, Promise<string>>();
  return (id: string): Promise<string> => {
    const row = db
      .prepare("SELECT kind,filename,thumb FROM media WHERE id=?")
      .get(id);
    if (!row || row.kind !== "audio") return Promise.resolve("");
    // NULL means an older upload has not been checked; empty means no usable cover.
    if (row.thumb !== null) return Promise.resolve(String(row.thumb));
    const existing = pending.get(id);
    if (existing) return existing;
    const job = (async () => {
      let pictures: Pictures;
      try {
        pictures = (await parseFile(join(uploads, String(row.filename)))).common
          .picture;
      } catch {
        return "";
      }
      const cover = await writeAudioCover(uploads, id, pictures);
      db.prepare("UPDATE media SET thumb=? WHERE id=?").run(cover, id);
      return cover;
    })().finally(() => pending.delete(id));
    pending.set(id, job);
    return job;
  };
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function removeFiles(paths: string[]) {
  await Promise.all(paths.map((p) => unlink(p).catch(() => {})));
}
export async function importImage(
  db: DatabaseSync,
  uploads: string,
  path: string,
) {
  const format = await fileTypeFromFile(path);
  if (
    !format ||
    !["image/jpeg", "image/png", "image/webp"].includes(format.mime)
  )
    throw new HttpError(400, "照片仅支持 JPEG、PNG 或 WebP，请选择有效图片。");
  const id = randomUUID();
  const filename = `${id}.webp`,
    thumb = `${id}-thumb.webp`;
  await mkdir(uploads, { recursive: true });
  try {
    const pipeline = sharp(path, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    });
    const meta = await pipeline.metadata();
    if ((meta.pages || 1) > 1)
      throw new HttpError(400, "暂不支持动画图片，请上传静态照片。");
    const result = await pipeline
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toFile(join(uploads, filename));
    await sharp(join(uploads, filename))
      .resize({
        width: 600,
        height: 600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(join(uploads, thumb));
    db.prepare(
      "INSERT INTO media(id,kind,filename,thumb,mime,width,height) VALUES(?,?,?,?,?,?,?)",
    ).run(
      id,
      "image",
      filename,
      thumb,
      "image/webp",
      result.width,
      result.height,
    );
    return id;
  } catch (error) {
    await removeFiles([join(uploads, filename), join(uploads, thumb)]);
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "图片无法解码或尺寸过大，请更换文件。");
  }
}
export async function importAudio(
  db: DatabaseSync,
  uploads: string,
  path: string,
) {
  const type = await fileTypeFromFile(path);
  if (
    !type ||
    ![
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
      "video/mp4",
    ].includes(type.mime)
  )
    throw new HttpError(400, "音乐仅支持有效的 MP3、M4A 或 WAV 文件。");
  let duration: number;
  let pictures: Pictures;
  try {
    const metadata = await parseFile(path);
    pictures = metadata.common.picture;
    duration = metadata.format.duration || 0;
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 1800 ||
      !metadata.format.numberOfChannels ||
      metadata.format.hasVideo
    )
      throw new Error("invalid duration");
    if (!ffmpeg) throw new Error("decoder unavailable");
    await exec(
      ffmpeg,
      [
        "-nostdin",
        "-v",
        "error",
        "-xerror",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        path,
        "-map",
        "0:a:0",
        "-f",
        "null",
        "-",
      ],
      { timeout: 60_000, maxBuffer: 1_048_576 },
    );
  } catch {
    throw new HttpError(400, "音频无法完整解码或超过 30 分钟，请更换文件。");
  }
  const id = randomUUID();
  const ext =
    type.mime.includes("mp4") || type.mime.includes("m4a")
      ? "m4a"
      : type.mime.includes("wav")
        ? "wav"
        : "mp3";
  const filename = `${id}.${ext}`;
  await mkdir(uploads, { recursive: true });
  try {
    await copyFile(path, join(uploads, filename));
    const cover = await writeAudioCover(uploads, id, pictures);
    db.prepare(
      "INSERT INTO media(id,kind,filename,mime,duration,thumb) VALUES(?,?,?,?,?,?)",
    ).run(
      id,
      "audio",
      filename,
      ext === "m4a" ? "audio/mp4" : ext === "wav" ? "audio/wav" : "audio/mpeg",
      duration,
      cover,
    );
    return id;
  } catch (error) {
    await removeFiles([
      join(uploads, filename),
      join(uploads, `${id}-cover.webp`),
    ]);
    throw error;
  }
}
