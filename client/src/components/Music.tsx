import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Play,
  Pause,
  Music2,
  Volume2,
  Heart,
  Mail,
  ArrowUpRight,
  SkipBack,
  SkipForward,
  ListMusic,
  ListOrdered,
  Repeat,
  Repeat1,
  Shuffle,
} from "lucide-react";
import { useSite } from "../store";
import { mediaUrl } from "../../../shared/model";
import { Dialog, EditButton, Empty } from "./Common";
import { MusicCover } from "./MusicCover";
import {
  nextTrackId,
  parsePlaybackMode,
  playbackModes,
  type PlaybackMode,
} from "../playback";
function stored() {
  try {
    const value = JSON.parse(
      localStorage.getItem("hejia-homepage:audio") || "{}",
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
function usePlayer() {
  const { content } = useSite();
  const tracks = content?.tracks || [];
  const initial = useRef(stored());
  const audio = useRef<HTMLAudioElement>(null),
    source = useRef(""),
    restore = useRef(true),
    history = useRef<string[]>([]);
  const [id, setId] = useState<string>(
      typeof initial.current.id === "string" ? initial.current.id : "",
    ),
    [mode, setMode] = useState<PlaybackMode>(
      parsePlaybackMode(initial.current.mode),
    ),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [volume, setVolume] = useState<number>(
      Number.isFinite(initial.current.volume)
        ? Math.max(0, Math.min(1, initial.current.volume))
        : 0.4,
    ),
    [error, setError] = useState("");
  const wantPlay = useRef(false);
  const track = tracks.find((t) => t.id === id);
  useEffect(() => {
    if (!tracks.some((t) => t.id === id)) {
      wantPlay.current = false;
      setId(tracks[0]?.id || "");
      audio.current?.pause();
    }
  }, [tracks, id]);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const url = mediaUrl(track?.audioId);
    const key = `${track?.id || ""}:${url}`;
    if (source.current === key) return;
    a.pause();
    source.current = key;
    setTime(0);
    setDuration(0);
    setError("");
    if (url) {
      a.src = url;
      a.load();
    } else {
      a.removeAttribute("src");
      a.load();
    }
  }, [track?.id, track?.audioId]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "hejia-homepage:audio",
        JSON.stringify({ id, time, volume, mode }),
      );
    } catch {}
  }, [id, time, volume, mode]);
  const play = async () => {
    const a = audio.current;
    if (!a || !track) return;
    const requestedSource = source.current;
    try {
      setError("");
      wantPlay.current = true;
      await a.play();
    } catch (error) {
      if (
        source.current !== requestedSource ||
        (error instanceof DOMException && error.name === "AbortError")
      )
        return;
      wantPlay.current = false;
      setPlaying(false);
      setError("播放失败，请重试或更换歌曲。");
    }
  };
  const move = (next: string, autoplay: boolean, remember = true) => {
    if (!tracks.some((track) => track.id === next)) return;
    restore.current = false;
    wantPlay.current = autoplay;
    if (next === id) {
      if (audio.current) audio.current.currentTime = 0;
      setTime(0);
      if (autoplay) void play();
      return;
    }
    if (mode === "shuffle" && remember && id)
      history.current = [...history.current, id].slice(-100);
    setId(next);
  };
  const select = (next: string) => {
    if (next !== id) move(next, playing || wantPlay.current);
  };
  const step = (offset: number) => {
    if (mode === "shuffle" && offset < 0) {
      while (history.current.length) {
        const previous = history.current.pop()!;
        if (previous !== id && tracks.some((track) => track.id === previous)) {
          move(previous, playing || wantPlay.current, false);
          return;
        }
      }
    }
    const next = nextTrackId(
      tracks.map((track) => track.id),
      id,
      mode,
      offset < 0 ? "previous" : "next",
    );
    if (next) move(next, playing || wantPlay.current);
  };
  const retry = () => {
    if (!audio.current) return;
    wantPlay.current = true;
    audio.current.load();
  };
  const element = (
    <audio
      ref={audio}
      preload="metadata"
      loop={mode === "repeat-one"}
      onPlay={() => {
        wantPlay.current = false;
        setPlaying(true);
      }}
      onPause={() => setPlaying(false)}
      onTimeUpdate={() => setTime(audio.current?.currentTime || 0)}
      onLoadedMetadata={() => {
        const a = audio.current!;
        setDuration(Number.isFinite(a.duration) ? a.duration : 0);
        if (restore.current && track?.id === initial.current.id) {
          a.currentTime = Math.min(
            Number(initial.current.time) || 0,
            Math.max(0, a.duration - 0.1),
          );
        }
        restore.current = false;
        if (wantPlay.current) void play();
      }}
      onError={() => {
        if (track) {
          wantPlay.current = false;
          setPlaying(false);
          setError("音乐暂时无法加载。");
        }
      }}
      onEnded={() => {
        const next = nextTrackId(
          tracks.map((track) => track.id),
          id,
          mode,
        );
        if (next) move(next, true);
        else {
          wantPlay.current = false;
          setPlaying(false);
        }
      }}
    />
  );
  return {
    tracks,
    track,
    playing,
    time,
    duration,
    volume,
    mode,
    error,
    setVolume,
    setMode: (next: PlaybackMode) => {
      if (next !== mode) history.current = [];
      setMode(next);
    },
    toggle: () => {
      if (playing || wantPlay.current) {
        wantPlay.current = false;
        audio.current?.pause();
      } else void play();
    },
    seek: (n: number) => {
      if (audio.current && Number.isFinite(n)) {
        audio.current.currentTime = Math.max(0, Math.min(duration, n));
        setTime(audio.current.currentTime);
      }
    },
    select,
    step,
    retry,
    element,
  };
}
type Player = ReturnType<typeof usePlayer>;
const Context = createContext<Player>(null!);
export function MusicProvider({ children }: { children: ReactNode }) {
  const player = usePlayer();
  return (
    <Context.Provider value={player}>
      {player.element}
      {children}
    </Context.Provider>
  );
}
export function GithubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 1.7a10.3 10.3 0 0 0-3.26 20.07c.52.1.7-.23.7-.5v-1.92c-2.87.63-3.47-1.22-3.47-1.22-.47-1.19-1.15-1.5-1.15-1.5-.94-.64.07-.63.07-.63 1.04.07 1.58 1.06 1.58 1.06.92 1.58 2.41 1.12 3 .85.1-.66.36-1.12.66-1.38-2.29-.26-4.69-1.15-4.69-5.1 0-1.12.4-2.04 1.06-2.76-.1-.26-.46-1.3.1-2.72 0 0 .87-.28 2.83 1.06A9.8 9.8 0 0 1 12 6.66c.88 0 1.76.12 2.59.35 1.96-1.34 2.82-1.06 2.82-1.06.56 1.42.21 2.46.1 2.72.66.72 1.06 1.64 1.06 2.76 0 3.97-2.4 4.84-4.7 5.1.37.32.7.95.7 1.92v2.82c0 .27.18.6.71.5A10.3 10.3 0 0 0 12 1.7Z" />
    </svg>
  );
}
const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
function XiaohongshuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="3.5"
        width="21"
        height="17"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="800"
        fontSize="8"
        letterSpacing="-.5"
        fill="currentColor"
      >
        RED
      </text>
    </svg>
  );
}
function BilibiliIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m7 2 3 4m7-4-3 4" />
      <rect x="2" y="6" width="20" height="15" rx="3" />
      <path d="m7 11 1 3m9-3-1 3m-6 3 2 1 2-1" />
    </svg>
  );
}
export function SectionPlayer() {
  const p = useContext(Context);
  if (!p.track) return null;
  return (
    <div className="section-player" aria-label="正在听">
      <Music2 size={14} />
      <span title={p.track.title}>{p.track.title}</span>
      <button
        aria-label={
          p.error ? "重试播放音乐" : p.playing ? "暂停音乐" : "播放音乐"
        }
        onClick={p.error ? p.retry : p.toggle}
      >
        {p.playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      {p.error && <small role="alert">播放暂不可用</small>}
    </div>
  );
}
function PlaybackProgress({
  player: p,
  label = "播放进度",
}: {
  player: Player;
  label?: string;
}) {
  return (
    <>
      <input
        className="progress"
        aria-label={label}
        type="range"
        min="0"
        max={p.duration || 1}
        step=".1"
        value={p.time}
        disabled={!p.duration}
        onChange={(e) => p.seek(Number(e.target.value))}
        style={
          {
            "--progress": `${p.duration ? (p.time / p.duration) * 100 : 0}%`,
          } as React.CSSProperties
        }
      />
      <div className="time-label">
        <span>{timeLabel(p.time)}</span>
        <span>{timeLabel(p.duration)}</span>
      </div>
    </>
  );
}
const playbackModeIcons = {
  sequential: ListOrdered,
  "repeat-all": Repeat,
  "repeat-one": Repeat1,
  shuffle: Shuffle,
};
function PlaybackModeButton({
  player: p,
  compact = false,
}: {
  player: Player;
  compact?: boolean;
}) {
  const Icon = playbackModeIcons[p.mode];
  const index = playbackModes.findIndex((mode) => mode.value === p.mode);
  const label = playbackModes[index].label;
  const next = playbackModes[(index + 1) % playbackModes.length];
  return (
    <button
      type="button"
      className={`playback-mode ${compact ? "playback-mode-compact" : "playback-mode-field"}`}
      title={`${label} · 点击切换为${next.label}`}
      aria-label={`${compact ? "播放模式" : "音乐列表播放模式"}：${label}，点击切换为${next.label}`}
      onClick={() => p.setMode(next.value)}
    >
      <Icon size={17} aria-hidden="true" />
      {!compact && <span>{label}</span>}
      {!compact && <small>切换模式</small>}
    </button>
  );
}
function PlaylistDialog({ onClose }: { onClose: () => void }) {
  const p = useContext(Context);
  return (
    <Dialog
      title="音乐列表"
      eyebrow={`ON REPEAT / ${p.tracks.length} 首歌曲`}
      wide
      className="playlist-dialog"
      onClose={onClose}
    >
      {p.track ? (
        <>
          <aside className="playlist-current" aria-label="当前歌曲">
            <div className="playlist-current-summary">
              <MusicCover
                className="playlist-current-cover"
                coverId={p.track.coverId}
                audioId={p.track.audioId}
                alt={`${p.track.title || "当前歌曲"} 封面`}
              />
              <div>
                <span className="playlist-current-status">
                  {p.playing ? "正在播放" : "当前选择"}
                </span>
                <h3>{p.track.title || "未命名歌曲"}</h3>
                {p.track.artist && <p>{p.track.artist}</p>}
              </div>
            </div>
            <div className="playlist-controls">
              <button
                aria-label="上一首"
                disabled={p.tracks.length < 2}
                onClick={() => p.step(-1)}
              >
                <SkipBack size={20} />
              </button>
              <button
                className="play-button"
                aria-label={p.playing ? "暂停音乐" : "播放音乐"}
                onClick={p.toggle}
              >
                {p.playing ? (
                  <Pause size={20} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" />
                )}
              </button>
              <button
                aria-label="下一首"
                disabled={p.tracks.length < 2}
                onClick={() => p.step(1)}
              >
                <SkipForward size={20} />
              </button>
            </div>
            <PlaybackModeButton player={p} />
            <PlaybackProgress player={p} label="音乐列表播放进度" />
            {p.error && (
              <div className="audio-error" role="alert">
                {p.error}
                <button onClick={p.retry}>重试</button>
              </div>
            )}
          </aside>
          <ol className="playlist-list" aria-label="全部歌曲">
            {p.tracks.map((track, index) => (
              <li key={track.id}>
                <button
                  className="playlist-track"
                  aria-label={`切换到 ${track.title || "未命名歌曲"}`}
                  aria-pressed={p.track?.id === track.id}
                  onClick={() => p.select(track.id)}
                >
                  <span className="playlist-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <MusicCover
                    className="playlist-track-cover"
                    coverId={track.coverId}
                    audioId={track.audioId}
                    alt=""
                  />
                  <span className="playlist-track-info">
                    <strong>{track.title || "未命名歌曲"}</strong>
                    {track.artist && <small>{track.artist}</small>}
                  </span>
                  {p.track?.id === track.id && (
                    <span className="playlist-track-status">
                      {p.playing ? "播放中" : "已选择"}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <Empty>
          <Music2 size={32} />
          还没有歌曲，添加音乐后就会显示在这里。
        </Empty>
      )}
    </Dialog>
  );
}
export function MusicCard({
  onEdit,
  onContact,
}: {
  onEdit: () => void;
  onContact: () => void;
}) {
  const p = useContext(Context);
  const { content, stats, like, notify } = useSite();
  const [liking, setLiking] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const volumeOptions = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeVolume = (event: PointerEvent) => {
      const options = volumeOptions.current;
      if (
        options?.open &&
        event.target instanceof Node &&
        !options.contains(event.target)
      )
        options.open = false;
    };
    document.addEventListener("pointerdown", closeVolume);
    return () => document.removeEventListener("pointerdown", closeVolume);
  }, []);
  return (
    <section className="card music-card" aria-label="音乐与联系">
      <div className="music-heading">
        <Music2 size={25} />
        <div>
          <span className="eyebrow">ON REPEAT</span>
          <h2>此刻的旋律</h2>
        </div>
        <div className="music-actions">
          <EditButton onClick={onEdit} label="编辑音乐" />
          <PlaybackModeButton player={p} compact />
          <details
            ref={volumeOptions}
            className="player-options"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.currentTarget.open = false;
                e.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-label="调整音量" title="调整音量">
              <Volume2 size={17} />
            </summary>
            <div className="player-popover">
              <label>
                音量
                <input
                  aria-label="音量"
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={p.volume}
                  onChange={(e) => p.setVolume(Number(e.target.value))}
                />
                <span className="volume-value">
                  {Math.round(p.volume * 100)}%
                </span>
              </label>
            </div>
          </details>
          <button
            className="playlist-open"
            aria-label="打开音乐列表"
            title="音乐列表"
            aria-haspopup="dialog"
            onClick={() => {
              if (volumeOptions.current) volumeOptions.current.open = false;
              setPlaylistOpen(true);
            }}
          >
            <ListMusic size={18} />
          </button>
        </div>
      </div>
      <div className="music-player">
        <MusicCover
          className="album-cover"
          coverId={p.track?.coverId}
          audioId={p.track?.audioId}
          alt={p.track ? `${p.track.title} 封面` : "音乐封面"}
        />
        <div className="music-info">
          <strong>{p.track?.title || "等一首喜欢的歌"}</strong>
          <small>{p.track?.artist || "登录后添加音乐"}</small>
          <PlaybackProgress player={p} />
        </div>
        <button
          className="play-button"
          aria-label={p.playing ? "暂停音乐" : "播放音乐"}
          disabled={!p.track}
          onClick={p.toggle}
        >
          {p.playing ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
        </button>
      </div>
      {p.error && (
        <div className="audio-error" role="alert">
          {p.error}
          <button onClick={p.retry}>重试</button>
        </div>
      )}
      <div className="social-row">
        {content?.social.github ? (
          <a
            className="social-link"
            href={content.social.github}
            target="_blank"
            rel="noreferrer"
          >
            <GithubIcon />
            <span>GitHub</span>
          </a>
        ) : (
          <button className="social-link" onClick={onContact}>
            <GithubIcon />
            <span>GitHub</span>
          </button>
        )}
        {content?.social.email ? (
          <a className="social-link" href={`mailto:${content.social.email}`}>
            <Mail size={18} />
            <span>Email</span>
          </a>
        ) : (
          <button className="social-link" onClick={onContact}>
            <Mail size={18} />
            <span>Email</span>
          </button>
        )}
        {content?.social.xiaohongshu ? (
          <a
            className="social-link xiaohongshu-link"
            href={content.social.xiaohongshu}
            target="_blank"
            rel="noreferrer"
          >
            <XiaohongshuIcon />
            <span>小红书</span>
          </a>
        ) : (
          <button
            className="social-link xiaohongshu-link"
            onClick={() => notify("小红书主页暂未公开。")}
          >
            <XiaohongshuIcon />
            <span>小红书</span>
          </button>
        )}
        {content?.social.bilibili ? (
          <a
            className="social-link bilibili-link"
            href={content.social.bilibili}
            target="_blank"
            rel="noreferrer"
          >
            <BilibiliIcon />
            <span>Bilibili</span>
          </a>
        ) : (
          <button
            className="social-link bilibili-link"
            onClick={() => notify("Bilibili 主页暂未公开。")}
          >
            <BilibiliIcon />
            <span>Bilibili</span>
          </button>
        )}
        <button
          className={`like-button ${stats?.liked ? "liked" : ""}`}
          aria-label={stats?.liked ? "取消喜欢" : "喜欢这个网站"}
          aria-pressed={stats?.liked || false}
          aria-describedby="site-like-count"
          title={
            stats
              ? `${stats.likeCount.toLocaleString("zh-CN")} 人喜欢`
              : "正在加载点赞数"
          }
          disabled={liking || !stats}
          onClick={async () => {
            setLiking(true);
            try {
              await like();
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setLiking(false);
            }
          }}
        >
          <Heart size={18} fill={stats?.liked ? "currentColor" : "none"} />
          <span
            id="site-like-count"
            className="like-count"
            aria-live="polite"
            aria-atomic="true"
          >
            {stats
              ? new Intl.NumberFormat("zh-CN", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(stats.likeCount)
              : "—"}
          </span>
        </button>
      </div>
      {playlistOpen && (
        <PlaylistDialog onClose={() => setPlaylistOpen(false)} />
      )}
    </section>
  );
}
