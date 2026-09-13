import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ImageOff, Pencil, ArrowUpRight } from "lucide-react";
import { useSite } from "../store";
import type { HomeContent } from "../../../shared/model";
export function Cat({ className = "" }: { className?: string }) {
  return (
    <img
      src="/assets/cat.svg"
      alt="像素猫标志"
      className={`cat ${className}`}
    />
  );
}
export function SafeImage({
  src,
  alt,
  className = "",
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return failed || !src ? (
    <div className={`image-fallback ${className}`}>
      <ImageOff size={20} />
      <span>{src ? "图片暂不可用" : "等待新的画面"}</span>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      onClick={onClick}
    />
  );
}
export function Dialog({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""} ${className}`}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const items = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex]:not([tabindex="-1"])',
          ),
        ].filter((el) => el.getClientRects().length > 0);
        const first = items[0],
          last = items.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !items.includes(document.activeElement as HTMLElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !items.includes(document.activeElement as HTMLElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const b = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < b.left ||
          e.clientX > b.right ||
          e.clientY < b.top ||
          e.clientY > b.bottom
        )
          onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-head">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="icon-button close-button"
          aria-label="关闭面板"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function EditButton({
  onClick,
  label = "编辑内容",
}: {
  onClick: () => void;
  label?: string;
}) {
  const { editing } = useSite();
  return editing ? (
    <button className="edit-trigger" onClick={onClick} aria-label={label}>
      <Pencil size={13} />
      <span>编辑</span>
    </button>
  ) : null;
}
export function Editable({
  field,
  as: Tag = "p",
  className = "",
}: {
  field: keyof HomeContent["profile"];
  as?: "p" | "span" | "h1";
  className?: string;
}) {
  const { editing, content, change } = useSite();
  const value = String(content?.profile[field] || "");
  return editing ? (
    <textarea
      className={`inline-edit ${className}`}
      aria-label={`编辑${({ headline: "首页标题", introduction: "个人介绍", description: "首页描述", eyebrow: "顶部标签", motto: "页脚寄语", name: "名字" } as Record<string, string>)[field] || field}`}
      rows={field === "headline" ? 2 : 1}
      value={value}
      onChange={(e) =>
        change((c) => ({
          ...c,
          profile: { ...c.profile, [field]: e.target.value },
        }))
      }
    />
  ) : (
    <Tag className={className}>
      {field === "headline" ? (
        <>
          <span className="headline-primary">{value.split("\n")[0]}</span>
          {value.includes("\n") && (
            <span className="headline-secondary">
              {value.split("\n").slice(1).join(" ")}
            </span>
          )}
        </>
      ) : (
        value
      )}
    </Tag>
  );
}
export function ArrowLink({
  children,
  onClick,
}: {
  children?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-content">{children}</div>;
}
