import type { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { importAudio, importImage } from "./media.js";
import { contentSchema, type HomeContent } from "../shared/model.js";
export async function seed(
  db: DatabaseSync,
  uploads: string,
  assetDir: string,
) {
  if (db.prepare("SELECT id FROM site_content WHERE id=1").get()) return;
  const sources = JSON.parse(
    readFileSync(join(assetDir, "photos.json"), "utf8"),
  ) as { file: string; url: string }[];
  const photoFiles = ["coffee.jpg", "forest.jpg", "coast.jpg", "sunlight.jpg"];
  const ids: string[] = [];
  for (const name of photoFiles)
    ids.push(await importImage(db, uploads, join(assetDir, name)));
  const hero = existsSync(join(assetDir, "sydney.png"))
    ? await importImage(db, uploads, join(assetDir, "sydney.png"))
    : ids[2];
  const poster = existsSync(join(assetDir, "poster.png"))
    ? await importImage(db, uploads, join(assetDir, "poster.png"))
    : ids[1];
  const architecture = existsSync(join(assetDir, "architecture.png"))
    ? await importImage(db, uploads, join(assetDir, "architecture.png"))
    : ids[3];
  const audio = await importAudio(
    db,
    uploads,
    join(assetDir, "slow-morning.wav"),
  );
  const avatarFile = join(assetDir, "../profile/avatar-demo.webp");
  const avatarId = existsSync(avatarFile)
    ? await importImage(db, uploads, avatarFile)
    : null;
  const c: HomeContent = {
    profile: {
      name: "Momo",
      avatarId,
      headline: "把好奇心，\n变成作品。",
      introduction: "我是 Momo，喜欢设计、代码和日常里的小发现。",
      description: "这里是我的作品、文字与日常收藏。",
      eyebrow: "DESIGN · CODE · EVERYDAY",
      motto: "Made with curiosity.",
      photoId: "sydney",
      photoCaption: "走走，停停。",
      demo: true,
    },
    social: {
      github: "",
      email: "",
      xiaohongshu: "",
    },
    projects: [
      {
        id: "sample-project",
        title: "Idea Garden",
        summary: "给每一个想法，一个生长的地方。",
        description:
          "这是一个用于展示的虚构笔记应用：把随手记下的想法、喜欢的图片和生活碎片，整理成自己的数字花园。\n\n登录后可以替换项目名称、封面、介绍和链接。",
        coverId: null,
        url: "",
      },
    ],
    articles: [
      {
        id: "start",
        title: "从一个小想法开始",
        summary: "关于创造，也关于生活。",
        date: "2026-09-12",
        coverId: ids[0],
        url: "",
        body: "我喜欢那些还很小的想法。它们可能是散步时冒出来的一句话，也可能是觉得「这里还可以更好一点」的瞬间。\n\n先记录下来，再做一个能用的小版本。把下一步缩小到今天就能开始的程度，想法才会慢慢长成生活的一部分。\n\n这是一段用于展示阅读效果的示例文字，可登录后直接替换。",
      },
      {
        id: "garden",
        title: "我的数字花园，慢慢长大",
        summary: "给想法一个可以停留的地方。",
        date: "2026-09-08",
        coverId: ids[1],
        url: "",
        body: "把喜欢的图片、读到的句子，以及还没想明白的事放在一起，是整理日常的一种方式。\n\n花园不必每一天都盛开。记下一点，整理一点，留下以后再回来的入口。\n\n此为可替换的示例文字。",
      },
      {
        id: "sydney",
        title: "在悉尼，收集日常的光",
        summary: "生活碎片，慢慢收藏。",
        date: "2026-09-02",
        coverId: ids[2],
        url: "",
        body: "有时候，一天最值得记住的部分，只是树叶间的一点光，或走过海边时刚好吹来的风。\n\n想把这些微小又明亮的片刻收藏起来。等忙碌的时候，回来看看。\n\n此为可替换的示例文字。",
      },
    ],
    photos: [
      {
        id: "sydney",
        mediaId: hero,
        title: "走走，停停。",
        caption: "在光影之间，留住片刻。",
        location: "Sydney",
        source:
          hero === ids[2]
            ? "Unsplash 演示照片，详见素材来源"
            : "AI 生成的悉尼示意图，非站主实拍",
        demo: true,
      },
      ...ids.map((mediaId, i) => ({
        id: `photo-${i}`,
        mediaId,
        title: ["午后一杯", "走进绿色里", "海风来信", "日光漫游"][i],
        caption: "喜欢的小片刻。",
        location: "",
        source: `Unsplash · ${sources.find((p) => p.file === photoFiles[i])?.url || "https://unsplash.com/license"}`,
        demo: true,
      })),
    ],
    collections: [
      {
        id: "design",
        title: "让想法长成设计",
        description: "一些值得留下的灵感。",
        kind: "灵感",
        imageId: poster,
        url: "",
        source: "本站原创排版示例",
        demo: true,
      },
      {
        id: "architecture",
        title: "在留白里，发现更多",
        description: "观察空间、比例与留白。",
        kind: "图片",
        imageId: architecture,
        url: "",
        source: "演示素材，非站主作品",
        demo: true,
      },
      {
        id: "mdn",
        title: "MDN Web Docs",
        description: "把好奇心，变成可以实现的东西。",
        kind: "网站",
        imageId: null,
        url: "https://developer.mozilla.org/zh-CN/",
        source: "MDN",
        demo: true,
      },
    ],
    tracks: [
      {
        id: "slow-morning",
        title: "Slow Morning",
        artist: "本站原创 · 演示旋律",
        audioId: audio,
        coverId: ids[2],
        demo: true,
        source: "assets/demo/generate-audio.py，原创合成器旋律",
      },
    ],
  };
  contentSchema.parse(c);
  db.prepare("INSERT INTO site_content(id,revision,data) VALUES(1,1,?)").run(
    JSON.stringify(c),
  );
}
