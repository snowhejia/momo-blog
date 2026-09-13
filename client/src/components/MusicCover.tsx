import { useState } from "react";
import { mediaUrl } from "../../../shared/model";

export function MusicCover({
  coverId,
  audioId,
  alt = "音乐封面",
  className = "",
}: {
  coverId?: string | null;
  audioId?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = [mediaUrl(coverId, true), mediaUrl(audioId, true)].find(
    (url) => url && !failed.includes(url),
  );
  if (src)
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onError={() => setFailed((urls) => [...urls, src])}
      />
    );
  return (
    <svg
      className={`default-music-cover ${className}`}
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${alt}（默认唱片封面）`}
    >
      <rect width="200" height="200" fill="#eeeee5" />
      <path
        d="M16 30V16h14M170 184h14v-14"
        fill="none"
        stroke="#bcc2ad"
        strokeWidth="2"
      />
      <circle cx="100" cy="100" r="75" fill="#20221e" />
      <g fill="none" stroke="#45483f" strokeWidth="1">
        <circle cx="100" cy="100" r="64" />
        <circle cx="100" cy="100" r="55" />
        <circle cx="100" cy="100" r="45" />
      </g>
      <circle cx="100" cy="100" r="29" fill="var(--lime, #d4f36e)" />
      <circle cx="100" cy="100" r="5" fill="#20221e" />
      <path
        d="M51 66a60 60 0 0 1 29-23M58 73a50 50 0 0 1 23-20"
        fill="none"
        stroke="#676c5c"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="176" cy="24" r="6" fill="var(--lime, #d4f36e)" />
    </svg>
  );
}
