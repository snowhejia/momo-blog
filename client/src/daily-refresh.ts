import { zonedDay } from "../../shared/model";

// Refresh at a calendar-day boundary, including after a suspended/offline tab
// returns. A failed request must not mark the new day as synchronized.
export function watchSiteDay(
  timeZone: string,
  refresh: (signal: AbortSignal) => Promise<void>,
) {
  const controller = new AbortController();
  let syncedDay = "";
  let pending = false;
  let retryAt = 0;
  const update = async (force = false) => {
    if (controller.signal.aborted || pending) return;
    const now = new Date();
    const day = zonedDay(now, timeZone);
    if (!force && (day === syncedDay || now.getTime() < retryAt)) return;
    pending = true;
    try {
      await refresh(controller.signal);
      syncedDay = day;
      retryAt = 0;
    } catch {
      syncedDay = "";
      retryAt = Date.now() + 30_000;
    } finally {
      pending = false;
    }
  };
  const resume = () => {
    if (document.visibilityState === "visible") void update(true);
  };
  const timer = setInterval(() => void update(), 1000);
  window.addEventListener("focus", resume);
  window.addEventListener("online", resume);
  window.addEventListener("pageshow", resume);
  document.addEventListener("visibilitychange", resume);
  void update();
  return () => {
    controller.abort();
    clearInterval(timer);
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", resume);
    window.removeEventListener("pageshow", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}
