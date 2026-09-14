import { useEffect, useState, type MouseEvent } from "react";

export const sectionNames = {
  projects: "项目",
  articles: "文字",
  photos: "相册",
  collections: "收集",
} as const;
export type Section = keyof typeof sectionNames;
export type Page = "home" | Section;

function readRoute(): { page: Page; id?: string } {
  const path = location.pathname.replace(/^\/+|\/+$/g, "");
  return {
    page: Object.hasOwn(sectionNames, path) ? (path as Section) : "home",
    id: new URLSearchParams(location.search).get("item") || undefined,
  };
}

export function pageUrl(page: Page, id?: string) {
  return `${page === "home" ? "/" : `/${page}`}${id ? `?${new URLSearchParams({ item: id })}` : ""}`;
}

// Keep the application and its single audio player mounted between sections.
export function usePageNavigation() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const navigate = (page: Page, id?: string) => {
    const url = pageUrl(page, id);
    if (`${location.pathname}${location.search}` !== url)
      history.pushState(null, "", url);
    setRoute({ page, id });
    if (
      !id ||
      route.page !== page ||
      page === "projects" ||
      page === "articles" ||
      page === "collections"
    ) {
      document.getElementById("main")?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  };
  const follow = (event: MouseEvent<HTMLAnchorElement>, page: Page) => {
    if (
      event.button ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(page);
  };
  return { ...route, navigate, follow };
}
