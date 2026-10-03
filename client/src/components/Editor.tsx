import { useState, type ChangeEvent } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { useSite } from "../store";
import { Dialog, SafeImage } from "./Common";
import { MusicCover } from "./MusicCover";
import { LocationEditor } from "./LocationEditor";
import { request } from "../api";
import {
  articleDateFromLocal,
  articleDateParts,
  articleDateSchema,
  articleExcerpt,
} from "../../../shared/articles";
import { mediaUrl, type HomeContent, type Media } from "../../../shared/model";
export type EditorSection =
  | "location"
  | "profile"
  | "projects"
  | "articles"
  | "photos"
  | "collections"
  | "friends"
  | "tracks";
type Entry = Record<string, string | boolean | null>;
type ContentSection = Exclude<EditorSection, "location">;
function ArticleDateEditor({
  value,
  timeZone,
  onChange,
}: {
  value: string;
  timeZone: string;
  onChange: (value: string) => void;
}) {
  const { day, time } = articleDateParts(value, timeZone);
  const valid = articleDateSchema.safeParse(value).success;
  const updateDate = (nextDay: string, nextTime: string) => {
    if (!nextTime) return onChange(nextDay);
    const local = `${nextDay}T${nextTime}`;
    // Keep incomplete or skipped local times in the draft so validation blocks
    // saving them instead of silently retaining a different publication time.
    onChange(articleDateFromLocal(local, timeZone, value) || local);
  };
  return (
    <fieldset className="article-date-fields">
      <legend>发布时间</legend>
      <div>
        <label>
          日期
          <input
            type="date"
            value={day}
            onChange={(e) => updateDate(e.target.value, time)}
            aria-invalid={!valid}
          />
        </label>
        <label>
          时间（可选）
          <input
            type="time"
            step="1"
            value={time}
            onChange={(e) => updateDate(day, e.target.value)}
            aria-invalid={!valid}
          />
        </label>
      </div>
      <div className="article-date-note">
        <small>时区：{timeZone}。时间留空时只显示日期。</small>
        <button
          className="text-button"
          onClick={() => onChange(new Date().toISOString())}
        >
          使用当前时间
        </button>
      </div>
      {!valid && (
        <p className="form-error" role="alert">
          请填写有效日期和时间；夏令时跳过的时段不可用。
        </p>
      )}
    </fieldset>
  );
}
const names: Record<ContentSection, string> = {
  profile: "个人资料与联系",
  projects: "项目",
  articles: "文章",
  photos: "相册与首页照片",
  collections: "收集",
  friends: "友链",
  tracks: "音乐",
};
export function Editor({
  section,
  onClose,
}: {
  section: EditorSection;
  onClose: () => void;
}) {
  return section === "location" ? (
    <LocationEditor onClose={onClose} />
  ) : (
    <ContentEditor section={section} onClose={onClose} />
  );
}
function ContentEditor({
  section,
  onClose,
}: {
  section: ContentSection;
  onClose: () => void;
}) {
  const { content, change } = useSite();
  const [selected, setSelected] = useState<string | null>(
      section === "profile" ? null : content![section][0]?.id || null,
    ),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState("");
  const list = section === "profile" ? [] : content![section];
  const entry = (section === "profile"
    ? { ...content!.profile, ...content!.social }
    : list.find((i) => i.id === selected)) as unknown as Entry | undefined;
  const update = (key: string, value: string | boolean | null) => {
    change((c) =>
      section === "profile"
        ? ["github", "email", "xiaohongshu", "bilibili"].includes(key)
          ? { ...c, social: { ...c.social, [key]: value } }
          : { ...c, profile: { ...c.profile, [key]: value } }
        : ({
            ...c,
            [section]: c[section].map((i) =>
              i.id === selected ? { ...i, [key]: value } : i,
            ),
          } as HomeContent),
    );
  };
  const add = () => {
    const id = crypto.randomUUID();
    const base = { id, title: "" };
    let item: unknown;
    if (section === "projects")
      item = {
        ...base,
        title: "新项目",
        summary: "",
        description: "",
        coverId: null,
        url: "",
      };
    if (section === "articles")
      item = {
        ...base,
        summary: "",
        body: "",
        date: new Date().toISOString(),
        coverId: null,
        url: "",
      };
    if (section === "photos")
      item = {
        ...base,
        title: "新的照片",
        mediaId: "",
        caption: "",
        location: "",
        source: "",
        demo: false,
      };
    if (section === "collections")
      item = {
        ...base,
        title: "新的灵感",
        description: "",
        kind: "灵感",
        imageId: null,
        url: "",
        source: "",
        demo: false,
      };
    if (section === "friends")
      item = {
        ...base,
        title: "新的朋友",
        description: "",
        url: "",
        avatarId: null,
      };
    if (section === "tracks")
      item = {
        ...base,
        title: "新的音乐",
        artist: "",
        audioId: "",
        coverId: null,
        demo: false,
        source: "",
      };
    if (section !== "profile") {
      change(
        (c) => ({ ...c, [section]: [...c[section], item] }) as HomeContent,
      );
      setSelected(id);
    }
  };
  const remove = () => {
    if (
      !window.confirm(
        section === "friends"
          ? "移除这条友链？保存修改后生效。"
          : "从首页移除这条内容？保存修改后生效。",
      )
    )
      return;
    if (section === "profile") return;
    const next = list.filter((i) => i.id !== selected);
    change((c) => ({ ...c, [section]: next }) as HomeContent);
    setSelected(next[0]?.id || null);
  };
  const move = (offset: number) => {
    if (section === "profile") return;
    const at = list.findIndex((i) => i.id === selected),
      to = at + offset;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[at], next[to]] = [next[to], next[at]];
    change((c) => ({ ...c, [section]: next }) as HomeContent);
  };
  const file = async (
    e: ChangeEvent<HTMLInputElement>,
    field: string,
    kind: "image" | "audio",
  ) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const currentId = selected;
    setUploading(true);
    setUploadError("");
    try {
      const data = new FormData();
      data.append("file", f);
      const m = await request<Media>(`/api/media?kind=${kind}`, {
        method: "POST",
        body: data,
      });
      change((c) =>
        section === "profile"
          ? { ...c, profile: { ...c.profile, [field]: m.id } }
          : ({
              ...c,
              [section]: c[section].map((i) =>
                i.id === currentId ? { ...i, [field]: m.id } : i,
              ),
            } as HomeContent),
      );
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };
  const field = (
    key: string,
    label: string,
    multiline = false,
    type = "text",
    placeholder = "",
  ) => (
    <label key={key}>
      {label}
      {multiline ? (
        <textarea
          value={String(entry?.[key] || "")}
          rows={key === "body" ? 10 : 3}
          placeholder={placeholder}
          onChange={(e) => update(key, e.target.value)}
        />
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          value={String(entry?.[key] || "")}
          onChange={(e) => update(key, e.target.value)}
        />
      )}
    </label>
  );
  const asset = (
    key: string,
    label: string,
    kind: "image" | "audio" = "image",
  ) => (
    <div className="asset-field" key={key}>
      <span>{label}</span>
      {section === "tracks" && key === "coverId" ? (
        <MusicCover
          key={String(entry?.audioId || "") + String(entry?.coverId || "")}
          className="editor-image music-cover-preview"
          coverId={entry?.coverId ? String(entry.coverId) : null}
          audioId={entry?.audioId ? String(entry.audioId) : null}
          alt="音乐封面"
        />
      ) : (
        entry?.[key] &&
        kind === "image" && (
          <SafeImage
            className="editor-image"
            src={mediaUrl(String(entry[key]))}
            alt={label}
          />
        )
      )}
      <div>
        <label className="upload-button">
          <Upload size={14} />
          {uploading ? "上传中…" : entry?.[key] ? "替换文件" : "上传文件"}
          <input
            aria-label={`上传${label}`}
            type="file"
            accept={
              kind === "image"
                ? "image/jpeg,image/png,image/webp"
                : ".mp3,.m4a,.wav"
            }
            disabled={uploading}
            onChange={(e) => void file(e, key, kind)}
          />
        </label>
        {entry?.[key] && (
          <small>{kind === "audio" ? "音频已上传" : "图片已上传"}</small>
        )}
        {entry?.[key] && key !== "mediaId" && key !== "audioId" && (
          <button className="text-button" onClick={() => update(key, null)}>
            {section === "tracks" && key === "coverId"
              ? "恢复自动封面"
              : "移除"}
          </button>
        )}
      </div>
    </div>
  );
  return (
    <Dialog
      title={`编辑${names[section]}`}
      eyebrow="修改会暂存于页面，点击底部「保存修改」后发布"
      busy={uploading}
      wide
      onClose={() => {
        if (!uploading) onClose();
      }}
    >
      <div
        className={`editor-layout ${section === "profile" ? "profile-only" : ""}`}
      >
        {section !== "profile" && (
          <aside className="editor-list">
            {list.map((i, index) => (
              <button
                key={i.id}
                onClick={() => {
                  if (!uploading) setSelected(i.id);
                }}
                className={selected === i.id ? "selected" : ""}
              >
                <small>{String(index + 1).padStart(2, "0")}</small>
                <span>
                  {i.title.trim() ||
                    ("body" in i
                      ? articleExcerpt(i).slice(0, 36) || "新的文字"
                      : "未命名")}
                </span>
              </button>
            ))}
            <button className="add-entry" onClick={add} disabled={uploading}>
              <Plus size={15} />
              添加{names[section]}
            </button>
          </aside>
        )}
        <div className="editor-fields">
          {entry ? (
            <>
              {section !== "profile" && (
                <div className="entry-tools">
                  <span>内容顺序</span>
                  <button
                    aria-label="上移内容"
                    onClick={() => move(-1)}
                    disabled={uploading || list[0]?.id === selected}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    aria-label="下移内容"
                    onClick={() => move(1)}
                    disabled={uploading || list.at(-1)?.id === selected}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="delete-entry"
                    onClick={remove}
                    disabled={uploading}
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              )}
              {section === "profile" ? (
                <>
                  {asset("avatarId", "个人头像")}
                  {field("name", "名字")}
                  {field("headline", "首页标题", true)}
                  {field("introduction", "个人介绍", true)}
                  {field("description", "首页描述", true)}
                  {field("aboutBody", "认识我正文", true)}
                  {field("eyebrow", "顶部标签")}
                  {field("motto", "页脚寄语")}
                  {field("github", "GitHub 链接")}
                  {field("email", "联系邮箱", false, "email")}
                  {field("xiaohongshu", "小红书主页链接")}
                  {field("bilibili", "Bilibili 主页链接")}
                </>
              ) : (
                <>
                  {field(
                    "title",
                    section === "friends"
                      ? "网站名称"
                      : section === "articles"
                        ? "标题（可选）"
                        : "标题",
                    false,
                    "text",
                    section === "articles" ? "留空即可直接展示文字" : "",
                  )}
                  {section === "projects" && (
                    <>
                      {field("summary", "简介", true)}
                      {field("description", "项目说明", true)}
                      {field("url", "项目链接")}
                      {asset("coverId", "项目封面")}
                      <small>不设置封面时，显示默认笔记应用示意图。</small>
                    </>
                  )}
                  {section === "articles" && (
                    <>
                      {field(
                        "summary",
                        "摘要（可选）",
                        true,
                        "text",
                        "留空时，列表自动显示正文开头",
                      )}
                      <ArticleDateEditor
                        value={String(entry.date)}
                        timeZone={content!.location.timeZone}
                        onChange={(value) => update("date", value)}
                      />
                      {field("body", "正文", true)}
                      {field("url", "外部文章链接（可选）")}
                      {asset("coverId", "文章封面（可选）")}
                      <small>
                        不上传封面即使用纯文字布局；已有封面可以直接移除。
                      </small>
                    </>
                  )}
                  {section === "photos" && (
                    <>
                      {asset("mediaId", "照片")}
                      {field("caption", "照片说明", true)}
                      {field("location", "拍摄地点")}
                    </>
                  )}
                  {section === "collections" && (
                    <>
                      <label>
                        分类
                        <select
                          aria-label="分类"
                          value={String(entry.kind)}
                          onChange={(e) => update("kind", e.target.value)}
                        >
                          {["图片", "网站", "灵感"].map((k) => (
                            <option key={k}>{k}</option>
                          ))}
                        </select>
                      </label>
                      {field("description", "说明", true)}
                      {field("url", "来源链接")}
                      {asset("imageId", "灵感图片")}
                    </>
                  )}
                  {section === "friends" && (
                    <>
                      {field("description", "一句话介绍", true)}
                      {field("url", "网站链接", false, "url")}
                      {asset("avatarId", "友链头像")}
                      <small>
                        链接需以 https:// 或 http:// 开头；头像可留空。
                      </small>
                    </>
                  )}
                  {section === "tracks" && (
                    <>
                      {field("artist", "艺术家")}
                      {asset("audioId", "音乐", "audio")}
                      {asset("coverId", "音乐封面")}
                      <small>
                        自动读取歌曲内嵌封面，没有封面时显示默认唱片；也可以上传自己的封面。
                      </small>
                    </>
                  )}
                  {["photos", "collections", "tracks"].includes(section) &&
                    field("source", "素材来源（可选）")}
                </>
              )}
              {uploadError && (
                <p role="alert" className="form-error">
                  {uploadError}
                </p>
              )}
              <div className="editor-done">
                <button
                  className="button dark"
                  disabled={uploading}
                  onClick={onClose}
                >
                  {section === "friends" ? "返回友链预览" : "返回首页预览"}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-content">
              <ImageIcon size={32} />
              <p>添加第一条内容，开始填满这个空间。</p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
