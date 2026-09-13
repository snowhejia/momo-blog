import { z } from "zod";
const text = (max: number) => z.string().max(max);
const id = z.string().min(1, "请补全内容或先上传所需素材。").max(80);
const mediaId = id.nullable();
const webLink = text(2048).refine(
  (v) =>
    !v ||
    (/^https?:\/\//i.test(v) &&
      (() => {
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      })()),
  "请输入 http 或 https 链接",
);
export const projectSchema = z.object({
  id,
  title: text(100),
  summary: text(240),
  description: text(20000),
  coverId: mediaId,
  url: webLink,
});
export const articleSchema = z.object({
  id,
  title: text(160),
  summary: text(300),
  body: text(50000),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期")
    .refine(
      (v) =>
        Number.isFinite(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
      "请选择有效日期",
    ),
  coverId: mediaId,
  url: webLink,
});
export const photoSchema = z.object({
  id,
  mediaId: id,
  title: text(160),
  caption: text(2000),
  location: text(160),
  source: text(2000),
  demo: z.boolean(),
});
export const collectionSchema = z.object({
  id,
  title: text(160),
  description: text(2000),
  kind: z.enum(["图片", "网站", "灵感"]),
  imageId: mediaId,
  url: webLink,
  source: text(2000),
  demo: z.boolean(),
});
export const trackSchema = z.object({
  id,
  title: text(160),
  artist: text(160),
  audioId: id,
  coverId: mediaId,
  demo: z.boolean(),
  source: text(2000),
});
export const contentSchema = z
  .object({
    profile: z.object({
      name: text(40),
      avatarId: mediaId.default(null),
      headline: text(160),
      introduction: text(300),
      description: text(300),
      eyebrow: text(100),
      motto: text(150),
      photoId: text(80),
      photoCaption: text(160),
      demo: z.boolean(),
    }),
    social: z.object({
      github: webLink,
      xiaohongshu: webLink.default(""),
      email: text(254).refine(
        (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        "请输入有效邮箱",
      ),
    }),
    projects: z.array(projectSchema).max(100),
    articles: z.array(articleSchema).max(100),
    photos: z.array(photoSchema).max(200),
    collections: z.array(collectionSchema).max(200),
    tracks: z.array(trackSchema).max(100),
  })
  .superRefine((c, ctx) => {
    for (const key of [
      "projects",
      "articles",
      "photos",
      "collections",
      "tracks",
    ] as const) {
      const ids = c[key].map((v) => v.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "内容标识不能重复",
        });
    }
  });
export type HomeContent = z.infer<typeof contentSchema>;
export const messageSchema = z.object({
  submissionId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, "请留下你的称呼。")
    .max(60, "称呼请控制在 60 字以内。"),
  email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "请输入有效邮箱，或留空。",
    ),
  body: z
    .string()
    .trim()
    .min(1, "先写下一点想说的话吧。")
    .max(2000, "留言请控制在 2000 字以内。"),
  website: z.string().max(0, "暂时无法提交，请重试。").default(""),
});
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  body: string;
  createdAt: string;
  read: boolean;
}
export interface MessageInbox {
  messages: ContactMessage[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}
export type Project = z.infer<typeof projectSchema>;
export type Article = z.infer<typeof articleSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type Track = z.infer<typeof trackSchema>;
export interface HomeResponse {
  revision: number;
  content: HomeContent;
}
export interface Stats {
  todayVisitors: number;
  totalViews: number;
  daysOnline: number;
  checkedIn: boolean;
  checkins: number;
  likeCount: number;
  liked: boolean;
}
export interface AuthStatus {
  initialized: boolean;
  authenticated: boolean;
  email?: string;
}
export interface VisitorState {
  auth: AuthStatus;
  stats: Stats;
}
export interface Media {
  id: string;
  kind: "image" | "audio";
  url: string;
  duration?: number;
}
export interface Weather {
  available: boolean;
  temperature?: number;
  code?: number;
  updatedAt?: string;
  stale?: boolean;
}
export const mediaUrl = (id: string | null | undefined, thumb = false) =>
  id ? `/api/media/${encodeURIComponent(id)}${thumb ? "?size=thumb" : ""}` : "";
export function referencedMedia(
  c: HomeContent,
): Map<string, "image" | "audio"> {
  const refs = new Map<string, "image" | "audio">();
  const add = (id: string | null, kind: "image" | "audio" = "image") => {
    if (id) {
      if (refs.has(id) && refs.get(id) !== kind)
        throw new Error("同一素材不能同时用于图片和音频");
      refs.set(id, kind);
    }
  };
  add(c.profile.avatarId);
  c.photos.forEach((p) => add(p.mediaId));
  c.projects.forEach((p) => add(p.coverId));
  c.articles.forEach((p) => add(p.coverId));
  c.collections.forEach((p) => add(p.imageId));
  c.tracks.forEach((p) => {
    add(p.audioId, "audio");
    add(p.coverId);
  });
  return refs;
}
export function sydneyDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
