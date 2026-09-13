import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { request } from "./api";
import {
  contentSchema,
  type HomeContent,
  type HomeResponse,
  type VisitorState,
  type Stats,
  type AuthStatus,
} from "../../shared/model";
interface SiteStore {
  home: HomeResponse | null;
  content: HomeContent | null;
  auth: AuthStatus | null;
  stats: Stats | null;
  loading: boolean;
  error: string;
  toast: string;
  editing: boolean;
  dirty: boolean;
  saving: boolean;
  saveError: string;
  refresh: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  beginEdit: () => void;
  cancelEdit: () => Promise<void>;
  change: (fn: (content: HomeContent) => HomeContent) => void;
  save: () => Promise<void>;
  notify: (text: string) => void;
  checkin: () => Promise<void>;
  like: () => Promise<void>;
}
const Context = createContext<SiteStore>(null!);
export const useSite = () => useContext(Context);
export function SiteProvider({ children }: { children: ReactNode }) {
  const [home, setHome] = useState<HomeResponse | null>(null),
    [auth, setAuth] = useState<AuthStatus | null>(null),
    [stats, setStats] = useState<Stats | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [draft, setDraft] = useState<HomeContent | null>(null),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [toast, setToast] = useState("");
  const pageView = useRef(crypto.randomUUID());
  const mounted = useRef(true);
  const dirty =
    !!draft && JSON.stringify(draft) !== JSON.stringify(home?.content);
  const notify = (text: string) => setToast(text);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const refreshAuth = async () => {
    const state = await request<VisitorState>("/api/state");
    setAuth(state.auth);
    setStats(state.stats);
  };
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [h, state] = await Promise.all([
        request<HomeResponse>("/api/home"),
        request<VisitorState>("/api/state"),
      ]);
      if (!mounted.current) return;
      setHome(h);
      setAuth(state.auth);
      setStats(state.stats);
      if (!state.auth.authenticated && location.pathname !== "/login") {
        const counted = await request<Stats>("/api/visits", {
          method: "POST",
          body: JSON.stringify({ pageViewId: pageView.current }),
        });
        if (mounted.current) setStats(counted);
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = async () => {
    if (!draft || !home || saving) return;
    const validated = contentSchema.safeParse(draft);
    if (!validated.success) {
      setSaveError(`请检查内容：${validated.error.issues[0]?.message}`);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const result = await request<HomeResponse>("/api/home", {
        method: "PUT",
        body: JSON.stringify({
          revision: home.revision,
          content: validated.data,
        }),
      });
      setHome(result);
      setDraft(null);
      notify("修改已保存，首页已更新。");
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const cancelEdit = async () => {
    if (dirty && !window.confirm("放弃这次尚未保存的修改？")) return;
    setDraft(null);
    setSaveError("");
    try {
      setHome(await request<HomeResponse>("/api/home"));
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const checkin = async () => {
    const state = await request<Stats>("/api/checkin", { method: "POST" });
    setStats(state);
    notify("签到成功，今天也留下了一个小脚印。");
  };
  const like = async () => {
    if (!stats) return;
    const state = await request<Stats>("/api/likes", {
      method: "POST",
      body: JSON.stringify({ liked: !stats.liked }),
    });
    setStats(state);
  };
  return (
    <Context.Provider
      value={{
        home,
        content: draft || home?.content || null,
        auth,
        stats,
        loading,
        error,
        toast,
        editing: !!draft,
        dirty,
        saving,
        saveError,
        refresh,
        refreshAuth,
        beginEdit: () => {
          if (home && auth?.authenticated) {
            setDraft(structuredClone(home.content));
            setSaveError("");
          }
        },
        cancelEdit,
        change: (fn) => setDraft((c) => (c ? fn(c) : c)),
        save,
        notify,
        checkin,
        like,
      }}
    >
      {children}
    </Context.Provider>
  );
}
