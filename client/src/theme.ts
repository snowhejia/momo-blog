import { useLayoutEffect } from "react";
import type { SiteTheme } from "../../shared/model";

const themeColors: Record<SiteTheme, string> = {
  fresh: "#f7f6f2",
  blush: "#fff6ee",
  midnight: "#12151f",
};

export function themeCatAsset(theme: SiteTheme = "fresh") {
  return theme === "blush"
    ? "/assets/themes/cartoon-cat.svg"
    : "/assets/cat.svg";
}

export function useSiteTheme(theme: SiteTheme = "fresh") {
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme =
      theme === "midnight" ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColors[theme]);
  }, [theme]);
}
