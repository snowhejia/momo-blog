import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { watchSiteDay } from "../client/src/daily-refresh";
import { zonedDay } from "../shared/model";

function browserClock(t: TestContext, instant: string) {
  t.mock.timers.enable({
    apis: ["Date", "setInterval"],
    now: new Date(instant),
  });
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  const disposers: (() => void)[] = [];
  const restore: (() => void)[] = [];
  for (const [name, value] of Object.entries({ window, document })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    restore.push(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  t.after(() => {
    disposers.forEach((dispose) => dispose());
    restore.forEach((restoreProperty) => restoreProperty());
  });
  return {
    window,
    document,
    cleanup: (dispose: () => void) => disposers.push(dispose),
  };
}

// Let the async refresh complete before advancing the simulated clock again.
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("悉尼切上海再切回，下一天按悉尼夏令时午夜刷新", async (t) => {
  const { cleanup } = browserClock(t, "2026-10-04T12:59:59Z");
  const checkedDays = new Set(["2026-10-04"]);
  let checkedIn = true;
  const refreshed: string[] = [];
  const watch = (zone: string) =>
    watchSiteDay(zone, async () => {
      const day = zonedDay(new Date(), zone);
      refreshed.push(`${zone}:${day}`);
      checkedIn = checkedDays.has(day);
    });
  let stop = watch("Australia/Sydney");
  await settle();
  assert.equal(checkedIn, true);
  stop();
  stop = watch("Asia/Shanghai");
  await settle();
  assert.equal(checkedIn, true);
  stop();
  stop = watch("Australia/Sydney");
  cleanup(() => stop());
  await settle();
  assert.equal(checkedIn, true, "切换时区不清除当天签到");
  t.mock.timers.tick(1000);
  await settle();
  assert.equal(checkedIn, false, "悉尼零点恢复可签到，上海此时仍是前一天");
  assert.deepEqual(refreshed, [
    "Australia/Sydney:2026-10-04",
    "Asia/Shanghai:2026-10-04",
    "Australia/Sydney:2026-10-04",
    "Australia/Sydney:2026-10-05",
  ]);
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(refreshed.length, 4, "同步成功后不重复轮询服务器");
});

test("跨天请求失败后重试，不把昨天的签到状态锁到新一天", async (t) => {
  const { cleanup } = browserClock(t, "2026-10-04T12:59:59Z");
  let calls = 0;
  let checkedIn = true;
  const stop = watchSiteDay("Australia/Sydney", async () => {
    calls++;
    if (calls === 2) throw new Error("offline at midnight");
    checkedIn = zonedDay(new Date(), "Australia/Sydney") === "2026-10-04";
  });
  cleanup(stop);
  await settle();
  t.mock.timers.tick(1000);
  await settle();
  assert.equal(calls, 2);
  assert.equal(checkedIn, true);
  t.mock.timers.tick(29_000);
  await settle();
  assert.equal(calls, 2, "失败后等待重试，不每秒发送请求");
  t.mock.timers.tick(1000);
  await settle();
  assert.equal(calls, 3);
  assert.equal(checkedIn, false);
});

test("页面重新可见、联网或恢复时立即重新同步", async (t) => {
  const { window, document, cleanup } = browserClock(t, "2026-10-04T12:59:59Z");
  let calls = 0;
  const stop = watchSiteDay("Australia/Sydney", async () => {
    if (++calls === 2) throw new Error("offline");
  });
  cleanup(stop);
  await settle();
  t.mock.timers.tick(1000);
  await settle();
  window.dispatchEvent(new Event("online"));
  await settle();
  assert.equal(calls, 3, "联网后不必等待失败重试计时器");
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  await settle();
  assert.equal(calls, 3);
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  await settle();
  window.dispatchEvent(new Event("focus"));
  await settle();
  window.dispatchEvent(new Event("pageshow"));
  await settle();
  assert.equal(calls, 6);
});

test("同一天恢复页面时刷新失败也会自动重试", async (t) => {
  const { window, cleanup } = browserClock(t, "2026-10-04T10:00:00Z");
  let calls = 0;
  cleanup(
    watchSiteDay("Australia/Sydney", async () => {
      if (++calls === 2) throw new Error("temporary network failure");
    }),
  );
  await settle();
  window.dispatchEvent(new Event("focus"));
  await settle();
  assert.equal(calls, 2);
  t.mock.timers.tick(30_000);
  await settle();
  assert.equal(calls, 3);
});

test("切换时区取消旧请求，清理计时器和监听，慢请求不会重复发出", async (t) => {
  const { window } = browserClock(t, "2026-10-04T12:59:59Z");
  const signals: AbortSignal[] = [];
  const refresh = (signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<void>(() => {});
  };
  const stopSydney = watchSiteDay("Australia/Sydney", refresh);
  t.mock.timers.tick(60_000);
  window.dispatchEvent(new Event("focus"));
  assert.equal(signals.length, 1);
  stopSydney();
  assert.equal(signals[0].aborted, true);
  const stopShanghai = watchSiteDay("Asia/Shanghai", refresh);
  assert.equal(signals.length, 2);
  assert.equal(signals[1].aborted, false);
  stopShanghai();
  assert.equal(signals[1].aborted, true);
  t.mock.timers.tick(60_000);
  window.dispatchEvent(new Event("online"));
  assert.equal(signals.length, 2);
});
