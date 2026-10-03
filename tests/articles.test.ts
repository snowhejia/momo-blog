import test from "node:test";
import assert from "node:assert/strict";
import { articleSchema } from "../shared/model";
import {
  articleDateFromLocal,
  articleExcerpt,
  formatArticleDate,
} from "../shared/articles";

test("纯文字可无封面和标题，兼容旧日期并校验新时间戳", () => {
  const article = {
    id: "note",
    title: "",
    summary: "",
    body: "只写一点日常。",
    coverId: null,
    url: "",
    date: "2026-10-03T11:24:36.123Z",
  };
  assert.deepEqual(articleSchema.parse(article), article);
  assert.equal(
    articleSchema.parse({ ...article, date: "2026-09-12" }).date,
    "2026-09-12",
  );
  for (const date of [
    "",
    "2026-02-30",
    "2026-02-30T10:00:00Z",
    "2026-10-03T25:00:00Z",
    "2026-10-03T10:00:00",
    "bad-date",
  ])
    assert.equal(
      articleSchema.safeParse({ ...article, date }).success,
      false,
      date,
    );
});

test("文章显示所选时区的完整时间，旧日期不添加虚构时间", () => {
  assert.equal(
    formatArticleDate("2026-10-03T23:24:36Z", "Asia/Shanghai"),
    "2026-10-04 07:24:36",
  );
  assert.equal(
    formatArticleDate("2026-10-03T23:24:36Z", "Pacific/Honolulu"),
    "2026-10-03 13:24:36",
  );
  assert.equal(
    formatArticleDate("2026-09-12", "Pacific/Honolulu"),
    "2026-09-12",
  );
  assert.equal(formatArticleDate("", "Asia/Shanghai"), "发布时间待完善");
});

test("编辑时间使用网站时区，支持跨日与非整小时时区", () => {
  assert.equal(
    articleDateFromLocal("2026-10-03T07:24:36", "Asia/Shanghai"),
    "2026-10-02T23:24:36.000Z",
  );
  assert.equal(
    articleDateFromLocal("2026-10-03T07:24", "Asia/Kathmandu"),
    "2026-10-03T01:39:00.000Z",
  );
  assert.equal(
    articleDateFromLocal("2026-02-30T07:24:36", "Asia/Shanghai"),
    null,
  );
  assert.equal(articleDateFromLocal("T07:24:36", "Asia/Shanghai"), null);
});

test("文章编辑拒绝夏令时跳过的时刻，重复时段保留原来的实际时刻", () => {
  assert.equal(
    articleDateFromLocal("2026-10-04T02:30:00", "Australia/Sydney"),
    null,
  );
  assert.equal(
    articleDateFromLocal("2026-10-04T03:30:00", "Australia/Sydney"),
    "2026-10-03T16:30:00.000Z",
  );
  assert.equal(
    articleDateFromLocal("2026-04-05T02:30:00", "Australia/Sydney"),
    "2026-04-04T15:30:00.000Z",
  );
  assert.equal(
    articleDateFromLocal(
      "2026-04-05T02:30:00",
      "Australia/Sydney",
      "2026-04-04T16:30:00.000Z",
    ),
    "2026-04-04T16:30:00.000Z",
  );
});

test("列表优先摘要，摘要空白时取正文并合并换行", () => {
  assert.equal(
    articleExcerpt({ summary: "  自己写的摘要。  ", body: "正文" }),
    "自己写的摘要。",
  );
  assert.equal(
    articleExcerpt({ summary: " \n", body: "第一行。\n\n第二行。" }),
    "第一行。 第二行。",
  );
  assert.equal(articleExcerpt({ summary: "", body: "" }), "");
  assert.equal(
    articleExcerpt({ summary: "", body: "文".repeat(301) }),
    "文".repeat(300) + "…",
  );
});
