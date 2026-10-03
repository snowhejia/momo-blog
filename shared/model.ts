import { z } from "zod";
import { articleDateSchema } from "./articles.js";
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
  date: articleDateSchema,
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
export const friendSchema = z.object({
  id,
  title: text(80).trim().min(1, "请填写友链的网站名称"),
  description: text(300),
  url: z.string().trim().min(1, "请填写友链的网站链接").pipe(webLink),
  avatarId: mediaId,
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
export const timeZoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "请选择有效时区");
export const weatherLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timeZone: timeZoneSchema,
});
export const locationSchema = weatherLocationSchema.extend({
  name: z.string().trim().min(1, "请填写地点名称").max(80),
  region: z.string().trim().max(40),
});
export type SiteLocation = z.infer<typeof locationSchema>;
export type WeatherLocation = z.infer<typeof weatherLocationSchema>;
export interface LocationResult extends SiteLocation {
  country: string;
  area: string;
}
export const DEFAULT_LOCATION: SiteLocation = {
  name: "Sydney",
  region: "AU",
  timeZone: "Australia/Sydney",
  latitude: -33.8688,
  longitude: 151.2093,
};
export const weatherLocationKey = (location: WeatherLocation) =>
  `${location.latitude},${location.longitude},${location.timeZone}`;
export const DEFAULT_ABOUT_BODY =
  "这是我的个人空间。把作品、文字和日常放在一起，也为下一次突如其来的灵感，留一个位置。";
export const siteThemeSchema = z.enum(["fresh", "blush", "midnight"]);
export type SiteTheme = z.infer<typeof siteThemeSchema>;
export const contentSchema = z
  .object({
    theme: siteThemeSchema.default("fresh"),
    location: locationSchema.default(() => ({ ...DEFAULT_LOCATION })),
    profile: z.object({
      name: text(40),
      avatarId: mediaId.default(null),
      headline: text(160),
      introduction: text(300),
      description: text(300),
      aboutBody: text(5000).default(DEFAULT_ABOUT_BODY),
      eyebrow: text(100),
      motto: text(150),
    }),
    social: z.object({
      github: webLink,
      xiaohongshu: webLink.default(""),
      bilibili: webLink.default(""),
      email: text(254).refine(
        (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        "请输入有效邮箱",
      ),
    }),
    projects: z.array(projectSchema).max(100),
    articles: z.array(articleSchema).max(100),
    photos: z.array(photoSchema).max(200),
    collections: z.array(collectionSchema).max(200),
    friends: z.array(friendSchema).max(100).default([]),
    tracks: z.array(trackSchema).max(100),
  })
  .superRefine((c, ctx) => {
    for (const key of [
      "projects",
      "articles",
      "photos",
      "collections",
      "friends",
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
export type Friend = z.infer<typeof friendSchema>;
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
  c.friends.forEach((p) => add(p.avatarId));
  c.tracks.forEach((p) => {
    add(p.audioId, "audio");
    add(p.coverId);
  });
  return refs;
}
export function zonedDay(date: Date, timeZone = DEFAULT_LOCATION.timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
