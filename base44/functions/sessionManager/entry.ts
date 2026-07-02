import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

// === Validation helpers ===
function validTz(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; }
  catch { return "America/New_York"; }
}
function validTime(str, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str || "");
  if (!m) return fallback;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return fallback;
  return str;
}
function parseHM(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

// === Session config from env vars ===
const TIMEZONE = validTz(Deno.env.get("TIMEZONE") || "America/New_York");
const ASIAN_ENABLED = Deno.env.get("ASIAN_SESSION_ENABLED") !== "false";
const ASIAN_START = validTime(Deno.env.get("ASIAN_SESSION_START"), "19:15");
const ASIAN_END = validTime(Deno.env.get("ASIAN_SESSION_END"), "03:45");
const NY_ENABLED = Deno.env.get("NY_SESSION_ENABLED") !== "false";
const NY_START = validTime(Deno.env.get("NY_SESSION_START"), "08:00");
const NY_END = validTime(Deno.env.get("NY_SESSION_END"), "12:00");

const ASIAN_START_MIN = parseHM(ASIAN_START); // 19:15 = 1155
const ASIAN_END_MIN = parseHM(ASIAN_END);     // 03:45 = 225
const NY_START_MIN = parseHM(NY_START);       // 08:00 = 480
const NY_END_MIN = parseHM(NY_END);           // 12:00 = 720
const ROLLOVER_START = 16 * 60 + 55;          // 4:55 PM
const ROLLOVER_END = 17 * 60 + 15;            // 5:15 PM

// === Preferred pairs per session ===
const ASIAN_PREFERRED = ["USDJPY", "EURJPY", "AUDJPY", "AUDUSD", "NZDUSD"];
const NY_PREFERRED = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY"];
const MAX_SPREAD_PIPS = 5;

// === ET time computation (DST-aware) ===
function getETTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday").value;
  const hr = parseInt(parts.find((p) => p.type === "hour").value, 10) % 24;
  const mi = parseInt(parts.find((p) => p.type === "minute").value, 10);
  const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(now);
  const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" }).format(now);
  return { day: dayMap[wd], mins: hr * 60 + mi, label, dayLabel };
}

// === Session detection ===
// Asian wraps around midnight (e.g. 19:15 → 03:45)
function getActiveSession(et) {
  if (ASIAN_ENABLED && (et.mins >= ASIAN_START_MIN || et.mins < ASIAN_END_MIN)) return "Asian";
  if (NY_ENABLED && et.mins >= NY_START_MIN && et.mins < NY_END_MIN) return "New York";
  return null;
}

function isWeekend(et) {
  // Friday 4:55 PM ET → Sunday 5:15 PM ET
  return (et.day === 5 && et.mins >= ROLLOVER_START) || et.day === 6 || (et.day === 0 && et.mins < ROLLOVER_END);
}

function computeNextSession(et) {
  // After Asian ends (03:45) → before NY starts (08:00): NY is next
  if (et.mins >= ASIAN_END_MIN && et.mins < NY_START_MIN) {
    if (NY_ENABLED) return { label: "New York", opensAt: NY_START };
    if (ASIAN_ENABLED) return { label: "Asian (tomorrow)", opensAt: ASIAN_START };
  }
  // After NY ends (12:00) → before Asian starts (19:15): Asian is next
  if (et.mins >= NY_END_MIN && et.mins < ASIAN_START_MIN) {
    if (ASIAN_ENABLED) return { label: "Asian", opensAt: ASIAN_START };
    if (NY_ENABLED) return { label: "New York (tomorrow)", opensAt: NY_START };
  }
  // Weekend or edge case
  if (ASIAN_ENABLED) return { label: "Asian", opensAt: ASIAN_START };
  if (NY_ENABLED) return { label: "New York", opensAt: NY_START };
  return null;
}

// === Trade quality score (0-5) ===
function computeQuality(ind, maxSpread) {
  let score = 0;
  const checks = [];

  const adx = ind.adx ?? 0;
  if (adx >= 25) { score++; checks.push("✓ ADX trending"); }
  else checks.push("✗ ADX weak");

  const rsi = ind.rsi ?? 50;
  if (rsi >= 30 && rsi <= 70) { score++; checks.push("✓ RSI neutral"); }
  else checks.push("✗ RSI extreme");

  const atr = ind.atr ?? 0;
  if (atr >= 0.05) { score++; checks.push("✓ ATR adequate"); }
  else checks.push("✗ ATR too low");

  const ema20 = ind.ema_20 ?? 0;
  const ema50 = ind.ema_50 ?? 0;
  if (ema20 && ema50 && Math.abs(ema20 - ema50) > 0.0001) { score++; checks.push("✓ EMA aligned"); }
  else checks.push("✗ EMA flat");

  const spread = ind.spread_pips ?? 999;
  if (spread <= maxSpread) { score++; checks.push("✓ Spread OK"); }
  else checks.push("✗ Spread high");

  return { score, maxScore: 5, checks, spread, atr, adx, rsi };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const et = getETTime();
    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id });
    const config = settings?.[0] || {};
    const activePair = config.active_pair ?? "XAUUSD";

    const session = getActiveSession(et);
    const weekend = isWeekend(et);
    const inRollover = et.mins >= ROLLOVER_START && et.mins < ROLLOVER_END;

    // Session-specific config
    const sessionConfig = session === "Asian" ? {
      name: "Asian",
      label: "ASIAN SESSION ACTIVE",
      risk_multiplier: 0.5,
      max_positions: Math.min(config.max_concurrent_trades ?? 2, 2),
      min_quality_score: 4,
      preferred_pairs: ASIAN_PREFERRED,
      conditional_pairs: ["XAUUSD"],
    } : session === "New York" ? {
      name: "New York",
      label: "NY SESSION ACTIVE",
      risk_multiplier: 1.0,
      max_positions: config.max_concurrent_trades ?? 2,
      min_quality_score: 3,
      preferred_pairs: NY_PREFERRED,
      conditional_pairs: [],
    } : null;

    // Fetch live scanner data from MT5 for spread / ATR / quality
    let marketData = null;
    let quality = null;

    if (config.mt5_account && config.mt5_password && config.mt5_server) {
      const token = Deno.env.get("MT5_API_TOKEN");
      if (token) {
        try {
          const res = await fetch(`${BASE}/scanner/status`, {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
              "X-MT5-Login": String(config.mt5_account),
              "X-MT5-Password": config.mt5_password,
              "X-MT5-Server": config.mt5_server,
            },
          });
          const json = await res.json().catch(() => ({}));
          const ind = json?.indicators || json?.data?.indicators || {};
          if (ind && Object.keys(ind).length) {
            marketData = {
              symbol: ind.symbol ?? activePair,
              bid: ind.bid, ask: ind.ask, spread_pips: ind.spread_pips,
              atr: ind.atr, adx: ind.adx, rsi: ind.rsi,
              ema_20: ind.ema_20, ema_50: ind.ema_50, ema_200: ind.ema_200,
            };
            quality = computeQuality(ind, MAX_SPREAD_PIPS);
          }
        } catch { /* scanner unavailable — continue with time-only check */ }
      }
    }

    // === Entry decision ===
    let allowed = false;
    let reason = "";

    if (weekend) {
      reason = "Weekend market closure — no new entries until Sunday 5:15 PM ET.";
    } else if (inRollover) {
      reason = "Daily rollover (4:55–5:15 PM ET) — entries blocked.";
    } else if (!session) {
      const next = computeNextSession(et);
      reason = next
        ? `Outside trading sessions. Next: ${next.label} at ${next.opensAt} ET.`
        : "No active trading session configured.";
    } else if (quality) {
      const minScore = sessionConfig.min_quality_score;
      if (quality.spread > MAX_SPREAD_PIPS) {
        reason = `Spread too high (${quality.spread} pips > max ${MAX_SPREAD_PIPS}) — entry rejected.`;
      } else if (quality.score < minScore) {
        const fails = quality.checks.filter((c) => c.startsWith("✗"));
        reason = `Trade quality too low for ${session} session (${quality.score}/${quality.maxScore}, need ${minScore}). ${fails.join(", ")}.`;
      } else {
        allowed = true;
        reason = `${session} session active — entry allowed (quality ${quality.score}/${quality.maxScore}).`;
      }
    } else {
      // Session active but no live market data — permit by time window only
      allowed = true;
      reason = `${session} session active — entry permitted by time window.`;
    }

    // Pair preference status
    let pairStatus = "N/A";
    if (sessionConfig) {
      if (sessionConfig.preferred_pairs.includes(activePair)) {
        pairStatus = "Preferred";
      } else if (sessionConfig.conditional_pairs.includes(activePair)) {
        pairStatus = quality && quality.spread <= MAX_SPREAD_PIPS
          ? "Conditional (spread OK)"
          : "Conditional (spread too high)";
      } else {
        pairStatus = "Not preferred for this session";
      }
    }

    return Response.json({
      session_active: session,
      session_label: session ? sessionConfig.label : "MARKET CLOSED",
      allowed,
      reason,
      market_open: !weekend,
      et_time: et.label,
      et_day: et.dayLabel,
      active_pair: activePair,
      pair_status: pairStatus,
      preferred_pairs: sessionConfig?.preferred_pairs ?? [],
      conditional_pairs: sessionConfig?.conditional_pairs ?? [],
      session_risk_multiplier: sessionConfig?.risk_multiplier ?? 1,
      session_max_positions: sessionConfig?.max_positions ?? config.max_concurrent_trades ?? 2,
      min_quality_score: sessionConfig?.min_quality_score ?? 0,
      spread: quality?.spread ?? null,
      atr: quality?.atr ?? null,
      trade_quality_score: quality?.score ?? null,
      trade_quality_max: quality?.maxScore ?? 5,
      quality_checks: quality?.checks ?? [],
      market_data: marketData,
      config: {
        timezone: TIMEZONE,
        asian_enabled: ASIAN_ENABLED,
        asian_start: ASIAN_START,
        asian_end: ASIAN_END,
        ny_enabled: NY_ENABLED,
        ny_start: NY_START,
        ny_end: NY_END,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});