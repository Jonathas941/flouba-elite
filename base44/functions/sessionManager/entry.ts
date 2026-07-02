import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Configurable via environment variables — defaults match the aggressive-but-protected window
function validTz(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; }
  catch { return "America/New_York"; }
}
const TIMEZONE = validTz(Deno.env.get("TIMEZONE") || "America/New_York");
function validTime(str, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str || "");
  if (!m) return fallback;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return fallback;
  return str;
}
const SESSION_START_STR = validTime(Deno.env.get("SESSION_START"), "08:00");
const SESSION_END_STR = validTime(Deno.env.get("SESSION_END"), "12:00");

function parseHM(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

function fmtTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Uses IANA timezone America/New_York — automatically handles DST transitions
function getETNow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday").value;
  const hr = parseInt(parts.find((p) => p.type === "hour").value, 10) % 24;
  const mi = parseInt(parts.find((p) => p.type === "minute").value, 10);
  const se = parseInt(parts.find((p) => p.type === "second").value, 10);
  const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  return {
    now,
    day: dayMap[wd],
    hour: hr,
    minute: mi,
    second: se,
    mins: hr * 60 + mi,
    secs: hr * 3600 + mi * 60 + se,
  };
}

// Forex trading sessions (all times in ET / America-New_York)
const SESSIONS = [
  { name: "Sydney",   start: 17 * 60, end: 2 * 60,  wraps: true  }, // 5:00 PM – 2:00 AM
  { name: "Tokyo",    start: 19 * 60, end: 4 * 60,  wraps: true  }, // 7:00 PM – 4:00 AM
  { name: "London",   start: 3 * 60,  end: 12 * 60, wraps: false }, // 3:00 AM – 12:00 PM
  { name: "New York", start: 8 * 60,  end: 17 * 60, wraps: false }, // 8:00 AM – 5:00 PM
];

function activeSessions(mins) {
  const list = [];
  for (const s of SESSIONS) {
    const isActive = s.wraps ? mins >= s.start || mins < s.end : mins >= s.start && mins < s.end;
    if (isActive) list.push(s.name);
  }
  // London/New York overlap: 8:00 AM – 12:00 PM ET
  if (mins >= 8 * 60 && mins < 12 * 60) list.push("London/New York Overlap");
  return list;
}

// Market opens Sunday 5:00 PM ET, closes Friday 5:00 PM ET
function isMarketOpen(day, mins) {
  if (day === 6) return false;                              // Saturday
  if (day === 0 && mins < 17 * 60) return false;           // Sunday before 5 PM
  if (day === 5 && mins >= 17 * 60) return false;          // Friday after 5 PM
  return true;
}

// Core entry-validation logic — returns { allowed, reason }
function checkEntry(et) {
  const sStart = parseHM(SESSION_START_STR);
  const sEnd = parseHM(SESSION_END_STR);

  // Weekend block: Friday 4:55 PM ET → Sunday 5:10 PM ET (gap risk, no liquidity)
  if ((et.day === 5 && et.mins >= 16 * 60 + 55) || et.day === 6 || (et.day === 0 && et.mins < 17 * 60 + 10)) {
    return { allowed: false, reason: "Weekend market closure. Market reopens Sunday at 5:00 PM ET." };
  }
  // Daily rollover block: 4:55 PM – 5:10 PM ET (spread spikes, low liquidity)
  if (et.mins >= 16 * 60 + 55 && et.mins < 17 * 60 + 10) {
    return { allowed: false, reason: "Daily rollover period (4:55 PM – 5:10 PM ET). High spreads and low liquidity." };
  }
  // Configured trading window (default 8:00 AM – 12:00 PM ET = London/NY overlap)
  if (et.mins < sStart || et.mins >= sEnd) {
    return { allowed: false, reason: `Outside configured trading window (${fmtTime(sStart)} – ${fmtTime(sEnd)} ET). Next trading session opens at ${fmtTime(sStart)} ET.` };
  }
  return { allowed: true, reason: "Within trading window." };
}

// Next time the configured trading window opens (weekday 8 AM ET, skipping weekends)
function nextTradingWindow(et) {
  const sStart = parseHM(SESSION_START_STR);
  for (let offset = 0; offset < 8; offset++) {
    const d = (et.day + offset) % 7;
    if (d === 0 || d === 6) continue; // skip Sat/Sun
    if (offset === 0) {
      if (et.mins < sStart) {
        return { opens_at: fmtTime(sStart), countdown_seconds: Math.max(0, sStart * 60 - et.secs) };
      }
      continue; // past start today — check next weekday
    }
    const secsRemainingToday = 24 * 3600 - et.secs;
    const fullDays = offset - 1;
    return { opens_at: fmtTime(sStart), countdown_seconds: Math.max(0, secsRemainingToday + fullDays * 24 * 3600 + sStart * 60) };
  }
  return null;
}

// Next forex session to open (for display when no session is currently active)
function nextSession(et) {
  if (et.day === 6) {
    const secs = (24 * 3600 - et.secs) + 17 * 60 * 60;
    return { name: "Sydney", opens_at: fmtTime(17 * 60), countdown_seconds: Math.max(0, secs) };
  }
  if (et.day === 0 && et.mins < 17 * 60) {
    return { name: "Sydney", opens_at: fmtTime(17 * 60), countdown_seconds: Math.max(0, 17 * 60 * 60 - et.secs) };
  }
  for (const s of SESSIONS) {
    if (et.mins < s.start) {
      return { name: s.name, opens_at: fmtTime(s.start), countdown_seconds: Math.max(0, s.start * 60 - et.secs) };
    }
  }
  // All sessions passed today — next is Sydney (skip Saturday)
  let daysAhead = 1;
  let nextDay = (et.day + 1) % 7;
  while (nextDay === 6) { daysAhead++; nextDay = (nextDay + 1) % 7; }
  const secs = (24 * 3600 - et.secs) + (daysAhead - 1) * 24 * 3600 + 17 * 60 * 60;
  return { name: "Sydney", opens_at: fmtTime(17 * 60), countdown_seconds: Math.max(0, secs) };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

Deno.serve(async (req) => {
  try {
    await req.text().catch(() => {});
    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const et = getETNow();
    const marketOpen = isMarketOpen(et.day, et.mins);
    const sessions = activeSessions(et.mins);
    const entry = checkEntry(et);
    const nextWin = entry.allowed ? null : nextTradingWindow(et);
    const nextSess = sessions.length > 0 ? null : nextSession(et);

    return Response.json({
      allowed: entry.allowed,
      reason: entry.reason,
      market_open: marketOpen,
      current_sessions: sessions,
      next_session: nextSess,
      next_trading_window: nextWin,
      et_time: fmtTime(et.mins),
      et_day: DAY_NAMES[et.day],
      config: {
        timezone: TIMEZONE,
        session_start: fmtTime(parseHM(SESSION_START_STR)),
        session_end: fmtTime(parseHM(SESSION_END_STR)),
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});