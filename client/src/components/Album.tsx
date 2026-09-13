import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Maximize2,
} from "lucide-react";
import { mediaUrl, type HomeContent } from "../../../shared/model";
import { useSite } from "../store";
import { Empty, SafeImage } from "./Common";

type Photo = HomeContent["photos"][number];

function PhotoWall({
  photos,
  onOpen,
  wallRef,
}: {
  photos: Photo[];
  onOpen: (id: string) => void;
  wallRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [size, setSize] = useState({ width: 0, columns: 4, gap: 18 });
  useLayoutEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const observer = new ResizeObserver(() => {
      const width = wall.clientWidth;
      if (!width) return;
      const styles = getComputedStyle(wall);
      const columns = Number(styles.getPropertyValue("--album-columns"));
      const gap = Number.parseFloat(styles.getPropertyValue("--album-gap"));
      setSize((previous) =>
        previous.width === width &&
        previous.columns === columns &&
        previous.gap === gap
          ? previous
          : { width, columns, gap },
      );
    });
    observer.observe(wall);
    return () => observer.disconnect();
  }, [wallRef]);

  const columnWidth =
    (size.width - size.gap * (size.columns - 1)) / size.columns;
  const bottoms = Array<number>(size.columns).fill(0);
  const tiles = photos.map((photo, index) => {
    const featured = index === 0;
    const span = featured ? Math.min(2, size.columns) : 1;
    let column = 0;
    let top = Number.POSITIVE_INFINITY;
    // Place each card in the shortest available column, including the wide lead photo.
    for (let start = 0; start <= size.columns - span; start++) {
      const candidate = Math.max(...bottoms.slice(start, start + span));
      if (candidate < top) {
        column = start;
        top = candidate;
      }
    }
    const width = columnWidth * span + size.gap * (span - 1);
    const ratio = featured
      ? size.columns > 2
        ? 1.23
        : 1.4
      : [1.25, 1.5, 0.86, 1.1, 1.35, 0.8][index % 6];
    const height = Math.round(width / ratio) + (size.columns > 2 ? 70 : 62);
    for (let i = column; i < column + span; i++)
      bottoms[i] = top + height + size.gap;
    return {
      photo,
      index,
      featured,
      width,
      height,
      top,
      left: column * (columnWidth + size.gap),
    };
  });
  return (
    <div
      ref={wallRef}
      className="album-wall"
      data-layout={size.width ? "ready" : "pending"}
      style={
        size.width ? { height: Math.max(0, ...bottoms) - size.gap } : undefined
      }
    >
      {tiles.map(({ photo, index, featured, ...position }) => (
        <button
          key={photo.id}
          className={`album-tile ${featured ? "album-featured" : ""}`}
          style={size.width ? position : undefined}
          data-photo-id={photo.id}
          aria-label={`查看照片：${photo.title}`}
          onClick={() => onOpen(photo.id)}
        >
          <span className="album-tile-image">
            <SafeImage src={mediaUrl(photo.mediaId)} alt="" />
            {featured && (
              <span className="album-featured-label">
                <i /> IN THE FRAME
              </span>
            )}
            <span className="album-expand" aria-hidden="true">
              <Maximize2 size={16} />
            </span>
            <span className="album-photo-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
          </span>
          <span className="album-tile-caption">
            <span>
              <strong>{photo.title || "未命名的片刻"}</strong>
              <small>
                {photo.location ? (
                  <>
                    <MapPin size={10} />
                    {photo.location}
                  </>
                ) : (
                  photo.caption || "日常切片"
                )}
                {photo.demo && <span> · 示例</span>}
              </small>
            </span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  );
}

export function Album({
  id,
  onSelect,
}: {
  id?: string;
  onSelect: (id: string) => void;
}) {
  const { content } = useSite();
  const photos = content!.photos;
  const photo = photos.find((p) => p.id === id);
  const at = photos.findIndex((p) => p.id === id);
  const wall = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const galleryPosition = useRef(0);
  const opener = useRef("");
  const previous = useRef<string | undefined>(undefined);
  const photoId = photo?.id;

  useLayoutEffect(() => {
    const main = wall.current?.closest("main");
    const wasOpen = Boolean(previous.current);
    if (photoId && !wasOpen) {
      main?.scrollTo({ top: 0 });
      viewer.current?.focus({ preventScroll: true });
    } else if (!photoId && wasOpen) {
      main?.scrollTo({ top: galleryPosition.current });
      const trigger = [
        ...(wall.current?.querySelectorAll<HTMLButtonElement>("button") || []),
      ].find((button) => button.dataset.photoId === opener.current);
      trigger?.focus({ preventScroll: true });
    }
    previous.current = photoId;
  }, [photoId]);

  const openPhoto = (next: string) => {
    galleryPosition.current = wall.current?.closest("main")?.scrollTop || 0;
    opener.current = next;
    onSelect(next);
  };

  const move = (delta: number) => {
    if (photos.length)
      onSelect(photos[(at + delta + photos.length) % photos.length].id);
  };
  useEffect(() => {
    if (!photoId) return;
    const key = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        document.querySelector("dialog[open]") ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            "input,textarea,select,[contenteditable=true],nav",
          ))
      )
        return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onSelect("");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [photoId, at, photos, onSelect]);

  return (
    <>
      <section
        className="album-gallery"
        hidden={Boolean(photo)}
        aria-label="照片墙"
      >
        {photos.length ? (
          <PhotoWall photos={photos} onOpen={openPhoto} wallRef={wall} />
        ) : (
          <Empty>相册还空着，期待下一张喜欢的照片。</Empty>
        )}
      </section>
      {photo && (
        <div
          ref={viewer}
          className="album-detail"
          tabIndex={-1}
          aria-label="照片大图"
        >
          <div className="album-detail-toolbar">
            <button className="text-button" onClick={() => onSelect("")}>
              <ArrowLeft size={16} />
              返回照片墙
            </button>
            <span>
              ← → 切换<span> · ESC 返回</span>
            </span>
          </div>
          <div className="photo-viewer">
            <div className="photo-stage">
              <SafeImage src={mediaUrl(photo.mediaId)} alt={photo.title} />
              <button
                className="photo-prev"
                aria-label="上一张照片"
                onClick={() => move(-1)}
                disabled={photos.length < 2}
              >
                <ChevronLeft />
              </button>
              <button
                className="photo-next"
                aria-label="下一张照片"
                onClick={() => move(1)}
                disabled={photos.length < 2}
              >
                <ChevronRight />
              </button>
            </div>
            <div className="photo-details">
              <div className="photo-meta" aria-live="polite">
                <div>
                  <h3>{photo.title}</h3>
                  <p>{photo.caption}</p>
                  <small>
                    {photo.location}
                    {photo.demo ? " · 示例素材" : ""}
                  </small>
                </div>
                <span>
                  {at + 1} / {photos.length}
                </span>
              </div>
              {photo.source && (
                <p className="source-line">来源：{photo.source}</p>
              )}
              <div className="photo-thumbnails">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    aria-label={`查看照片：${p.title}`}
                    aria-pressed={p.id === photo.id}
                  >
                    <SafeImage src={mediaUrl(p.mediaId, true)} alt={p.title} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
