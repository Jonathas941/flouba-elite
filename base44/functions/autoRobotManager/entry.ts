import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://elite-server.replit.app/api";

// Local session fallback (used when MT5 server /session/status is unavailable)
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
function parseHM(hm) { const [h, m] = hm.split(":").map(Number); return h * 60 + m; }

const SM_TZ = validTz(Deno.env.get("TIMEZONE") || "America/New_York");
const SM_ASIAN_EN = Deno.env.get("ASIAN_SESSION_ENABLED") !== "false";
const SM_ASIAN_ST = parseHM(validTime(Deno.env.get("ASIAN_SESSION_START"), "19:15"));
const SM_ASIAN_ET = parseHM(validTime(Deno.env.get("ASIAN_SESSION_END"), "03:45"));
const SM_NY_EN = Deno.env.get("NY_SESSION_ENABLED") !== "false";
const SM_NY_ST = parseHM(validTime(Deno.env.get("NY_SESSION_START"), "08:00"));
const SM_NY_ET = parseHM(validTime(Deno.env.get("NY_SESSION_END"), "12:00"));
const SM_ROL_ST = 16 * 60 + 55;
const SM_ROL_ET = 17 * 60 + 15;

function localSessionInfo() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SM_TZ, weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday").value;
  const hr = parseInt(parts.find((p) => p.type === "hour").value, 10) % 24;
  const mi = parseInt(parts.find((p) => p.type === "minute").value, 10);
  const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const day = dayMap[wd];
  const mins = hr * 60 + mi;
  const weekend = (day === 5 && mins >= SM_ROL_ST) || day === 6 || (day === 0 && mins < SM_ROL_ET);
  const inRollover = mins >= SM_ROL_ST && mins < SM_ROL_ET;
  let session = null;
  if (SM_ASIAN_EN && (mins >= SM_ASIAN_ST || mins < SM_ASIAN_ET)) session = "asian";
  else if (SM_NY_EN && mins >= SM_NY_ST && mins < SM_NY_ET) session = "ny";
  const blocked = !session || weekend || inRollover;
  if (session === "asian") return { trading_blocked: blocked, risk_multiplier: 0.5, allowed_pairs: ["USDJPY","EURJPY","AUDJPY","AUDUSD","NZDUSD"], session: "asian" };
  if (session === "ny") return { trading_blocked: blocked, risk_multiplier: 1.0, allowed_pairs: ["XAUUSD","EURUSD","GBPUSD","USDJPY"], session: "ny" };
  return { trading_blocked: true, risk_multiplier: 0, allowed_pairs: [], session: "closed" };
}

// ── BOT MENTALITY (Basic plan): patient, disciplined, selective, defensive ──
// Capital protection first. Wait for confirmation. Accept missed trades.
// No chase, no revenge, no martingale. "No trade" is a valid decision.
function consecutiveLossesCount(closedTrades) {
  const desc = (closedTrades || [])
    .filter((t) => t.closed_at)
    .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
  let n = 0;
  for (const t of desc) { if ((t.profit ?? 0) < 0) n++; else break; }
  return n;
}

function mentalityGuard({ dailyPnL, balance, consecLosses, sessionInfo, cfg }) {
  const isBasic = (cfg.bot_mentality || "Premium") === "Basic";
  // 1. Capital protection — daily loss limit / drawdown (always on)
  const maxDailyLossPct = cfg.swing_max_daily_loss_pct ?? 40;
  const lossLimit = balance > 0 ? (maxDailyLossPct / 100) * balance : (cfg.daily_loss_limit ?? 20);
  if (dailyPnL <= -lossLimit || (balance > 0 && dailyPnL <= -(maxDailyLossPct / 100) * balance))
    return { allow: false, status: "Capital protection mode active.", block: true };

  // 2. Session profit target with cooldown — block while cooling down, then resume next session
  if (cfg.daily_profit_target_enabled !== false && cfg.stop_trading_at_daily_target !== false) {
    const amt = cfg.daily_profit_target_mode === "Auto"
      ? (cfg.adaptive_effective_target ?? Math.max(20, (balance || 0) * 0.01))
      : (cfg.daily_profit_target_amount ?? cfg.daily_profit_target ?? 200);
    const pct = cfg.daily_profit_target_percent ?? 0;
    const baseline = cfg.adaptive_session_baseline ?? 0;
    const cooldownMin = cfg.session_cooldown_minutes ?? 60;
    const reachedAt = cfg.adaptive_daily_target_reached_at;
    const inCooldown = cfg.adaptive_daily_target_reached && reachedAt &&
      (Date.now() - new Date(reachedAt).getTime() < cooldownMin * 60 * 1000);
    if (inCooldown)
      return { allow: false, status: isBasic ? "Trade rejected: session target reached. Cooling down." : "Session target reached. Cooling down before next session.", block: true };
    const sessionPnL = dailyPnL - baseline;
    if ((amt > 0 && sessionPnL >= amt) || (pct > 0 && balance > 0 && sessionPnL >= (pct / 100) * balance))
      return { allow: false, status: isBasic ? "Trade rejected: session target reached." : "Session profit target reached. Protecting gains.", block: true };
  }

  // 3. Consecutive losses → cooldown, no revenge, no lot increase
  const stopAfter = cfg.stop_after_losses ?? 2;
  if (consecLosses >= stopAfter)
    return { allow: false, status: isBasic ? "Two losses detected. Cooling down." : "Loss accepted. No revenge trade.", block: true };

  // 4. Session — no outside-session / closed-market entries
  if (sessionInfo?.trading_blocked) {
    return { allow: false, status: isBasic ? "Trade rejected: late session." : "Entry rejected: outside session.", block: false };
  }

  // All hard gates passed — execute on first valid closed-candle confirmation
  return { allow: true, status: isBasic ? "Confirmation candle valid. Entry allowed." : "All conditions confirmed. Executing now.", block: false };
}

function buildHeaders(token, config) {
  const h = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (config.mt5_account)  h["X-MT5-Login"] = String(config.mt5_account);
  if (config.mt5_password) h["X-MT5-Password"] = config.mt5_password;
  if (config.mt5_server)   h["X-MT5-Server"] = config.mt5_server;
  return h;
}

Deno.serve(async (req) => {
  try {
    // Read body FIRST — the SDK may consume the body stream during auth
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    // Auth: shared cron secret (scheduled automation) OR admin user (manual call)
    const cronSecret = Deno.env.get("CRON_SECRET");
    const secretMatch = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret ||
      body.cron_secret === cronSecret
    );

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    if (!secretMatch) {
      // Require an authenticated Base44 context (blocks public callers).
      // Then block non-admin users (regular users can't invoke service-role ops).
      // me() returning null with isAuthenticated=true = internal scheduler — allowed.
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) {
        return Response.json({ error: "Unauthorized — authentication required" }, { status: 403 });
      }
      const user = await base44.auth.me().catch(() => null);
      if (user && user.role !== "admin") {
        return Response.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const provisionSecret = Deno.env.get("PROVISION_SECRET");
    if (!provisionSecret) return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });

    // Get ALL BotSettings — each user has their own MT5 account credentials
    const allSettings = await base44.asServiceRole.entities.BotSettings.list();
    if (!allSettings?.length) return Response.json({ ok: true, message: "No BotSettings found" });

    // Fetch all users to get their bridge API keys for JWT exchange
    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // Use the stored flouba_token (provisioned on signup) directly; fall back to api_key exchange.
    async function getJwt(userId, email, name) {
      const u = userMap.get(userId);
      if (u?.flouba_token) return u.flouba_token;
      let apiKey = u?.mt5_api_key;
      if (!apiKey) {
        const provisionRes = await fetch(`${BASE}/provision/user`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ base44_user_id: userId, email, name: name || email }),
        });
        const provisionJson = await provisionRes.json().catch(() => ({}));
        if (!provisionJson?.success || !provisionJson?.api_key) return null;
        apiKey = provisionJson.api_key;
        const updateData = { mt5_api_key: apiKey };
        if (provisionJson.slug) { updateData.mt5_slug = provisionJson.slug; updateData.flouba_slug = provisionJson.slug; }
        if (provisionJson.user_token) updateData.flouba_token = provisionJson.user_token;
        if (provisionJson.ea_download_url) updateData.ea_download_url = provisionJson.ea_download_url;
        await base44.asServiceRole.entities.User.update(userId, updateData);
        userMap.set(userId, { ...u, ...updateData });
        if (provisionJson.user_token) return provisionJson.user_token;
      }
      const tokenRes = await fetch(`${BASE}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      return tokenJson?.token || null;
    }

    const results = [];
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    for (const config of allSettings) {
      // Skip users without MT5 credentials
      if (!config.mt5_account || !config.mt5_password || !config.mt5_server) {
        results.push({ user: config.created_by_id, skipped: "No MT5 credentials" });
        continue;
      }

      const userData = userMap.get(config.created_by_id);
      const jwt = await getJwt(config.created_by_id, userData?.email, userData?.full_name);
      if (!jwt) {
        results.push({ user: config.created_by_id, skipped: "Bridge auth failed" });
        continue;
      }
      const authHeaders = buildHeaders(jwt, config);
      const actions = [];

      // Fetch robot status for this user's account
      const robotRes = await fetch(`${BASE}/robot/status`, { headers: authHeaders });
      const robotJson = await robotRes.json().catch(() => ({}));
      const robotRunning = robotJson?.running ?? robotJson?.robot?.running ?? false;

      // Fetch account data for this user's P&L
      const acctRes = await fetch(`${BASE}/account`, { headers: authHeaders });
      const acctJson = await acctRes.json().catch(() => ({}));
      const equity = acctJson?.equity ?? acctJson?.data?.equity ?? 0;
      const balance = acctJson?.balance ?? acctJson?.data?.balance ?? 0;
      const floatingPnl = acctJson?.profit ?? (equity - balance);

      // Today's closed trades for this user
      const closedTrades = await base44.asServiceRole.entities.Trade.filter({
        created_by_id: config.created_by_id,
        status: "Closed",
      }, "-closed_at", 50);
      const todayRealized = closedTrades
        .filter((t) => t.closed_at && new Date(t.closed_at) >= startOfDay)
        .reduce((sum, t) => sum + (t.profit ?? 0), 0);

      const dailyPnL = floatingPnl + todayRealized;

      // === BOT MENTALITY: evaluate hard gates (capital protection, daily target, cooldown, session) ===
      const consecLosses = consecutiveLossesCount(closedTrades);
      let sessionInfo = null;
      try {
        const sessRes = await fetch(`${BASE}/session/status`, { headers: authHeaders });
        if (sessRes.ok) { const j = await sessRes.json(); sessionInfo = j?.data || j; }
      } catch {}
      if (!sessionInfo) sessionInfo = localSessionInfo();
      const mentality = mentalityGuard({ dailyPnL, balance, consecLosses, sessionInfo, cfg: config });

      // === AUTO MULTIPLIER: evaluate trade history to decide if compounding is safe ===
      // Requires 30+ closed trades, 55%+ win rate, net positive P&L, and equity ≥ 2x balance
      let resolvedLotMultiplier = 1;
      let multiplierReason = "flat (auto-multiplier off or conditions not met)";
      if (config.auto_multiplier_enabled) {
        const totalClosed = closedTrades.length;
        const wins = closedTrades.filter((t) => (t.profit ?? 0) > 0).length;
        const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;
        const netPnL = closedTrades.reduce((sum, t) => sum + (t.profit ?? 0), 0);
        const equityRatioMet = balance > 0 && equity >= (config.multiplier_min_equity_ratio ?? 2) * balance;

        if (totalClosed >= 30 && winRate >= 55 && netPnL > 0 && equityRatioMet) {
          resolvedLotMultiplier = config.lot_multiplier ?? 2;
          multiplierReason = `compounding active (${totalClosed} trades, ${winRate.toFixed(0)}% win, $${netPnL.toFixed(2)} net, equity ${equityRatioMet ? "≥" : "<"} ${(config.multiplier_min_equity_ratio ?? 2)}x)`;
        } else {
          const reasons = [];
          if (totalClosed < 30) reasons.push(`${totalClosed}/30 trades`);
          if (winRate < 55) reasons.push(`${winRate.toFixed(0)}% win < 55%`);
          if (netPnL <= 0) reasons.push(`net P&L $${netPnL.toFixed(2)}`);
          if (!equityRatioMet) reasons.push("equity < 2x balance");
          multiplierReason = `flat — not yet proven (${reasons.join(", ")})`;
        }
      } else if (balance > 0 && equity >= (config.multiplier_min_equity_ratio ?? 2) * balance) {
        resolvedLotMultiplier = config.lot_multiplier ?? 2;
        multiplierReason = "compounding active (equity gate met, auto off)";
      }

      // === BOT MENTALITY: enforce capital protection / daily target / cooldown (always on) ===
      if (robotRunning && mentality.block) {
        await fetch(`${BASE}/robot/stop`, { method: "POST", headers: authHeaders, body: "{}" }).catch(() => {});
        actions.push(`MENTALITY STOP: ${mentality.status} (P&L: $${dailyPnL.toFixed(2)})`);

        // Push notification when daily profit target is reached (not cooldown / loss limit)
        const statusLower = mentality.status.toLowerCase();
        if (statusLower.includes("target reached") && !statusLower.includes("cooling")) {
          const recentNotifs = await base44.asServiceRole.entities.Notification.filter({
            created_by_id: config.created_by_id,
            type: "bot_action",
          }, "-created_date", 5).catch(() => []);
          const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
          const alreadyNotified = recentNotifs.some(n =>
            n.title === "Daily Profit Target Reached" &&
            new Date(n.created_date) > thirtyMinAgo
          );
          if (!alreadyNotified) {
            const targetAmt = config.daily_profit_target_mode === "Auto"
              ? (config.adaptive_effective_target ?? config.daily_profit_target ?? 200)
              : (config.daily_profit_target_amount ?? config.daily_profit_target ?? 200);
            await base44.asServiceRole.entities.Notification.create({
              type: "bot_action",
              title: "Daily Profit Target Reached",
              message: `Session target of $${targetAmt} achieved. Robot paused to protect gains. P&L: $${dailyPnL.toFixed(2)}`,
              category: "success",
              read: false,
              meta: { daily_pnl: dailyPnL, target_amount: targetAmt, action: "profit_target_reached" },
              created_by_id: config.created_by_id,
            });
          }
        }
      }

      // === AUTO-START: launch only when mentality allows and a session is active ===
      if (config.auto_start_enabled && !robotRunning) {
        const riskMultiplier = sessionInfo?.risk_multiplier ?? 0;
        const allowedPairs = sessionInfo?.allowed_pairs ?? [];
        const sessionName = sessionInfo?.session ?? "closed";

        if (mentality.allow && riskMultiplier > 0) {
          // Switch to an allowed pair if the current pair isn't in the server's allowed list
          const symbol = allowedPairs.length && !allowedPairs.includes(config.active_pair)
            ? allowedPairs[0]
            : config.active_pair ?? "XAUUSD";

          const startPayload = {
            strategy: "auto",
            symbol,
            trading_mode: config.trading_mode ?? "Balanced",
            lot_size: config.lot_size ?? 0.01,
            max_concurrent_trades: config.max_concurrent_trades ?? 2,
            risk_percentage: (config.risk_percentage ?? 1) * riskMultiplier,
            stop_loss: config.stop_loss ?? 50,
            take_profit: config.take_profit ?? 100,
            daily_profit_target: config.daily_profit_target_mode === "Auto"
              ? (config.adaptive_effective_target ?? config.daily_profit_target ?? 200)
              : (config.daily_profit_target_amount ?? config.daily_profit_target ?? 200),
            daily_profit_target_amount: config.daily_profit_target_amount ?? 200,
            daily_profit_target_mode: config.daily_profit_target_mode ?? "Fixed",
            session_cooldown_minutes: config.session_cooldown_minutes ?? 60,
            daily_loss_limit: balance > 0 ? ((config.swing_max_daily_loss_pct ?? 40) / 100) * balance : (config.daily_loss_limit ?? 20),
            stop_after_losses: config.stop_after_losses ?? 2,
            lot_multiplier: resolvedLotMultiplier,
            equity_guard_enabled: config.equity_guard_enabled ?? true,
            equity_guard_min_equity_pct: config.equity_guard_min_equity_pct ?? 50,
            trend_filter_enabled: config.trend_filter_enabled ?? true,
            trend_filter_timeframe: config.trend_filter_timeframe ?? "M15",
            trend_filter_ema_period: config.trend_filter_ema_period ?? 200,
            break_even: config.break_even ?? true,
            trailing_stop: config.trailing_stop ?? false,
            max_spread_pips: 5,
          };

          const startRes = await fetch(`${BASE}/robot/start`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(startPayload),
          });
          const startJson = await startRes.json().catch(() => ({}));

          if (startJson?.success === true) {
            actions.push(`AUTO-START: ${sessionName} session active — robot launched (risk ×${riskMultiplier}, ${symbol}, lot ×${resolvedLotMultiplier})`);
            actions.push(`MULTIPLIER: ${multiplierReason}`);
          } else {
            actions.push(`AUTO-START FAILED: ${startJson?.message ?? startJson?.error ?? `HTTP ${startRes.status}`}`);
          }
        }
      }

      results.push({
        user: config.created_by_id,
        login: config.mt5_account,
        robotRunning,
        dailyPnL: dailyPnL.toFixed(2),
        actions,
      });
    }

    return Response.json({
      ok: true,
      usersChecked: results.length,
      results,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});