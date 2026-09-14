import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useSite } from "./store";
import { sydneyDay } from "../../shared/model";
import { Cat, Editable } from "./components/Common";
import {
  Hero,
  PhotoCard,
  ClockCard,
  ProjectCard,
  ArticleCard,
  CalendarCard,
  CheckinCard,
  CollectionCard,
  useClock,
  type Panel,
} from "./components/HomeCards";
import { MusicCard, SectionPlayer } from "./components/Music";
import { AdminBar, LoginDialog } from "./components/Auth";
import { Editor, type EditorSection } from "./components/Editor";
import { ContentDialog, ContentPage } from "./components/Drawers";
import { InboxDialog } from "./components/Contact";
import {
  usePageNavigation,
  pageUrl,
  sectionNames,
  type Page,
  type Section,
} from "./navigation";
export default function App() {
  const { content, loading, error, refresh, toast, auth, refreshAuth } =
    useSite();
  const [panel, setPanel] = useState<{ kind: Panel; id?: string } | null>(null),
    [editor, setEditor] = useState<EditorSection | null>(null),
    [login, setLogin] = useState(location.pathname === "/login");
  const route = usePageNavigation();
  const [inbox, setInbox] = useState(false);
  const main = useRef<HTMLElement>(null);
  const previousRoute = useRef({ page: route.page, id: route.id });
  const now = useClock();
  const day = sydneyDay(now);
  const lastDay = useRef(day);
  useEffect(() => {
    if (lastDay.current !== day) {
      lastDay.current = day;
      void refreshAuth();
    }
  }, [day]);
  useEffect(() => {
    const previous = previousRoute.current;
    const changedPage = previous.page !== route.page;
    const changedDetail =
      previous.id !== route.id &&
      (route.page === "projects" ||
        route.page === "articles" ||
        route.page === "collections");
    previousRoute.current = { page: route.page, id: route.id };
    if (changedPage || changedDetail) {
      main.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    }
    setPanel(null);
    if (content) {
      document.title = `${route.page === "home" ? "首页" : sectionNames[route.page]} · ${content.profile.name}`;
      if (changedPage || changedDetail)
        main.current?.focus({ preventScroll: true });
    }
  }, [route.page, route.id, content?.profile.name]);
  const open = (kind: Panel, id?: string) => {
    if (Object.hasOwn(sectionNames, kind)) route.navigate(kind as Section, id);
    else setPanel({ kind, id });
  };
  const actions = { open, edit: setEditor };
  if (!content)
    return (
      <div className="loading-page">
        <Cat />
        <h1>{error ? "暂时没有连接上首页。" : "正在打开这个小小的空间。"}</h1>
        <p>{error || "稍等一下，好奇心正在就位。"}</p>
        {error && (
          <button className="button dark" onClick={() => void refresh()}>
            重新加载
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    );
  return (
    <>
      <a className="skip-link" href="#main">
        跳到页面内容
      </a>
      <div
        className={`site-shell ${route.page !== "home" ? "section-shell" : ""} ${auth?.authenticated ? "with-admin" : ""}`}
      >
        <AdminBar
          onLogin={() => setLogin(true)}
          onMessages={() => setInbox(true)}
        />
        <header className="site-header">
          <a
            className="brand"
            aria-label={`${content.profile.name} 首页`}
            href="/"
            onClick={(event) => route.follow(event, "home")}
          >
            <Cat />
            <span>
              {content.profile.name.toLowerCase()}
              <i>.</i>
            </span>
          </a>
          <nav aria-label="主导航">
            {(["home", ...Object.keys(sectionNames)] as Page[]).map((page) => (
              <a
                key={page}
                href={pageUrl(page)}
                className={route.page === page ? "active" : ""}
                aria-current={route.page === page ? "page" : undefined}
                onClick={(event) => route.follow(event, page)}
              >
                {page === "home" ? "首页" : sectionNames[page]}
              </a>
            ))}
          </nav>
          <div className="header-contact">
            <span>
              <i />
              SYDNEY, AU
            </span>
            <button className="button dark" onClick={() => open("contact")}>
              聊聊
              <ArrowUpRight size={16} />
            </button>
          </div>
        </header>
        <main
          ref={main}
          id="main"
          tabIndex={-1}
          className={
            route.page === "home"
              ? "bento-grid"
              : `section-page section-${route.page}`
          }
        >
          {route.page === "home" ? (
            <>
              <div className="bento-row top-row">
                <Hero {...actions} />
                <PhotoCard {...actions} />
                <ClockCard now={now} />
              </div>
              <div className="bento-row middle-row">
                <ProjectCard {...actions} />
                <ArticleCard {...actions} />
                <CalendarCard now={now} />
              </div>
              <div className="bento-row bottom-row">
                <CheckinCard />
                <CollectionCard {...actions} />
                <MusicCard
                  onEdit={() => setEditor("tracks")}
                  onContact={() => open("contact")}
                />
              </div>
            </>
          ) : (
            <ContentPage
              key={route.page}
              panel={route.page}
              id={route.id}
              onSelect={(id) => route.navigate(route.page, id)}
              onEdit={() => setEditor(route.page as Section)}
            />
          )}
        </main>
        <footer className="site-footer">
          <span>
            © {now.getFullYear()} {content.profile.name}
          </span>
          {route.page !== "home" && <SectionPlayer />}
          <div>
            <button onClick={() => open("sources")}>素材说明</button>
            <button onClick={() => setLogin(true)}>
              {auth?.authenticated ? "管理员" : "管理"}
            </button>
            <Editable field="motto" as="span" className="footer-motto" />
            <span className="footer-star">✳</span>
          </div>
        </footer>
      </div>
      {panel && (
        <ContentDialog
          key={`${panel.kind}:${panel.id}`}
          panel={panel.kind}
          id={panel.id}
          onClose={() => setPanel(null)}
        />
      )}{" "}
      {editor && (
        <Editor key={editor} section={editor} onClose={() => setEditor(null)} />
      )}{" "}
      {inbox && auth?.authenticated && (
        <InboxDialog
          onClose={() => setInbox(false)}
          onLogin={() => {
            setInbox(false);
            setLogin(true);
          }}
        />
      )}
      {login && (
        <LoginDialog
          onClose={() => {
            setLogin(false);
            if (location.pathname === "/login")
              history.replaceState(null, "", "/");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Cat />
          {toast}
        </div>
      )}
      {loading && (
        <span className="refresh-indicator" role="status">
          正在更新…
        </span>
      )}
    </>
  );
}
