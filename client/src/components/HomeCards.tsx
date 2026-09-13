import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Sun,
  Cloud,
  CloudRain,
  Sprout,
  Search,
  Plus,
  Home,
  FileText,
  Tags,
  Trash2,
  Check,
} from "lucide-react";
import { useSite } from "../store";
import { mediaUrl, sydneyDay, type Weather } from "../../../shared/model";
import { request } from "../api";
import {
  Cat,
  Editable,
  EditButton,
  SafeImage,
  ArrowLink,
  Empty,
} from "./Common";
import type { EditorSection } from "./Editor";
export type Panel =
  | "projects"
  | "articles"
  | "photos"
  | "collections"
  | "about"
  | "contact"
  | "sources";
export interface CardActions {
  open: (panel: Panel, id?: string) => void;
  edit: (section: EditorSection) => void;
}
export function Hero({ open, edit }: CardActions) {
  const { editing, content } = useSite();
  const avatarId = content?.profile.avatarId;
  return (
    <section className={`card hero-card ${avatarId ? "has-avatar" : ""}`}>
      <div className="hero-top">
        <Editable field="eyebrow" as="span" className="eyebrow" />
        <EditButton label="编辑个人资料" onClick={() => edit("profile")} />
      </div>
      <Editable as="h1" field="headline" />
      <div className="hero-copy">
        <Editable field="introduction" />
        <Editable field="description" />
      </div>
      <button className="button dark hero-button" onClick={() => open("about")}>
        认识我
        <ArrowUpRight size={16} />
      </button>
      <div className={`hero-celestial ${avatarId ? "has-avatar" : ""}`}>
        {avatarId && (
          <button
            className="hero-avatar"
            aria-label={editing ? "编辑个人头像" : "查看个人介绍"}
            onClick={() => (editing ? edit("profile") : open("about"))}
          >
            <SafeImage
              src={mediaUrl(avatarId, true)}
              alt={`${content?.profile.name} 的个人头像`}
            />
          </button>
        )}
        <div className="hero-orbit" aria-hidden="true">
          <span />
          <i />
        </div>
      </div>
      <span className="hero-side-note" aria-hidden="true">
        {avatarId ? (
          "A Brighter Daily Life"
        ) : (
          <>
            A<br />
            Brighter
            <br />
            Daily
            <br />
            Life
          </>
        )}
      </span>
      <span className="hero-bottom-note">A PERSONAL SPACE / 2026</span>
      {editing && <span className="editing-hint">点击文字直接编辑</span>}
    </section>
  );
}
export function PhotoCard({ open, edit }: CardActions) {
  const { content, editing } = useSite();
  const photos = content!.photos;
  const [randomPhotoId, setRandomPhotoId] = useState(
    () => photos[Math.floor(Math.random() * photos.length)]?.id || "",
  );
  useEffect(() => {
    if (!photos.some((photo) => photo.id === randomPhotoId))
      setRandomPhotoId(
        photos[Math.floor(Math.random() * photos.length)]?.id || "",
      );
  }, [photos, randomPhotoId]);
  const preferredPhoto =
    photos.find((p) => p.id === content!.profile.photoId) || photos[0];
  const photo = editing
    ? preferredPhoto
    : photos.find((p) => p.id === randomPhotoId) || photos[0];
  const caption =
    photo?.id === content!.profile.photoId
      ? content!.profile.photoCaption || photo?.title
      : photo?.title;
  return (
    <section className="card photo-card">
      <button
        className="photo-open"
        aria-label="打开相册"
        onClick={() => open("photos", photo?.id)}
      >
        <SafeImage
          src={mediaUrl(photo?.mediaId)}
          alt={photo?.title || "日常照片"}
        />
      </button>
      <span className="photo-label">日常切片</span>
      <div className="photo-edit">
        <EditButton onClick={() => edit("photos")} label="编辑相册" />
      </div>
      <div className="photo-caption">
        <div>
          <h2>{caption || "下一张喜欢的照片"}</h2>
          <span>{photo?.location || "A LITTLE MOMENT"}</span>
        </div>
        <button
          aria-label="浏览这张照片"
          onClick={() => open("photos", photo?.id)}
        >
          <ArrowUpRight size={23} />
        </button>
      </div>
    </section>
  );
}
export function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function ClockCard({ now }: { now: Date }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      request<Weather>("/api/weather")
        .then((w) => {
          if (active) setWeather(w);
        })
        .catch(() => {
          if (active) setWeather({ available: false });
        });
    void load();
    const timer = setInterval(() => void load(), 15 * 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(now)
    .split(":");
  const weekday = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Australia/Sydney",
    weekday: "short",
  }).format(now);
  const zone = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    timeZoneName: "short",
  })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")
    ?.value.replace("GMT", "UTC");
  const code = weather?.code || 0,
    Icon = code <= 1 ? Sun : code <= 48 ? Cloud : CloudRain;
  const label =
    code === 0
      ? "晴"
      : code <= 3
        ? "多云"
        : code <= 48
          ? "雾"
          : code >= 71 && code <= 77
            ? "雪"
            : "雨";
  return (
    <section className="card clock-card" aria-label="悉尼当地时间">
      <div className="clock-top">
        <span className="eyebrow">LOCAL TIME / SYDNEY</span>
        <span
          className="weather"
          title={
            weather?.updatedAt
              ? `天气更新于 ${new Date(weather.updatedAt).toLocaleTimeString("zh-CN")}`
              : undefined
          }
        >
          {weather?.available ? (
            <>
              <Icon size={23} />
              {Math.round(weather.temperature!)}° {label}
              {weather.stale && <small>上次记录</small>}
            </>
          ) : (
            <small>{weather ? "天气暂不可用" : "天气加载中"}</small>
          )}
        </span>
      </div>
      <div className="clock-digits">
        {parts[0]}
        <span>:</span>
        {parts[1]}
      </div>
      <div className="clock-date">
        {sydneyDay(now).replaceAll("-", ".")}
        <span>·</span>
        {weekday}
      </div>
      <div className="clock-bottom">
        <i />
        {zone} · {offset}
      </div>
    </section>
  );
}
export function ProjectCard({ open, edit }: CardActions) {
  const { content } = useSite();
  const project = content?.projects[0];
  return (
    <section className="card project-card">
      <div className="section-top">
        <span className="eyebrow">01 / SELECTED PROJECT</span>
        <div>
          <EditButton onClick={() => edit("projects")} label="编辑项目" />
          <ArrowLink onClick={() => open("projects")}>查看项目</ArrowLink>
        </div>
      </div>
      {project ? (
        <>
          <div className="project-title">
            <h2>{project.title}</h2>
            <span>持续更新</span>
          </div>
          <p className="project-summary">{project.summary}</p>
          <button
            className={`project-preview${project.coverId ? " has-cover" : ""}`}
            onClick={() => open("projects", project.id)}
            aria-label={`查看${project.title}项目`}
          >
            {project.coverId ? (
              <SafeImage
                className="project-cover"
                src={mediaUrl(project.coverId)}
                alt={project.title}
              />
            ) : (
              <div className="demo-window">
                <aside>
                  <strong>
                    <Sprout size={19} />
                    {project.title}
                  </strong>
                  {[
                    [Home, "首页"],
                    [FileText, "笔记"],
                    [Tags, "标签"],
                    [Trash2, "回收站"],
                  ].map(([Icon, label], i) => {
                    const I = Icon as typeof Home;
                    return (
                      <span
                        className={i === 0 ? "active" : ""}
                        key={String(label)}
                      >
                        <I size={13} />
                        {String(label)}
                      </span>
                    );
                  })}
                </aside>
                <div className="demo-main">
                  <div className="demo-toolbar">
                    <span>
                      <Search size={12} />
                      搜索笔记…
                    </span>
                    <i>
                      <Plus size={15} />
                    </i>
                  </div>
                  <h3>把灵感留下来</h3>
                  <p>记录想法，整理思绪，让每一个灵感都有生长的可能。</p>
                  <div className="demo-notes">
                    {content?.articles.slice(1, 3).map((a, i) => (
                      <div key={a.id}>
                        <SafeImage src={mediaUrl(a.coverId, true)} alt="" />
                        <span>
                          <strong>
                            {i === 0 ? "生活中的小确幸" : "关于专注"}
                          </strong>
                          <small>
                            {i === 0
                              ? "那些平凡日子里的闪光瞬间。"
                              : "在纷扰的世界里，留一点专注。"}
                          </small>
                          <em>
                            <FileText size={9} />
                            {i === 0 ? "12" : "8"} 篇笔记
                          </em>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </button>
        </>
      ) : (
        <Empty>新的作品，正在慢慢生长。</Empty>
      )}
    </section>
  );
}
export function ArticleCard({ open, edit }: CardActions) {
  const { content } = useSite();
  return (
    <section className="card article-card">
      <div className="section-top">
        <h2>最近写下的</h2>
        <div>
          <EditButton onClick={() => edit("articles")} label="编辑文章" />
          <ArrowLink onClick={() => open("articles")}>全部</ArrowLink>
        </div>
      </div>
      <div className="home-articles">
        {content?.articles.slice(0, 3).map((a, i) => (
          <button
            className="home-article"
            key={a.id}
            onClick={() => open("articles", a.id)}
          >
            <SafeImage src={mediaUrl(a.coverId, true)} alt="" />
            <span>
              <strong>{a.title}</strong>
              <small>
                {["创造手记", "数字生活", "生活碎片"][i]} ·{" "}
                {a.date.slice(5).replace("-", ".")}
              </small>
            </span>
          </button>
        ))}
        {!content?.articles.length && (
          <Empty>留一点文字，记录那些正在发生的事。</Empty>
        )}
      </div>
      <span className="article-footer">
        {content?.articles.length || 0} 篇随笔，持续生长。
      </span>
    </section>
  );
}
const monthNames = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
];
export function CalendarCard({ now }: { now: Date }) {
  const [year, month, today] = sydneyDay(now).split("-").map(Number);
  const [offset, setOffset] = useState(0);
  const cursor = new Date(year, month - 1 + offset, 1),
    y = cursor.getFullYear(),
    m = cursor.getMonth(),
    blanks = (cursor.getDay() + 6) % 7;
  const days = [
    ...Array(blanks).fill(null),
    ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => i + 1),
  ];
  return (
    <section className="card calendar-card">
      <div className="calendar-top">
        <div>
          <h2>{monthNames[m]}</h2>
          <span className="eyebrow">
            {cursor
              .toLocaleDateString("en-US", { month: "long" })
              .toUpperCase()}
          </span>
        </div>
        <div className="month-controls">
          <button aria-label="上个月" onClick={() => setOffset(offset - 1)}>
            <ChevronLeft size={17} />
          </button>
          <span>{y}</span>
          <button aria-label="下个月" onClick={() => setOffset(offset + 1)}>
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
          <span key={d} className="weekday">
            {d}
          </span>
        ))}
        {days.map((d, i) => (
          <span
            key={i}
            className={offset === 0 && d === today ? "today" : ""}
            aria-current={offset === 0 && d === today ? "date" : undefined}
          >
            {d}
          </span>
        ))}
      </div>
      <button className="calendar-footer" onClick={() => setOffset(0)}>
        <i />
        {offset ? "回到今天" : "今天也适合开始。"}
      </button>
    </section>
  );
}
const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : String(n);
export function CheckinCard() {
  const { stats, checkin, notify } = useSite();
  const [pending, setPending] = useState(false);
  return (
    <section className="card checkin-card">
      <span className="eyebrow">DAILY CHECK-IN</span>
      <div className="checkin-main">
        <div>
          <h2>来过，留个脚印。</h2>
          <div className="checkin-greeting">
            <Cat />
            <span>
              {stats?.checkedIn
                ? `今天已签到，累计留下 ${stats.checkins} 次足迹。`
                : "很高兴，今天也在这里遇见你。"}
            </span>
          </div>
        </div>
        <button
          className="button lime"
          disabled={pending || !stats || stats.checkedIn}
          onClick={async () => {
            setPending(true);
            try {
              await checkin();
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "签到中…" : stats?.checkedIn ? "今日已签到" : "今日签到"}
          {stats?.checkedIn ? <Check size={15} /> : <ArrowUpRight size={15} />}
        </button>
      </div>
      <div className="stats-row">
        <div>
          <strong>{stats ? compact(stats.todayVisitors) : "—"}</strong>
          <span>今日访客</span>
        </div>
        <div>
          <strong>{stats ? compact(stats.totalViews) : "—"}</strong>
          <span>累计访问</span>
        </div>
        <div>
          <strong>{stats ? stats.daysOnline : "—"}</strong>
          <span>运行天数</span>
        </div>
      </div>
    </section>
  );
}
export function CollectionCard({ open, edit }: CardActions) {
  const { content } = useSite();
  const items = content?.collections.slice(0, 2) || [];
  return (
    <section className="card collection-card">
      <div className="section-top">
        <h2>最近收集</h2>
        <div>
          <EditButton onClick={() => edit("collections")} label="编辑收集" />
          <ArrowLink onClick={() => open("collections")} />
        </div>
      </div>
      <div className="collection-previews">
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => open("collections", c.id)}
            aria-label={`查看${c.title}`}
          >
            <SafeImage src={mediaUrl(c.imageId, true)} alt={c.title} />
          </button>
        ))}
        {!items.length && <Empty>留一份喜欢的灵感。</Empty>}
      </div>
      <strong className="collection-caption">一些值得留下的灵感。</strong>
      <div className="collection-filter">
        <i />
        {["图片", "网站", "灵感"].map((k) => (
          <button key={k} onClick={() => open("collections", k)}>
            {k}
          </button>
        ))}
      </div>
    </section>
  );
}
