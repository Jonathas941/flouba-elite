/**
 * setVisibleInterval — like setInterval, but skips ticks while the browser tab
 * is hidden (minimized, other tab, phone locked). Every poll that calls a
 * backend function costs integration credits, so we never poll a page nobody
 * is looking at. When the tab becomes visible again, it runs once immediately.
 *
 * Returns a cleanup function (call it in the useEffect cleanup).
 */
export function setVisibleInterval(fn, ms) {
  let lastRun = 0;
  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    lastRun = Date.now();
    fn();
  };
  const id = setInterval(tick, Math.max(ms || 0, 30000));
  const onVisible = () => {
    if (document.hidden || Date.now() - lastRun < 30000) return;
    tick();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/**
 * pollInterval — credit-conscious backend polling. Returns a normal interval
 * id so existing clearInterval cleanup keeps working. Skips hidden tabs and
 * enforces a 60-second minimum between backend polls by default.
 */
export function pollInterval(fn, ms, minMs = 60000) {
  const intervalMs = Math.max(ms || 0, minMs);
  return setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    fn();
  }, intervalMs);
}

// Poll intervals for anything that invokes a backend function (mt5Bridge, scanners).
// Raise these to save more credits; lower them for faster refresh.
export const POLL_MS = {
  liveScanner: 60000,
  statistics: 60000,
  homeFast: 60000,
  marketStructure: 120000,
  lsr3rScanner: 120000,
};
