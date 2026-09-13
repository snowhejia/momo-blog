import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  LockKeyhole,
  Mail,
  MessageSquare,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { messageSchema, type MessageInbox } from "../../../shared/model";
import { ApiError, request } from "../api";
import { useSite } from "../store";
import { Dialog, Empty } from "./Common";

const draftKey = "hejia-homepage:contact-draft";
const blankDraft = () => ({
  submissionId: crypto.randomUUID(),
  name: "",
  email: "",
  body: "",
  website: "",
});
function readDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null");
    if (
      saved &&
      typeof saved.submissionId === "string" &&
      typeof saved.name === "string" &&
      typeof saved.email === "string" &&
      typeof saved.body === "string"
    )
      return {
        submissionId: saved.submissionId,
        name: saved.name.slice(0, 60),
        email: saved.email.slice(0, 254),
        body: saved.body.slice(0, 2000),
        website: "",
      };
  } catch {}
  return blankDraft();
}

export function ContactDialog({ onClose }: { onClose: () => void }) {
  const { content } = useSite();
  const [draft, setDraft] = useState(readDraft);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const success = useRef<HTMLDivElement>(null);
  const social = content!.social;
  useEffect(() => {
    try {
      if (sent || !(draft.name || draft.email || draft.body))
        sessionStorage.removeItem(draftKey);
      else sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {}
  }, [draft, sent]);
  useEffect(() => {
    if (sent) success.current?.focus();
  }, [sent]);
  const update = (
    key: "name" | "email" | "body" | "website",
    value: string,
  ) => {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      submissionId: crypto.randomUUID(),
    }));
    setError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const input = messageSchema.safeParse(draft);
    if (!input.success) {
      setError(input.error.issues[0]?.message || "请检查留言内容。");
      return;
    }
    setPending(true);
    setError("");
    try {
      await request("/api/messages", {
        method: "POST",
        body: JSON.stringify(input.data),
        signal: AbortSignal.timeout(15000),
      });
      setSent(true);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "暂时没有发送成功，内容已保留，请稍后重试。",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      title={sent ? "留言已收到。" : "留一句话吧。"}
      eyebrow="SAY HELLO"
      className="contact-dialog"
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      {sent ? (
        <div ref={success} className="contact-success" tabIndex={-1}>
          <span className="contact-success-icon">
            <Check size={26} />
          </span>
          <h3>谢谢你，来这里打个招呼。</h3>
          <p>
            留言已送达我的私人留言箱。
            <br />
            有留下邮箱的话，我们也可以继续聊聊。
          </p>
          <button className="button dark" onClick={onClose}>
            回到页面
            <ArrowUpRight size={16} />
          </button>
        </div>
      ) : (
        <form className="contact-form" onSubmit={submit}>
          <p className="contact-intro">
            关于作品、合作，或只是分享一个有趣的想法。
          </p>
          <div className="contact-fields-row">
            <label>
              怎么称呼你
              <input
                aria-label="你的称呼"
                placeholder="你的名字或昵称"
                autoComplete="nickname"
                required
                maxLength={60}
                value={draft.name}
                disabled={pending}
                onChange={(e) => update("name", e.target.value)}
              />
            </label>
            <label>
              邮箱 <span className="optional">选填</span>
              <input
                aria-label="回复邮箱"
                type="email"
                placeholder="方便我回复你"
                autoComplete="email"
                maxLength={254}
                value={draft.email}
                disabled={pending}
                onChange={(e) => update("email", e.target.value)}
              />
            </label>
          </div>
          <label className="contact-message-label">
            想说的话
            <textarea
              aria-label="留言内容"
              placeholder="最近在做什么？有什么想一起聊聊的？"
              required
              maxLength={2000}
              rows={6}
              value={draft.body}
              disabled={pending}
              onChange={(e) => update("body", e.target.value)}
            />
          </label>
          <div className="contact-field-meta">
            <span>
              <LockKeyhole size={12} />
              留言仅我可见，邮箱用于回复。
            </span>
            <span>{draft.body.length} / 2000</span>
          </div>
          <label className="contact-honeypot" aria-hidden="true">
            网站
            <input
              tabIndex={-1}
              autoComplete="off"
              value={draft.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button lime contact-submit" disabled={pending}>
            {pending ? "正在发送…" : "发送留言"}
            <ArrowUpRight size={17} />
          </button>
        </form>
      )}
      {(social.github || social.xiaohongshu || social.email) && (
        <div className="contact-socials">
          <span>也可以在这里找到我</span>
          <div>
            {social.github && (
              <a href={social.github} target="_blank" rel="noreferrer">
                GitHub
                <ArrowUpRight size={13} />
              </a>
            )}
            {social.xiaohongshu && (
              <a href={social.xiaohongshu} target="_blank" rel="noreferrer">
                小红书
                <ArrowUpRight size={13} />
              </a>
            )}
            {social.email && (
              <a href={`mailto:${social.email}`}>
                Email
                <ArrowUpRight size={13} />
              </a>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function InboxDialog({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: () => void;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MessageInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState("");
  const [deleting, setDeleting] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    request<MessageInbox>(`/api/messages?page=${page}`)
      .then((result) => {
        if (active) {
          setData(result);
          setExpired(false);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof ApiError ? reason.message : "留言暂时无法加载。",
          );
          setExpired(reason instanceof ApiError && reason.status === 401);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);
  const change = async (
    id: string,
    method: "PATCH" | "DELETE",
    read?: boolean,
  ) => {
    setBusy(id);
    setError("");
    try {
      await request(`/api/messages/${id}`, {
        method,
        ...(method === "PATCH" ? { body: JSON.stringify({ read }) } : {}),
      });
      setDeleting("");
      if (method === "DELETE" && data?.messages.length === 1 && page > 1)
        setPage((p) => p - 1);
      else setRevision((r) => r + 1);
    } catch (reason) {
      setError(
        reason instanceof ApiError ? reason.message : "操作失败，请重试。",
      );
      setExpired(reason instanceof ApiError && reason.status === 401);
    } finally {
      setBusy("");
    }
  };
  return (
    <Dialog
      title="私人留言箱"
      eyebrow="LETTERS & LITTLE HELLOS"
      onClose={onClose}
      wide
      className="inbox-dialog"
    >
      <div className="inbox-toolbar">
        <span>
          {data
            ? `${data.total} 条留言 · ${data.unread} 条未读`
            : "仅管理员可见"}
        </span>
        <button
          className="text-button"
          disabled={loading}
          onClick={() => setRevision((r) => r + 1)}
        >
          <RefreshCw size={14} />
          刷新
        </button>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
          {expired && (
            <button className="text-button" onClick={onLogin}>
              重新登录
            </button>
          )}
        </div>
      )}
      {loading && (
        <p className="inbox-loading" role="status">
          正在打开留言箱…
        </p>
      )}
      {!loading && !error && !data?.messages.length && (
        <Empty>
          <MessageSquare size={27} />
          <p>还没有留言，等一句新的你好。</p>
        </Empty>
      )}
      {!expired &&
        data?.messages.map((message) => (
          <article
            key={message.id}
            className={`inbox-message ${message.read ? "" : "unread"}`}
          >
            <header>
              <h3>
                {!message.read && <i aria-label="未读" />}
                {message.name}
              </h3>
              <time dateTime={message.createdAt}>
                {new Intl.DateTimeFormat("zh-CN", {
                  timeZone: "Australia/Sydney",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(message.createdAt))}
              </time>
            </header>
            {message.email && (
              <a className="inbox-email" href={`mailto:${message.email}`}>
                <Mail size={13} />
                {message.email}
              </a>
            )}
            <p>{message.body}</p>
            <footer>
              <button
                className="text-button"
                disabled={Boolean(busy) || loading}
                onClick={() => void change(message.id, "PATCH", !message.read)}
              >
                {message.read ? "设为未读" : "标为已读"}
              </button>
              {deleting === message.id ? (
                <span>
                  <button
                    className="inbox-delete"
                    disabled={Boolean(busy)}
                    onClick={() => void change(message.id, "DELETE")}
                  >
                    确认删除
                  </button>
                  <button onClick={() => setDeleting("")}>取消</button>
                </span>
              ) : (
                <button
                  className="inbox-delete"
                  aria-label={`删除来自${message.name}的留言`}
                  disabled={Boolean(busy) || loading}
                  onClick={() => setDeleting(message.id)}
                >
                  <Trash2 size={14} />
                  删除
                </button>
              )}
            </footer>
          </article>
        ))}
      {data && data.total > data.pageSize && (
        <div className="inbox-pagination">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </button>
          <span>
            {page} / {Math.ceil(data.total / data.pageSize)}
          </span>
          <button
            disabled={page * data.pageSize >= data.total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </Dialog>
  );
}
