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
 * pollInterval — drop-in replacement for setInterval(fn, ms) for any timer that
 * calls a backend function. Returns a normal interval id (so existing
 * clearInterval(id) cleanup keeps working), skips ticks while the tab is
 * hidden, and never polls faster than minMs (default 30 s).
 */
export function pollInterval(fn, ms, minMs = 60000) {
  let lastRun = 0;
  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (Date.now() - lastRun < Math.max(ms || 0, minMs) - 250) return;
    lastRun = Date.now();
    fn();
  };
  const id = setInterval(tick, Math.max(ms || 0, minMs));
  if (typeof document !== "undefined") {
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Keep cleanup compatible with existing clearInterval callers.
    const originalClear = clearInterval;
    // The listener is also removed when the page unloads.
    window.addEventListener("pagehide", () => document.removeEventListener("visibilitychange", onVisible), { once: true });
  }
  return id;
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
