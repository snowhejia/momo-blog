import { ArrowUpRight, Link2 } from "lucide-react";
import { useSite } from "../store";
import { mediaUrl } from "../../../shared/model";
import { SafeImage } from "./Common";

function destination(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

export function Friends() {
  const { content } = useSite();
  const friends = content!.friends;
  if (!friends.length)
    return (
      <div className="friends-empty">
        <span className="friends-empty-icon" aria-hidden="true">
          <Link2 size={26} />
        </span>
        <h2>给朋友留个位置</h2>
        <p>这里会慢慢收集朋友们的网站。下一次来，也许就有新的相遇。</p>
      </div>
    );

  return (
    <div className="friends-grid">
      {friends.map((friend) => {
        const url = destination(friend.url);
        return (
          <a
            key={friend.id}
            className="friend-card"
            href={url?.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${friend.title}（在新标签页打开）`}
            aria-disabled={!url || undefined}
          >
            <div className="friend-card-top">
              {friend.avatarId ? (
                <SafeImage
                  className="friend-avatar"
                  src={mediaUrl(friend.avatarId, true)}
                  alt=""
                />
              ) : (
                <span
                  className="friend-avatar friend-monogram"
                  aria-hidden="true"
                >
                  {Array.from(friend.title.trim())[0]?.toUpperCase() || "✳"}
                </span>
              )}
              <ArrowUpRight size={19} aria-hidden="true" />
            </div>
            <h2>{friend.title || "新的朋友"}</h2>
            {friend.description && <p>{friend.description}</p>}
            <span className="friend-domain">
              <Link2 size={13} aria-hidden="true" />
              {url ? url.hostname.replace(/^www\./, "") : "等待填写网站链接"}
            </span>
          </a>
        );
      })}
    </div>
  );
}
