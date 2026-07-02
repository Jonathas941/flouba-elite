import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";
const USER_TIMEZONE = "America/Detroit";

function getLocalMinutes(timezone) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute").value, 10);
  return h * 60 + m;
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
    const base44 = createClientFromRequest(req);
    const token = Deno.env.get("MT5_API_TOKEN");
    if (!token) return Response.json({ error: "MT5_API_TOKEN not set" }, { status: 500 });

    // Get ALL BotSettings — each user has their own MT5 account credentials
    const allSettings = await base44.asServiceRole.entities.BotSettings.list();
    if (!allSettings?.length) return Response.json({ ok: true, message: "No BotSettings found" });

    const results = [];
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    for (const config of allSettings) {
      // Skip users without MT5 credentials
      if (!config.mt5_account || !config.mt5_password || !config.mt5_server) {
        results.push({ user: config.created_by_id, skipped: "No MT5 credentials" });
        continue;
      }

      const authHeaders = buildHeaders(token, config);
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
      });
      const todayRealized = closedTrades
        .filter((t) => t.closed_at && new Date(t.closed_at) >= startOfDay)
        .reduce((sum, t) => sum + (t.profit ?? 0), 0);

      const dailyPnL = floatingPnl + todayRealized;

      // === AUTO-STOP: Check daily profit target / loss limit ===
      if (config.auto_stop_enabled !== false && robotRunning) {
        const profitTarget = config.daily_profit_target ?? 200;
        const lossLimit = config.daily_loss_limit ?? 20;

        if (dailyPnL >= profitTarget) {
          await fetch(`${BASE}/robot/stop`, { method: "POST", headers: authHeaders, body: "{}" });
          actions.push(`AUTO-STOP: Profit target $${profitTarget} reached (P&L: +$${dailyPnL.toFixed(2)})`);
        } else if (dailyPnL <= -lossLimit) {
          await fetch(`${BASE}/robot/stop`, { method: "POST", headers: authHeaders, body: "{}" });
          actions.push(`AUTO-STOP: Loss limit $${lossLimit} reached (P&L: -$${Math.abs(dailyPnL).toFixed(2)})`);
        }
      }

      // === AUTO-START: Check scheduled start time ===
      if (config.auto_start_enabled && !robotRunning) {
        const autoStartTime = config.auto_start_time ?? "09:00";
        const [targetH, targetM] = autoStartTime.split(":").map(Number);
        const targetMinutes = targetH * 60 + targetM;
        const currentMinutes = getLocalMinutes(USER_TIMEZONE);
        const diff = Math.abs(currentMinutes - targetMinutes);

        if (diff <= 5) {
          const startPayload = {
            strategy: "auto",
            symbol: config.active_pair ?? "XAUUSD",
            trading_mode: config.trading_mode ?? "Balanced",
            lot_size: config.lot_size ?? 0.03,
            max_concurrent_trades: config.max_concurrent_trades ?? 2,
            risk_percentage: config.risk_percentage ?? 2,
            stop_loss: config.stop_loss ?? 20,
            take_profit: config.take_profit ?? 40,
            daily_profit_target: config.daily_profit_target ?? 200,
            daily_loss_limit: config.daily_loss_limit ?? 20,
            stop_after_losses: config.stop_after_losses ?? 2,
            lot_multiplier: config.lot_multiplier ?? 2,
            equity_guard_enabled: config.equity_guard_enabled ?? true,
            equity_guard_min_equity_pct: config.equity_guard_min_equity_pct ?? 75,
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

          if (startJson?.success || startRes.ok) {
            actions.push(`AUTO-START: Robot launched at ${autoStartTime} (${USER_TIMEZONE})`);
          } else {
            actions.push(`AUTO-START FAILED: ${startJson?.message ?? startJson?.error ?? "Unknown error"}`);
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