import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { Dialog, Cat } from "./Common";
import { useSite } from "../store";
import { request } from "../api";
export function LoginDialog({ onClose }: { onClose: () => void }) {
  const { auth, refreshAuth, notify } = useSite();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [token, setToken] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const setup = auth?.initialized === false;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      if (setup)
        await request("/api/setup", {
          method: "POST",
          body: JSON.stringify({ token, email, password }),
        });
      await request("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refreshAuth();
      notify("已登录，可以直接编辑首页。");
      onClose();
    } catch (e) {
      setError((e as Error).message);
      await refreshAuth().catch(() => {});
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      title={setup ? "创建你的管理员账号" : "欢迎回来。"}
      eyebrow="YOUR PERSONAL SPACE"
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form className="auth-form" onSubmit={submit}>
        <Cat />
        <p>
          {setup
            ? "只需初始化一次，之后登录即可在首页修改内容。"
            : "登录后，点击页面顶部的「编辑页面」。"}
        </p>
        {setup && (
          <label>
            初始化令牌
            <input
              aria-label="初始化令牌"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoComplete="off"
            />
            <small>
              在此项目的 data/setup-token.txt 中查看，仅保存在你的电脑上。
            </small>
          </label>
        )}
        <label>
          邮箱
          <input
            type="email"
            aria-label="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          密码
          <input
            type="password"
            aria-label="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            autoComplete={setup ? "new-password" : "current-password"}
          />
          {setup && <small>至少 12 位字符。</small>}
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="button dark" disabled={pending || !auth}>
          {pending ? "请稍候…" : setup ? "创建并登录" : "登录"}
          <ArrowUpRight size={16} />
        </button>
      </form>
    </Dialog>
  );
}
export function AdminBar({
  onLogin,
  onMessages,
}: {
  onLogin: () => void;
  onMessages: () => void;
}) {
  const {
    auth,
    editing,
    dirty,
    saving,
    saveError,
    beginEdit,
    save,
    cancelEdit,
    refreshAuth,
    notify,
  } = useSite();
  if (!auth?.authenticated && !editing) return null;
  return (
    <div className={`admin-bar ${saveError ? "has-error" : ""}`}>
      <div className="admin-bar-main">
        <span>
          <span className="green-dot" />
          {editing
            ? dirty
              ? "有尚未保存的修改"
              : "正在编辑首页"
            : "管理员已登录"}
        </span>
        <div>
          {editing ? (
            <>
              <button onClick={() => void cancelEdit()} disabled={saving}>
                取消
              </button>
              <button
                className="admin-save"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "保存中…" : "保存修改"}
                <Check size={14} />
              </button>
              {saveError.includes("登录") && (
                <button onClick={onLogin}>重新登录</button>
              )}
            </>
          ) : (
            <>
              <button onClick={onMessages}>留言箱</button>
              <button className="admin-save" onClick={beginEdit}>
                编辑页面
              </button>
              <button
                onClick={async () => {
                  try {
                    await request("/api/auth/sign-out", {
                      method: "POST",
                      body: "{}",
                    });
                    await refreshAuth();
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                退出登录
              </button>
            </>
          )}
        </div>
      </div>
      {saveError && (
        <div className="save-error" role="alert">
          {saveError}
        </div>
      )}
    </div>
  );
}
