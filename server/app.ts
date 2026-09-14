import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { SiteAuth } from "./auth.js";
import {
  contentSchema,
  referencedMedia,
  sydneyDay,
  type Stats,
  type Weather,
} from "../shared/model.js";
import {
  HttpError,
  importAudio,
  importImage,
  createAudioCoverReader,
} from "./media.js";
import { readHome } from "./db.js";
import { createWeatherService } from "./weather.js";
import { mountMessages } from "./messages.js";
export interface AppOptions {
  auth: SiteAuth;
  uploads: string;
  secret: string;
  trustProxy?: number | false;
  staticDir?: string;
  secure?: boolean;
  now?: () => Date;
  weather?: () => Promise<Weather>;
}
export function createApp(db: DatabaseSync, o: AppOptions) {
  const app = express();
  if (o.trustProxy !== undefined) app.set("trust proxy", o.trustProxy);
  const now = o.now || (() => new Date());
  const weather = o.weather || createWeatherService();
  const audioCover = createAudioCoverReader(db, o.uploads);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use(
    "/api",
    (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
    o.auth.originGuard,
  );
  o.auth.mount(app);
  const signed = (id: string) =>
    `${id}.${createHmac("sha256", o.secret).update(id).digest("hex")}`;
  const getVisitor = (req: express.Request, res: express.Response) => {
    const raw = req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("hejia-home-visitor="))
      ?.slice(19);
    let visitor = "";
    if (raw && /^[\da-f-]{36}\.[\da-f]{64}$/.test(raw)) {
      const expected = signed(raw.slice(0, 36));
      if (
        Buffer.byteLength(raw) === Buffer.byteLength(expected) &&
        timingSafeEqual(Buffer.from(raw), Buffer.from(expected)) &&
        db.prepare("SELECT id FROM visitors WHERE id=?").get(raw.slice(0, 36))
      )
        visitor = raw.slice(0, 36);
    }
    if (!visitor) {
      visitor = randomUUID();
      db.prepare("INSERT INTO visitors(id) VALUES(?)").run(visitor);
      res.cookie("hejia-home-visitor", signed(visitor), {
        httpOnly: true,
        sameSite: "lax",
        secure: o.secure ?? false,
        path: "/api",
        maxAge: 365 * 86400000,
      });
    }
    return visitor;
  };
  const stats = (visitor: string): Stats => {
    const day = sydneyDay(now());
    const started = String(
      db.prepare("SELECT value FROM settings WHERE key='startedAt'").get()!
        .value,
    );
    return {
      todayVisitors: Number(
        db
          .prepare(
            "SELECT COUNT(DISTINCT visitor_id) n FROM visits WHERE day=?",
          )
          .get(day)!.n,
      ),
      totalViews: Number(db.prepare("SELECT COUNT(*) n FROM visits").get()!.n),
      daysOnline: Math.max(
        1,
        Math.floor(
          (Date.parse(day) - Date.parse(sydneyDay(new Date(started)))) /
            86400000,
        ) + 1,
      ),
      checkedIn: !!db
        .prepare("SELECT 1 FROM checkins WHERE visitor_id=? AND day=?")
        .get(visitor, day),
      checkins: Number(
        db
          .prepare("SELECT COUNT(*) n FROM checkins WHERE visitor_id=?")
          .get(visitor)!.n,
      ),
      likeCount: Number(db.prepare("SELECT COUNT(*) n FROM likes").get()!.n),
      liked: !!db
        .prepare("SELECT 1 FROM likes WHERE visitor_id=?")
        .get(visitor),
    };
  };
  app.get("/api/home", (_req, res) => {
    const home = readHome(db);
    // The revision changes with every publish, so browsers can cheaply
    // revalidate public content without serving an outdated edit.
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("ETag", `"home-${home.revision}"`);
    res.json(home);
  });
  app.put("/api/home", o.auth.requireAdmin, (req, res) => {
    const input = z
      .object({ revision: z.number().int().positive(), content: contentSchema })
      .safeParse(req.body);
    if (!input.success)
      throw new HttpError(
        400,
        input.error.issues[0]?.message || "请检查内容格式。",
      );
    let refs: Map<string, "image" | "audio">;
    try {
      refs = referencedMedia(input.data.content);
    } catch {
      throw new HttpError(400, "素材类型不匹配。");
    }
    for (const [id, kind] of refs) {
      const m = db.prepare("SELECT kind FROM media WHERE id=?").get(id);
      if (!m || m.kind !== kind)
        throw new HttpError(400, "部分素材已不存在或类型不正确，请重新选择。");
    }
    const result = db
      .prepare(
        "UPDATE site_content SET data=?,revision=revision+1 WHERE id=1 AND revision=?",
      )
      .run(JSON.stringify(input.data.content), input.data.revision);
    if (!result.changes)
      throw new HttpError(
        409,
        "另一个窗口已更新首页。你的草稿仍在，请先取消编辑并重新载入，再重新应用修改。",
      );
    res.json(readHome(db));
  });
  app.get("/api/state", async (req, res) => {
    const visitor = getVisitor(req, res),
      session = await o.auth.session(req);
    res.json({
      auth: {
        initialized: o.auth.initialized(),
        authenticated: !!session,
        ...(session ? { email: session.user.email } : {}),
      },
      stats: stats(visitor),
    });
  });
  app.get("/api/stats", (req, res) => res.json(stats(getVisitor(req, res))));
  const limiter = rateLimit({
    windowMs: 60000,
    limit: 90,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "操作有点频繁，请稍后重试。" },
  });
  app.post("/api/visits", limiter, async (req, res) => {
    const visitor = getVisitor(req, res);
    const p = z.object({ pageViewId: z.uuid() }).safeParse(req.body);
    if (!p.success) throw new HttpError(400, "访问标识无效。");
    if (!(await o.auth.session(req)))
      db.prepare(
        "INSERT OR IGNORE INTO visits(id,visitor_id,day) VALUES(?,?,?)",
      ).run(p.data.pageViewId, visitor, sydneyDay(now()));
    res.json(stats(visitor));
  });
  app.post("/api/checkin", limiter, (req, res) => {
    const visitor = getVisitor(req, res);
    db.prepare(
      "INSERT OR IGNORE INTO checkins(visitor_id,day) VALUES(?,?)",
    ).run(visitor, sydneyDay(now()));
    res.json(stats(visitor));
  });
  app.post("/api/likes", limiter, (req, res) => {
    const visitor = getVisitor(req, res);
    const body = z.object({ liked: z.boolean() }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "点赞状态无效。");
    if (body.data.liked)
      db.prepare("INSERT OR IGNORE INTO likes(visitor_id) VALUES(?)").run(
        visitor,
      );
    else db.prepare("DELETE FROM likes WHERE visitor_id=?").run(visitor);
    res.json(stats(visitor));
  });
  app.get("/api/weather", async (_req, res) => res.json(await weather()));
  mountMessages(app, db, o.auth, getVisitor, now);
  const incoming = join(o.uploads, "incoming");
  mkdirSync(incoming, { recursive: true });
  const upload = multer({
    dest: incoming,
    limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 2 },
  });
  app.post(
    "/api/media",
    o.auth.requireAdmin,
    upload.single("file"),
    async (req, res) => {
      if (!req.file) throw new HttpError(400, "请选择文件。");
      try {
        const kind = req.query.kind;
        if (!["image", "audio"].includes(String(kind)))
          throw new HttpError(400, "请选择图片或音乐素材。");
        if (kind === "image" && req.file.size > 20 * 1024 * 1024)
          throw new HttpError(400, "图片不能超过 20 MB。");
        const id =
          kind === "audio"
            ? await importAudio(db, o.uploads, req.file.path)
            : await importImage(db, o.uploads, req.file.path);
        const row = db
          .prepare("SELECT duration FROM media WHERE id=?")
          .get(id)!;
        res.status(201).json({
          id,
          kind,
          url: `/api/media/${id}`,
          ...(row.duration ? { duration: Number(row.duration) } : {}),
        });
      } finally {
        await unlink(req.file.path).catch(() => {});
      }
    },
  );
  app.get("/api/media/:id", async (req, res) => {
    const row = db.prepare("SELECT * FROM media WHERE id=?").get(req.params.id);
    if (!row) throw new HttpError(404, "素材不存在。");
    const publicMedia = referencedMedia(readHome(db).content);
    const isPublic = publicMedia.has(String(req.params.id));
    if (!isPublic && !(await o.auth.session(req)))
      throw new HttpError(404, "素材不存在。");
    const thumb =
      req.query.size === "thumb" &&
      (row.kind === "audio" ? await audioCover(String(row.id)) : row.thumb);
    if (req.query.size === "thumb" && row.kind === "audio" && !thumb)
      throw new HttpError(404, "这首音乐没有内嵌封面。");
    res.setHeader("Content-Type", String(thumb ? "image/webp" : row.mime));
    // Published media uses immutable UUID URLs. Draft-only uploads stay private.
    res.setHeader(
      "Cache-Control",
      isPublic
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
    );
    res.sendFile(resolve(o.uploads, String(thumb || row.filename)));
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "接口不存在。" }),
  );
  if (o.staticDir) {
    // Vite fingerprints files under /assets, so they are safe to cache forever.
    app.use(
      "/assets",
      express.static(join(o.staticDir, "assets"), {
        immutable: true,
        maxAge: "1y",
      }),
    );
    app.use(express.static(o.staticDir, { index: false, maxAge: 0 }));
    app.get(
      ["/", "/login", "/projects", "/articles", "/photos", "/collections"],
      (_req, res) =>
        res.sendFile(join(o.staticDir!, "index.html"), {
          headers: { "Cache-Control": "no-cache" },
        }),
    );
  }
  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      if (error instanceof multer.MulterError) {
        res.status(400).json({
          error: "文件过大或上传无效，请使用 20 MB 以内图片或 50 MB 以内音频。",
        });
        return;
      }
      if ((error as { type?: string }).type === "entity.too.large") {
        res.status(413).json({ error: "内容过大，请缩短正文。" });
        return;
      }
      if ((error as { type?: string }).type === "entity.parse.failed") {
        res.status(400).json({ error: "内容格式无效。" });
        return;
      }
      console.error(error.message);
      res.status(500).json({ error: "暂时无法完成，请稍后重试。" });
    },
  );
  return app;
}
