import { z } from "zod";
import type { Article } from "./model.js";

const daySchema = z.iso.date();
const timestampSchema = z.iso.datetime();
export const articleDateSchema = z
  .string()
  .refine(
    (value) =>
      daySchema.safeParse(value).success ||
      timestampSchema.safeParse(value).success,
    "请填写有效的文章发布日期和时间",
  );

export function articleExcerpt(article: Pick<Article, "summary" | "body">) {
  const text = (article.summary.trim() || article.body.trim()).replace(
    /\s+/g,
    " ",
  );
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

export function articleDateParts(value: string, timeZone: string) {
  if (!timestampSchema.safeParse(value).success) {
    const [day = "", time = ""] = value.split("T");
    return { day, time };
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;
  return {
    day: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}:${part("second")}`,
  };
}

export function formatArticleDate(value: string, timeZone: string) {
  if (!articleDateSchema.safeParse(value).success) return "发布时间待完善";
  const { day, time } = articleDateParts(value, timeZone);
  return time ? `${day} ${time}` : day;
}

// Resolve a wall-clock time in the site's zone, independently of the editor's
// own device zone. Check both sides of DST transitions and reject skipped times.
export function articleDateFromLocal(
  local: string,
  timeZone: string,
  previous?: string,
) {
  const normalized = local.length === 16 ? `${local}:00` : local;
  if (!timestampSchema.safeParse(`${normalized}Z`).success) return null;
  const matches = (value: string) => {
    const { day, time } = articleDateParts(value, timeZone);
    return `${day}T${time}` === normalized;
  };
  if (
    previous &&
    timestampSchema.safeParse(previous).success &&
    matches(previous)
  )
    return previous;
  const wallTime = Date.parse(`${normalized}Z`);
  const candidates = new Set<number>();
  for (const hours of [-48, -24, 0, 24, 48]) {
    const sample = wallTime + hours * 3_600_000;
    const { day, time } = articleDateParts(
      new Date(sample).toISOString(),
      timeZone,
    );
    const offset = Date.parse(`${day}T${time}Z`) - sample;
    const candidate = wallTime - offset;
    if (matches(new Date(candidate).toISOString())) candidates.add(candidate);
  }
  return candidates.size
    ? new Date(Math.min(...candidates)).toISOString()
    : null;
}
