export const playbackModes = [
  { value: "sequential", label: "顺序播放" },
  { value: "repeat-all", label: "列表循环" },
  { value: "repeat-one", label: "单曲循环" },
  { value: "shuffle", label: "随机播放" },
] as const;

export type PlaybackMode = (typeof playbackModes)[number]["value"];

export function parsePlaybackMode(value: unknown): PlaybackMode {
  return (
    playbackModes.find((mode) => mode.value === value)?.value ?? "sequential"
  );
}

export function nextTrackId(
  ids: readonly string[],
  currentId: string,
  mode: PlaybackMode,
  action: "ended" | "next" | "previous" = "ended",
  random: () => number = Math.random,
): string | null {
  if (!ids.length) return null;
  const index = ids.indexOf(currentId);
  if (index < 0) return ids[0];
  if (action === "ended" && mode === "repeat-one") return currentId;
  if (mode === "shuffle" && action !== "previous") {
    const candidates = ids.filter((id) => id !== currentId);
    return candidates.length
      ? candidates[Math.floor(random() * candidates.length)]
      : currentId;
  }
  if (action === "previous") return ids[(index - 1 + ids.length) % ids.length];
  if (action === "ended" && mode === "sequential" && index === ids.length - 1)
    return null;
  return ids[(index + 1) % ids.length];
}
