// ═══════════════════════════════════════════════════════════════
// Shared Trading Utilities
// Common helpers used by multiple backend functions (tradeDecisionEngine,
// marketStructureScanner, etc.).
// ═══════════════════════════════════════════════════════════════

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function num(v) { return typeof v === "number" ? v : (v == null ? null : Number(v)); }

// NY timezone parts — used for session detection and daily reset logic.
export function nyParts(d) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hh = parseInt(get("hour"), 10) % 24;
  const mm = parseInt(get("minute"), 10);
  return { day: dayMap[get("weekday")] ?? 0, minutes: hh * 60 + mm };
}

// Session detection (America/New_York) — does NOT check user config;
// the caller checks london_session / new_york_session / asian_session.
export function sessionInfo() {
  const { day, minutes } = nyParts(new Date());
  if (day === 5 && minutes >= 16 * 60 + 55) return { open: false, name: "Closed", reason: "Friday close" };
  if (day === 6) return { open: false, name: "Closed", reason: "Weekend" };
  if (day === 0 && minutes < 17 * 60 + 10) return { open: false, name: "Closed", reason: "Weekend" };
  if (minutes >= 16 * 60 + 55 && minutes <= 17 * 60 + 15) return { open: false, name: "Closed", reason: "Rollover / spread spike" };
  const inAsian = minutes >= 19 * 60 + 15 || minutes <= 3 * 60 + 45;
  const inLondon = minutes >= 3 * 60 && minutes < 8 * 60;
  const inNY = minutes >= 8 * 60 && minutes <= 12 * 60;
  const inOverlap = minutes >= 8 * 60 && minutes <= 11 * 60;
  if (inOverlap) return { open: true, name: "London / NY Overlap", quality: "high" };
  if (inNY) return { open: true, name: "New York", quality: "medium" };
  if (inLondon) return { open: true, name: "London", quality: "medium" };
  if (inAsian) return { open: true, name: "Asian", quality: "low" };
  return { open: false, name: "Off-Session", reason: "Outside prime trading hours" };
}