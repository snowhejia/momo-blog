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
import { request } from "../api";
import {
  mediaUrl,
  sydneyDay,
  type HomeContent,
  type Media,
} from "../../../shared/model";
export type EditorSection =
  "profile" | "projects" | "articles" | "photos" | "collections" | "tracks";
type Entry = Record<string, string | boolean | null>;
const names: Record<EditorSection, string> = {
  profile: "个人资料与联系",
  projects: "项目",
  articles: "文章",
  photos: "相册与首页照片",
  collections: "收集",
  tracks: "音乐",
};
export function Editor({
  section,
  onClose,
}: {
  section: EditorSection;
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
        ? ["github", "email", "xiaohongshu"].includes(key)
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
        title: "新的文字",
        summary: "",
        body: "",
        date: sydneyDay(new Date()),
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
    if (!window.confirm("从首页移除这条内容？保存修改后生效。")) return;
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
  ) => (
    <label key={key}>
      {label}
      {multiline ? (
        <textarea
          value={String(entry?.[key] || "")}
          rows={key === "body" ? 10 : 3}
          onChange={(e) => update(key, e.target.value)}
        />
      ) : (
        <input
          type={type}
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
      eyebrow="修改会暂存于页面，点击顶部「保存修改」后发布"
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
                <span>{i.title || "未命名"}</span>
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
                  {field("eyebrow", "顶部标签")}
                  {field("motto", "页脚寄语")}
                  {field("github", "GitHub 链接")}
                  {field("email", "联系邮箱", false, "email")}
                  {field("xiaohongshu", "小红书主页链接")}
                  {field("photoCaption", "首页照片标题")}
                  <label>
                    首页展示照片
                    <select
                      aria-label="首页展示照片"
                      value={String(entry.photoId || "")}
                      onChange={(e) => update("photoId", e.target.value)}
                    >
                      <option value="">使用相册第一张</option>
                      {content!.photos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <small>
                      访客每次打开首页时随机展示相册中的一张；编辑时固定预览所选照片。
                    </small>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!entry.demo}
                      onChange={(e) => update("demo", e.target.checked)}
                    />
                    页面包含示例内容（在素材说明中标明）
                  </label>
                </>
              ) : (
                <>
                  {field("title", "标题")}
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
                      {field("summary", "摘要", true)}
                      {field("date", "日期", false, "date")}
                      {field("body", "正文", true)}
                      {field("url", "外部文章链接（可选）")}
                      {asset("coverId", "文章封面")}
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
                  {["photos", "collections", "tracks"].includes(section) && (
                    <>
                      {field("source", "素材来源（可选）")}
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={!!entry.demo}
                          onChange={(e) => update("demo", e.target.checked)}
                        />
                        这是演示素材
                      </label>
                    </>
                  )}
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
                  返回首页预览
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
