import { ArrowUpRight, Check, Flower2, Heart, MoonStar } from "lucide-react";
import { useSite } from "../store";
import { Dialog } from "./Common";
import type { SiteTheme } from "../../../shared/model";

const themes = [
  {
    id: "fresh",
    title: "清新绿",
    subtitle: "一座慢慢生长的数字花园",
    detail: "自然留白 · 哑光纸感 · 轻盈日常",
    icon: Flower2,
  },
  {
    id: "blush",
    title: "卡通粉",
    subtitle: "和猫咪一起，收藏可爱的日常",
    detail: "圆润文字 · 猫咪贴纸 · 彩色卡片",
    icon: Heart,
  },
  {
    id: "midnight",
    title: "午夜紫",
    subtitle: "夜深了，也有温柔的光",
    detail: "深色磨砂 · 细线面板 · 星轨微光",
    icon: MoonStar,
  },
] satisfies Array<{
  id: SiteTheme;
  title: string;
  subtitle: string;
  detail: string;
  icon: typeof Heart;
}>;

export function ThemePicker({ onClose }: { onClose: () => void }) {
  const { content, setTheme, saving, auth } = useSite();
  const selected = content?.theme || "fresh";
  return (
    <Dialog
      title="更换主题"
      eyebrow="A LITTLE CHANGE OF MOOD"
      wide
      className="theme-dialog"
      onClose={onClose}
    >
      <p className="theme-intro">同一个小世界，换一种喜欢的样子。</p>
      <div className="theme-options" aria-label="网站主题">
        {themes.map(({ id, title, subtitle, detail, icon: Icon }) => (
          <button
            key={id}
            className="theme-option"
            data-theme-option={id}
            aria-label={`选择${title}主题`}
            aria-pressed={selected === id}
            disabled={saving || !auth?.authenticated}
            onClick={() => setTheme(id)}
          >
            <div className="theme-thumbnail" aria-hidden="true">
              <div className="theme-thumb-header">
                <strong>momo.</strong>
                <span>···</span>
              </div>
              <div className="theme-thumb-grid">
                <div className="theme-thumb-hero">
                  <Icon size={24} />
                  <span />
                  <span />
                </div>
                <div className="theme-thumb-photo">
                  <i />
                </div>
                <div className="theme-thumb-clock">
                  12:08<small>A LITTLE MOMENT</small>
                </div>
                <div className="theme-thumb-notes">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="theme-thumb-calendar">
                  S M T W T F S<small>· · · · · · ·</small>
                </div>
                <div className="theme-thumb-music">
                  ♫<span />
                </div>
              </div>
              <span className="theme-thumb-star">✦</span>
            </div>
            <span className="theme-option-name">
              <Icon size={18} />
              <strong>{title}</strong>
              {selected === id && <Check size={17} />}
            </span>
            <span className="theme-option-subtitle">{subtitle}</span>
            <span className="theme-option-detail">{detail}</span>
          </button>
        ))}
      </div>
      <div className="theme-dialog-footer">
        <p>
          点击主题即可试穿。返回页面预览后，点击底部「保存修改」，访客也会看到你选中的主题。
        </p>
        <button className="button dark" onClick={onClose}>
          返回页面预览
          <ArrowUpRight size={16} />
        </button>
      </div>
    </Dialog>
  );
}
