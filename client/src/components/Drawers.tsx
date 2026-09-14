import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Search } from "lucide-react";
import { useSite } from "../store";
import { mediaUrl } from "../../../shared/model";
import { Dialog, SafeImage, Empty, Cat, EditButton } from "./Common";
import type { Panel } from "./HomeCards";
import { sectionNames, type Section } from "../navigation";
import { Album } from "./Album";
import { ContactDialog } from "./Contact";

const sectionInfo = {
  projects: {
    title: "作品与实验",
    eyebrow: "SELECTED WORK",
    description: "把好奇心，变成可以触碰的作品。",
    unit: "个项目",
    number: "01",
  },
  articles: {
    title: "最近写下的",
    eyebrow: "NOTES & THOUGHTS",
    description: "关于创造，也关于正在发生的日常。",
    unit: "篇文字",
    number: "02",
  },
  photos: {
    title: "日常切片",
    eyebrow: "LITTLE MOMENTS",
    description: "走走，停停。留住一些喜欢的片刻。",
    unit: "张照片",
    number: "03",
  },
  collections: {
    title: "收集一点喜欢",
    eyebrow: "A CABINET OF CURIOSITIES",
    description: "图片、网站，以及一闪而过的灵感。",
    unit: "份收藏",
    number: "04",
  },
};

export function ContentPage({
  panel,
  id,
  onSelect,
  onEdit,
}: {
  panel: Section;
  id?: string;
  onSelect: (id: string) => void;
  onEdit: () => void;
}) {
  const { content } = useSite();
  const info = sectionInfo[panel];
  return (
    <>
      <header className="section-heading">
        <div>
          <span className="eyebrow">
            <i />
            {info.eyebrow}
          </span>
          <h1>
            {info.title}
            <span>.</span>
          </h1>
          <p>{info.description}</p>
        </div>
        <div className="section-heading-meta">
          <span className="section-number" aria-hidden="true">
            {info.number}
          </span>
          <span className="section-count">
            {String(content![panel].length).padStart(2, "0")} {info.unit}
          </span>
          <EditButton
            onClick={onEdit}
            label={`编辑${panel === "articles" ? "文章" : sectionNames[panel]}`}
          />
        </div>
      </header>
      <div className="section-content">
        <ContentBody panel={panel} id={id} onSelect={onSelect} />
      </div>
    </>
  );
}

export function ContentDialog({
  panel,
  id,
  onClose,
}: {
  panel: Panel;
  id?: string;
  onClose: () => void;
}) {
  const { content } = useSite();
  if (panel === "contact") return <ContactDialog onClose={onClose} />;
  const info =
    panel in sectionInfo
      ? sectionInfo[panel as Section]
      : {
          about: {
            title: "你好，我是 " + content!.profile.name + "。",
            eyebrow: "DESIGN · CODE · EVERYDAY",
          },
          contact: { title: "从一句你好开始。", eyebrow: "SAY HELLO" },
          sources: {
            title: "关于这里的示例素材",
            eyebrow: "CREDITS & SOURCES",
          },
        }[panel as "about" | "contact" | "sources"];
  return (
    <Dialog
      title={info.title}
      eyebrow={info.eyebrow}
      onClose={onClose}
      wide={panel !== "about"}
    >
      <ContentBody panel={panel} id={id} />
    </Dialog>
  );
}

function ContentBody({
  panel,
  id,
  onSelect,
}: {
  panel: Panel;
  id?: string;
  onSelect?: (id: string) => void;
}) {
  const { content } = useSite();
  const [localSelected, setLocalSelected] = useState(id || ""),
    [filter, setFilter] = useState(
      ["图片", "网站", "灵感"].includes(id || "") ? id! : "全部",
    ),
    [query, setQuery] = useState("");
  const selected = onSelect ? id || "" : localSelected;
  const setSelected = onSelect || setLocalSelected;
  useEffect(() => {
    if (!id || ["图片", "网站", "灵感"].includes(id)) setFilter(id || "全部");
  }, [id]);
  const article = content!.articles.find((a) => a.id === selected);
  const project = content!.projects.find((p) => p.id === selected);
  const collection = content!.collections.find((c) => c.id === selected);
  return (
    <>
      {panel === "photos" && <Album id={selected} onSelect={setSelected} />}
      {panel === "articles" &&
        (article ? (
          <article className="reading-view">
            <button
              className="text-button back-link"
              onClick={() => setSelected("")}
            >
              <ArrowLeft size={16} />
              所有文字
            </button>
            {article.coverId && (
              <SafeImage
                className="reading-cover"
                src={mediaUrl(article.coverId)}
                alt={article.title}
              />
            )}
            <time>{article.date}</time>
            <h3>{article.title}</h3>
            <p className="reading-summary">{article.summary}</p>
            <div className="prose">
              {article.body.split(/\n\s*\n/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {article.url && (
              <a
                className="button dark"
                href={article.url}
                target="_blank"
                rel="noreferrer"
              >
                阅读原文
                <ArrowUpRight size={16} />
              </a>
            )}
          </article>
        ) : (
          <div className="article-list">
            {content!.articles.map((a) => (
              <button key={a.id} onClick={() => setSelected(a.id)}>
                <SafeImage src={mediaUrl(a.coverId, true)} alt="" />
                <div>
                  <time>{a.date}</time>
                  <h3>{a.title}</h3>
                  <p>{a.summary}</p>
                </div>
                <ArrowUpRight size={20} />
              </button>
            ))}
            {!content!.articles.length && (
              <Empty>这里会慢慢长出新的文字。</Empty>
            )}
          </div>
        ))}
      {panel === "projects" &&
        (project ? (
          <article className="reading-view">
            <button
              className="text-button back-link"
              onClick={() => setSelected("")}
            >
              <ArrowLeft size={16} />
              所有项目
            </button>
            {project.coverId && (
              <SafeImage
                className="reading-cover"
                src={mediaUrl(project.coverId)}
                alt={project.title}
              />
            )}
            <span className="eyebrow">A WORK IN PROGRESS</span>
            <h3>{project.title}</h3>
            <p className="reading-summary">{project.summary}</p>
            <div className="prose">
              {project.description.split(/\n\s*\n/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {project.url && (
              <a
                className="button dark"
                href={project.url}
                target="_blank"
                rel="noreferrer"
              >
                打开项目
                <ArrowUpRight size={16} />
              </a>
            )}
          </article>
        ) : (
          <div className="project-list">
            {content!.projects.map((p, i) => (
              <button key={p.id} onClick={() => setSelected(p.id)}>
                <span className="project-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {p.coverId ? (
                  <SafeImage src={mediaUrl(p.coverId, true)} alt={p.title} />
                ) : (
                  <div className="project-cover-placeholder" aria-hidden="true">
                    <span>{p.title}</span>
                    <i>✳</i>
                  </div>
                )}
                <h3>{p.title}</h3>
                <p>{p.summary}</p>
                <ArrowUpRight size={24} />
              </button>
            ))}
            {!content!.projects.length && <Empty>新的作品正在路上。</Empty>}
          </div>
        ))}
      {panel === "collections" &&
        (collection ? (
          <article className="reading-view collection-detail">
            <button
              className="text-button back-link"
              onClick={() => setSelected(filter === "全部" ? "" : filter)}
            >
              <ArrowLeft size={16} />
              返回收集
            </button>
            <span className="small-tag">{collection.kind}</span>
            <h3>{collection.title}</h3>
            {collection.imageId && (
              <SafeImage
                className="collection-detail-image"
                src={mediaUrl(collection.imageId)}
                alt={collection.title}
              />
            )}
            <div className="prose">
              {collection.description.split(/\n\s*\n/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {collection.source && (
              <p className="collection-detail-source">
                {collection.demo ? "示例素材 · " : "来源 · "}
                {collection.source}
              </p>
            )}
            {collection.url && (
              <a
                className="button dark"
                href={collection.url}
                target="_blank"
                rel="noreferrer"
              >
                查看来源
                <ArrowUpRight size={16} />
              </a>
            )}
          </article>
        ) : (
          <>
            <div className="collection-toolbar">
              <div className="filter-tabs">
                {["全部", "图片", "网站", "灵感"].map((k) => (
                  <button
                    key={k}
                    aria-pressed={k === filter}
                    onClick={() => {
                      setFilter(k);
                      onSelect?.(k === "全部" ? "" : k);
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Search size={16} />
                <input
                  placeholder="找一点灵感…"
                  aria-label="搜索收集"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="collection-list">
              {content!.collections
                .filter(
                  (c) =>
                    (filter === "全部" || c.kind === filter) &&
                    `${c.title} ${c.description}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((c) => (
                  <article key={c.id}>
                    {c.imageId && (
                      <SafeImage src={mediaUrl(c.imageId)} alt={c.title} />
                    )}
                    <div>
                      <span className="small-tag">{c.kind}</span>
                      <h3>
                        <button
                          className="collection-open"
                          aria-label={`查看${c.title}`}
                          onClick={() => setSelected(c.id)}
                        >
                          {c.title}
                        </button>
                      </h3>
                      <p>{c.description}</p>
                      {c.source && (
                        <small className="source-line">
                          {c.demo ? "示例素材 · " : ""}
                          {c.source}
                        </small>
                      )}
                      <span
                        className="collection-detail-hint"
                        aria-hidden="true"
                      >
                        查看详情 <ArrowUpRight size={15} />
                      </span>
                      {c.url && (
                        <a
                          className="text-button"
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          查看来源
                          <ArrowUpRight size={15} />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
            </div>
            {!content!.collections.some(
              (c) =>
                (filter === "全部" || c.kind === filter) &&
                `${c.title} ${c.description}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            ) && <Empty>这个角落还没有收集到灵感。</Empty>}
          </>
        ))}
      {panel === "about" && (
        <div className="about-content">
          <Cat />
          <p className="about-intro">{content!.profile.introduction}</p>
          <p>{content!.profile.description}</p>
          <p>
            这是我的个人空间。把作品、文字和日常放在一起，也为下一次突如其来的灵感，留一个位置。
          </p>
          <div className="about-motto">{content!.profile.motto}</div>
        </div>
      )}
      {panel === "sources" && (
        <div className="sources-content">
          <p>
            {content!.profile.demo
              ? "此首页目前包含可替换的示例内容。照片、项目文案和音乐用来展示布局，不代表站主的真实拍摄或经历。"
              : "页面内容由站主管理；素材来源列于下方。"}
          </p>
          <h3>照片</h3>
          {content!.photos.map((p) => (
            <p key={p.id}>
              <strong>
                {p.title}
                {p.demo ? "（示例）" : ""}
              </strong>
              <br />
              {p.source || "站主上传"}
            </p>
          ))}
          <h3>收集</h3>
          {content!.collections.map((c) => (
            <p key={c.id}>
              <strong>
                {c.title}
                {c.demo ? "（示例）" : ""}
              </strong>
              <br />
              {c.source || "站主收集"}
            </p>
          ))}
          <h3>音乐</h3>
          {content!.tracks.map((t) => (
            <p key={t.id}>
              <strong>
                {t.title}
                {t.demo ? "（示例）" : ""}
              </strong>
              <br />
              {t.source || t.artist}
            </p>
          ))}
          <h3>天气与标识</h3>
          <p>
            天气：
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
            （CC BY 4.0）。悉尼时间使用 Australia/Sydney
            时区。像素猫为本项目原创品牌标识。
          </p>
        </div>
      )}
    </>
  );
}
