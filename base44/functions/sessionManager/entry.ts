import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://dazzling-perception-production-8e53.up.railway.app/api";

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

// === Config from env vars ===
const TIMEZONE = validTz(Deno.env.get("TIMEZONE") || "America/New_York");
// 24/7 trading: sessions cover all market hours (weekdays only, excluding rollover)
const ASIAN_ENABLED = true;
const ASIAN_START = "00:00";
const ASIAN_END = "23:59";
const NY_ENABLED = true;
const NY_START = "00:00";
const NY_END = "23:59";

const ASIAN_START_MIN = parseHM(ASIAN_START);
const ASIAN_END_MIN = parseHM(ASIAN_END);
const NY_START_MIN = parseHM(NY_START);
const NY_END_MIN = parseHM(NY_END);
const ROLLOVER_START = 16 * 60 + 55;
const ROLLOVER_END = 17 * 60 + 15;

// Session-specific defaults (match server env var defaults)
const ASIAN_RISK_MULTIPLIER = 0.5;
const ASIAN_MAX_POSITIONS = 2;
const ASIAN_MIN_QUALITY = 75;
const NY_RISK_MULTIPLIER = 1.0;
const NY_MAX_POSITIONS = 3;
const NY_MIN_QUALITY = 60;

const ASIAN_PAIRS = ["USDJPY", "EURJPY", "AUDJPY", "AUDUSD", "NZDUSD"];
const NY_PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
const MAX_SPREAD_PIPS = 5;

function fmtWindow(start, end) {
  return `${start} – ${end} ET`;
}
const ASIAN_WINDOW = fmtWindow(ASIAN_START, ASIAN_END);
const NY_WINDOW = fmtWindow(NY_START, NY_END);

// === ET time (DST-aware) ===
function getETTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday").value;
  const hr = parseInt(parts.find((p) => p.type === "hour").value, 10) % 24;
  const mi = parseInt(parts.find((p) => p.type === "minute").value, 10);
  const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const time24 = `${String(hr).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" }).format(now);
  const h12 = hr % 12 || 12;
  const period = hr >= 12 ? "PM" : "AM";
  const time12 = `${h12}:${String(mi).padStart(2, "0")} ${period}`;
  return { day: dayMap[wd], mins: hr * 60 + mi, time24, time12, dayLabel };
}

// === Local session computation (fallback when server endpoint unavailable) ===
function getActiveSession(et) {
  // NY checked first — full pair list (XAUUSD, EURUSD, GBPUSD, USDJPY) + full risk multiplier
  if (NY_ENABLED && et.mins >= NY_START_MIN && et.mins < NY_END_MIN) return "ny";
  if (ASIAN_ENABLED && (et.mins >= ASIAN_START_MIN || et.mins < ASIAN_END_MIN)) return "asian";
  return null;
}

function isWeekend(et) {
  return (et.day === 5 && et.mins >= ROLLOVER_START) || et.day === 6 || (et.day === 0 && et.mins < ROLLOVER_END);
}

function computeNextSession(et) {
  if (et.mins >= ASIAN_END_MIN && et.mins < NY_START_MIN) {
    if (NY_ENABLED) return { label: "New York", opensAt: NY_START };
    if (ASIAN_ENABLED) return { label: "Asian (tomorrow)", opensAt: ASIAN_START };
  }
  if (et.mins >= NY_END_MIN && et.mins < ASIAN_START_MIN) {
    if (ASIAN_ENABLED) return { label: "Asian", opensAt: ASIAN_START };
    if (NY_ENABLED) return { label: "New York (tomorrow)", opensAt: NY_START };
  }
  if (ASIAN_ENABLED) return { label: "Asian", opensAt: ASIAN_START };
  if (NY_ENABLED) return { label: "New York", opensAt: NY_START };
  return null;
}

// Quality score (0-100): 5 checks × 20 points each
function computeQuality100(ind, maxSpread) {
  let score = 0;
  if ((ind.adx ?? 0) >= 25) score += 20;
  const rsi = ind.rsi ?? 50;
  if (rsi >= 30 && rsi <= 70) score += 20;
  if ((ind.atr ?? 0) >= 0.05) score += 20;
  const ema20 = ind.ema_20 ?? 0;
  const ema50 = ind.ema_50 ?? 0;
  if (ema20 && ema50 && Math.abs(ema20 - ema50) > 0.0001) score += 20;
  if ((ind.spread_pips ?? 999) <= maxSpread) score += 20;
  return score;
}

function localSessionBlock(et, scannerInd) {
  const session = getActiveSession(et);
  const weekend = isWeekend(et);
  const inRollover = et.mins >= ROLLOVER_START && et.mins < ROLLOVER_END;

  let label, riskMultiplier, minQuality, allowedPairs, blockReason, tradingBlocked;

  if (weekend) {
    label = "MARKET CLOSED";
    tradingBlocked = true;
    blockReason = "Weekend market closure — no new entries until Sunday 5:15 PM ET.";
    riskMultiplier = 0;
    minQuality = 100;
    allowedPairs = [];
  } else if (inRollover) {
    label = "MARKET CLOSED";
    tradingBlocked = true;
    blockReason = "Daily rollover (4:55–5:15 PM ET) — entries blocked.";
    riskMultiplier = 0;
    minQuality = 100;
    allowedPairs = [];
  } else if (session === "asian") {
    label = "ASIAN SESSION ACTIVE";
    riskMultiplier = ASIAN_RISK_MULTIPLIER;
    minQuality = ASIAN_MIN_QUALITY;
    allowedPairs = ASIAN_PAIRS;
    const spread = scannerInd?.spread_pips ?? null;
    const quality = scannerInd ? computeQuality100(scannerInd, MAX_SPREAD_PIPS) : null;
    if (spread != null && spread > MAX_SPREAD_PIPS) {
      tradingBlocked = true;
      blockReason = `Spread too high (${spread} pips > max ${MAX_SPREAD_PIPS}) — entry rejected.`;
    } else if (quality != null && quality < minQuality) {
      tradingBlocked = true;
      blockReason = `Trade quality too low for Asian session (${quality}/100, need ${minQuality}).`;
    } else {
      tradingBlocked = false;
      blockReason = quality != null
        ? `Asian session active — entry allowed (quality ${quality}/100).`
        : "Asian session active — entry permitted by time window.";
    }
  } else if (session === "ny") {
    label = "NY SESSION ACTIVE";
    riskMultiplier = NY_RISK_MULTIPLIER;
    minQuality = NY_MIN_QUALITY;
    allowedPairs = NY_PAIRS;
    const spread = scannerInd?.spread_pips ?? null;
    const quality = scannerInd ? computeQuality100(scannerInd, MAX_SPREAD_PIPS) : null;
    if (spread != null && spread > MAX_SPREAD_PIPS) {
      tradingBlocked = true;
      blockReason = `Spread too high (${spread} pips > max ${MAX_SPREAD_PIPS}) — entry rejected.`;
    } else if (quality != null && quality < minQuality) {
      tradingBlocked = true;
      blockReason = `Trade quality too low for NY session (${quality}/100, need ${minQuality}).`;
    } else {
      tradingBlocked = false;
      blockReason = quality != null
        ? `NY session active — entry allowed (quality ${quality}/100).`
        : "NY session active — entry permitted by time window.";
    }
  } else {
    label = "MARKET CLOSED";
    tradingBlocked = true;
    const next = computeNextSession(et);
    blockReason = next
      ? `Outside trading sessions. Next: ${next.label} at ${next.opensAt} ET.`
      : "No active trading session configured.";
    riskMultiplier = 0;
    minQuality = 100;
    allowedPairs = [];
  }

  return {
    label,
    session: session ?? "closed",
    current_time_et: et.time24,
    in_rollover_blackout: inRollover,
    trading_blocked: tradingBlocked,
    block_reason: blockReason,
    allowed_pairs: allowedPairs,
    risk_multiplier: riskMultiplier,
    min_quality_score: minQuality,
    current_spread_pips: scannerInd?.spread_pips ?? null,
    current_atr: scannerInd?.atr ?? null,
    trade_quality_score: scannerInd ? computeQuality100(scannerInd, MAX_SPREAD_PIPS) : null,
    asian_session_window: ASIAN_WINDOW,
    ny_session_window: NY_WINDOW,
    _source: "local",
  };
}

function getNextSession(et) {
  const now = Date.now();
  const candidates = [];
  for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
    const checkDay = (et.day + dayOffset) % 7;
    if (checkDay === 6) continue; // Saturday — market closed
    if (ASIAN_ENABLED && checkDay !== 5) { // Skip Friday Asian (extends into Saturday)
      const delta = ASIAN_START_MIN - et.mins + dayOffset * 1440;
      if (delta > 0) candidates.push({ label: "Asian", delta });
    }
    if (NY_ENABLED && checkDay !== 0) { // Skip Sunday NY (market opens after NY start)
      const delta = NY_START_MIN - et.mins + dayOffset * 1440;
      if (delta > 0) candidates.push({ label: "New York", delta });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.delta - b.delta);
  const best = candidates[0];
  return {
    label: best.label,
    next_session_at: new Date(now + best.delta * 60000).toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id });
    const config = settings?.[0] || {};
    const activePair = config.active_pair ?? "XAUUSD";

    // Use the stored flouba_token (provisioned on signup) directly; fall back to api_key exchange.
    const provisionSecret = Deno.env.get("PROVISION_SECRET");
    if (!provisionSecret) return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });
    let bridgeToken = user.flouba_token;
    if (!bridgeToken) {
      let apiKey = user.mt5_api_key;
      if (!apiKey) {
        const provisionRes = await fetch(`${BASE}/provision/user`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ base44_user_id: user.id, email: user.email, name: user.full_name || user.email }),
        });
        const provisionJson = await provisionRes.json().catch(() => ({}));
        if (!provisionJson?.success || !provisionJson?.api_key) {
          return Response.json({ error: "Failed to provision bridge account" }, { status: 500 });
        }
        apiKey = provisionJson.api_key;
        const updateData = { mt5_api_key: apiKey };
        if (provisionJson.slug) { updateData.mt5_slug = provisionJson.slug; updateData.flouba_slug = provisionJson.slug; }
        if (provisionJson.user_token) updateData.flouba_token = provisionJson.user_token;
        if (provisionJson.ea_download_url) updateData.ea_download_url = provisionJson.ea_download_url;
        await base44.asServiceRole.entities.User.update(user.id, updateData);
        bridgeToken = provisionJson.user_token || null;
      }
      if (!bridgeToken) {
        const tokenRes = await fetch(`${BASE}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey }),
        });
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (!tokenJson?.token) {
          return Response.json({ error: "Failed to authenticate with MT5 bridge" }, { status: 500 });
        }
        bridgeToken = tokenJson.token;
      }
    }

    const authHeaders = {
      "Authorization": `Bearer ${bridgeToken}`,
      "Content-Type": "application/json",
    };
    if (config.mt5_account) authHeaders["X-MT5-Login"] = String(config.mt5_account);
    if (config.mt5_password) authHeaders["X-MT5-Password"] = config.mt5_password;
    if (config.mt5_server) authHeaders["X-MT5-Server"] = config.mt5_server;

    // === Try server /session/status first ===
    let s = null;
    if (bridgeToken) {
      try {
        const res = await fetch(`${BASE}/session/status`, { headers: authHeaders });
        if (res.ok) {
          const json = await res.json();
          s = json?.data || json;
        }
      } catch { /* server unreachable — fall through to local */ }
    }

    // === Fall back to local computation ===
    if (!s) {
      const et = getETTime();
      let scannerInd = null;
      if (config.mt5_account && config.mt5_password && config.mt5_server && bridgeToken) {
        try {
          const scanRes = await fetch(`${BASE}/scanner/status`, { headers: authHeaders });
          if (scanRes.ok) {
            const scanJson = await scanRes.json();
            scannerInd = scanJson?.indicators || scanJson?.data?.indicators || null;
          }
        } catch {}
      }
      s = localSessionBlock(et, scannerInd);
    }

    // === Format output (works for both server and local sources) ===
    const sessionRaw = s.session ?? "closed";
    const session = sessionRaw === "closed" ? null
      : sessionRaw === "asian" ? "Asian"
      : (sessionRaw === "ny" || sessionRaw === "new_york") ? "New York"
      : sessionRaw;

    const et = getETTime();
    const nextSession = getNextSession(et);
    let pairStatus = "N/A";
    if (session && s.allowed_pairs?.length) {
      pairStatus = s.allowed_pairs.includes(activePair) ? "Allowed" : "Not in allowed pairs";
    }

    return Response.json({
      session_active: session,
      session_label: s.label ?? "MARKET CLOSED",
      allowed: !s.trading_blocked,
      reason: s.block_reason ?? "",
      market_open: session !== null,
      in_rollover: s.in_rollover_blackout ?? false,
      et_time: s.current_time_et ? formatTime12h(s.current_time_et) : et.time12,
      et_day: et.dayLabel,
      active_pair: activePair,
      pair_status: pairStatus,
      allowed_pairs: s.allowed_pairs ?? [],
      session_risk_multiplier: s.risk_multiplier ?? 0,
      min_quality_score: s.min_quality_score ?? 100,
      spread: s.current_spread_pips ?? null,
      atr: s.current_atr ?? null,
      trade_quality_score: s.trade_quality_score ?? null,
      trade_quality_max: 100,
      asian_session_window: s.asian_session_window ?? ASIAN_WINDOW,
      ny_session_window: s.ny_session_window ?? NY_WINDOW,
      next_session_at: nextSession?.next_session_at ?? null,
      next_session_label: nextSession?.label ?? null,
      source: s._source ?? "server",
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function formatTime12h(time24) {
  if (!time24) return null;
  const [h, m] = time24.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}