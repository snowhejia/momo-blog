import test from "node:test";
import assert from "node:assert/strict";
import {
  nextTrackId,
  parsePlaybackMode,
  playbackModes,
} from "../client/src/playback";

const tracks = ["morning", "afternoon", "night"];

test("旧播放记录与无效模式回退顺序播放，四种有效选择可恢复", () => {
  for (const value of [undefined, null, "", "unknown", {}, 1])
    assert.equal(parsePlaybackMode(value), "sequential");
  for (const mode of playbackModes)
    assert.equal(parsePlaybackMode(mode.value), mode.value);
});

test("顺序播放逐首前进，最后一首结束时停止", () => {
  assert.equal(nextTrackId(tracks, "morning", "sequential"), "afternoon");
  assert.equal(nextTrackId(tracks, "afternoon", "sequential"), "night");
  assert.equal(nextTrackId(tracks, "night", "sequential"), null);
});

test("列表循环回到第一首，单曲循环保持当前歌曲", () => {
  assert.equal(nextTrackId(tracks, "night", "repeat-all"), "morning");
  assert.equal(nextTrackId(tracks, "morning", "repeat-all"), "afternoon");
  for (const id of tracks)
    assert.equal(nextTrackId(tracks, id, "repeat-one"), id);
});

test("手动上下首可跨越边界，也可切出正在单曲循环的歌曲", () => {
  for (const mode of ["sequential", "repeat-all", "repeat-one"] as const) {
    assert.equal(nextTrackId(tracks, "night", mode, "next"), "morning");
    assert.equal(nextTrackId(tracks, "morning", mode, "previous"), "night");
    assert.equal(nextTrackId(tracks, "morning", mode, "next"), "afternoon");
  }
});

test("随机播放的自动与手动下一首均避开当前歌曲，其他歌曲均可选中", () => {
  for (const current of tracks) {
    const others = tracks.filter((id) => id !== current);
    for (const action of ["ended", "next"] as const) {
      assert.equal(
        nextTrackId(tracks, current, "shuffle", action, () => 0),
        others[0],
      );
      assert.equal(
        nextTrackId(tracks, current, "shuffle", action, () => 0.999),
        others[1],
      );
    }
  }
});

test("空列表、单首歌曲与已移除歌曲都有确定的下一步", () => {
  for (const mode of playbackModes) {
    assert.equal(nextTrackId([], "missing", mode.value), null);
    assert.equal(nextTrackId(tracks, "missing", mode.value), "morning");
    assert.equal(
      nextTrackId(["only"], "only", mode.value),
      mode.value === "sequential" ? null : "only",
    );
  }
});
