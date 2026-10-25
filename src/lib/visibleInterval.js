/**
 * setVisibleInterval — like setInterval, but skips ticks while the browser tab
 * is hidden (minimized, other tab, phone locked). Every poll that calls a
 * backend function costs integration credits, so we never poll a page nobody
 * is looking at. When the tab becomes visible again, it runs once immediately.
 *
 * Returns a cleanup function (call it in the useEffect cleanup).
 */
export function setVisibleInterval(fn, ms) {
  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    fn();
  };
  const id = setInterval(tick, ms);
  const onVisible = () => {
    if (!document.hidden) fn();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/**
 * pollInterval — drop-in replacement for setInterval(fn, ms) for any timer that
 * calls a backend function. Returns a normal interval id (so existing
 * clearInterval(id) cleanup keeps working), skips ticks while the tab is
 * hidden, and never polls faster than minMs (default 30 s).
 */
export function pollInterval(fn, ms, minMs = 30000) {
  return setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    fn();
  }, Math.max(ms || 0, minMs));
}

// Poll intervals for anything that invokes a backend function (mt5Bridge, scanners).
// Raise these to save more credits; lower them for faster refresh.
export const POLL_MS = {
  liveScanner: 10000,     // was 2s
  statistics: 20000,      // was 5s
  homeFast: 30000,        // was 15s
  marketStructure: 60000, // was 15s
  lsr3rScanner: 60000,    // was 15s
};
