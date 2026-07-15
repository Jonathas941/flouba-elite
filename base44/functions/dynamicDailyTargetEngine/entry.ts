import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

// ── NY (America/Detroit) timezone helpers ──
function getEtParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
  };
}

function getEtDateStr(now = new Date()) {
  const p = getEtParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// Returns the UTC Date corresponding to 08:00 America/Detroit today (NY session start)
function nySessionStartUtc(now = new Date()) {
  const p = getEtParts(now);
  const etAsUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const offset = now.getTime() - etAsUtcMs; // how far ET is behind UTC (ms)
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 8, 0) + offset);
}

function buildHeaders(token, config) {
  const h = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  if (config.mt5_account) h["X-MT5-Login"] = String(config.mt5_account);
  if (config.mt5_password) h["X-MT5-Password"] = config.mt5_password;
  if (config.mt5_server) h["X-MT5-Server"] = config.mt5_server;
  return h;
}

// ── Core evaluation logic — shared by frontend and cron paths ──
async function evaluateUser(base44, userId, isCron, userMap) {
  const ddtRecords = await base44.asServiceRole.entities.DynamicDailyTargetSettings.filter({
    created_by_id: userId,
  });
  let ddt = ddtRecords[0];
  if (!ddt) return { userId, enabled: false };
  if (!ddt.enabled) {
    return {
      userId, enabled: false, ddt,
      ny_date: getEtDateStr(),
    };
  }

  // ── NY day reset ──
  const todayEt = getEtDateStr();
  const etParts = getEtParts();
  if (ddt.last_reset_date !== todayEt && etParts.hour >= 8) {
    ddt = await base44.asServiceRole.entities.DynamicDailyTargetSettings.update(ddt.id, {
      current_tier: "pre_target",
      realized_today: 0,
      trades_today: 0,
      consecutive_losses: 0,
      lock_message: null,
      last_reset_date: todayEt,
    });
  }

  // ── Today's closed trades (since NY session start) ──
  const sessionStart = nySessionStartUtc();
  const closedTrades = await base44.asServiceRole.entities.Trade.filter({
    created_by_id: userId,
    status: "Closed",
  }, "-closed_at", 50);

  const todayTrades = closedTrades.filter(
    (t) => t.closed_at && new Date(t.closed_at) >= sessionStart
  );
  const realizedToday = todayTrades.reduce((sum, t) => sum + (t.profit ?? 0), 0);
  const tradesToday = todayTrades.length;

  // ── Consecutive losses (most recent first) ──
  const sortedDesc = [...closedTrades].sort(
    (a, b) => new Date(b.closed_at || 0) - new Date(a.closed_at || 0)
  );
  let consecLosses = 0;
  for (const t of sortedDesc) {
    if ((t.profit ?? 0) < 0) consecLosses++;
    else break;
  }

  // ── Tier determination ──
  let tier = "pre_target";
  let lockMessage = null;
  let tradingAllowed = true;
  let riskMultiplier = 1.0;
  let tierNote = "Normal configured risk. Trade freely.";

  if (realizedToday >= ddt.target_final) {
    tier = "final_reached";
    lockMessage = "Daily Target Reached — Trading Locked Until Next Trading Day.";
    tradingAllowed = false;
  } else if (realizedToday <= -ddt.hard_loss_stop) {
    tier = "loss_stopped";
    lockMessage = "Daily Loss Limit Reached — Capital Protection Active.";
    tradingAllowed = false;
  } else if (realizedToday >= ddt.target_2) {
    tier = "tier_2";
    riskMultiplier = (100 - (ddt.risk_reduction_pct ?? 50)) / 100;
    tierNote = `Only trade if strategy score ≥ ${ddt.min_strategy_score_tier2}, spread normal, market strong. Risk reduced ${ddt.risk_reduction_pct}%.`;
  } else if (realizedToday >= ddt.target_1) {
    tier = "tier_1";
    riskMultiplier = (100 - (ddt.risk_reduction_pct ?? 50)) / 100;
    tierNote = `Risk reduced ${ddt.risk_reduction_pct}%. Only A+ high-confidence setups. Do not force trades.`;
  }

  // ── Trade count / consecutive loss gates ──
  if (tradesToday >= (ddt.max_trades ?? 3) && tradingAllowed) {
    tradingAllowed = false;
    lockMessage = lockMessage || `Max daily trades reached (${ddt.max_trades}).`;
  }
  if (consecLosses >= (ddt.stop_after_losses ?? 2) && tradingAllowed) {
    tradingAllowed = false;
    lockMessage = lockMessage || `Stopped after ${ddt.stop_after_losses} consecutive losses. No revenge trades.`;
  }

  // ── Persist state ──
  ddt = await base44.asServiceRole.entities.DynamicDailyTargetSettings.update(ddt.id, {
    current_tier: tier,
    realized_today: realizedToday,
    trades_today: tradesToday,
    consecutive_losses: consecLosses,
    lock_message: lockMessage,
  });

  // ── Auto-stop robot when locked (cron only — avoids stopping on every frontend poll) ──
  let robotStopped = false;
  if (!tradingAllowed && isCron) {
    try {
      const botSettings = await base44.asServiceRole.entities.BotSettings.filter({
        created_by_id: userId,
      });
      const cfg = botSettings[0];
      if (cfg?.mt5_account) {
        const u = userMap?.get(userId);
        const jwt = u?.flouba_token;
        if (jwt) {
          const headers = buildHeaders(jwt, cfg);
          const robotRes = await fetch(`${BASE}/robot/status`, { headers });
          const robotJson = await robotRes.json().catch(() => ({}));
          const robotRunning = robotJson?.running ?? robotJson?.robot?.running ?? false;
          if (robotRunning) {
            await fetch(`${BASE}/robot/stop`, { method: "POST", headers });
            robotStopped = true;
          }
        }
      }
    } catch {}
  }

  return {
    userId,
    enabled: true,
    tier,
    realized_today: realizedToday,
    trades_today: tradesToday,
    consecutive_losses: consecLosses,
    trading_allowed: tradingAllowed,
    risk_multiplier: riskMultiplier,
    lock_message: lockMessage,
    tier_note: tierNote,
    robot_stopped: robotStopped,
    targets: {
      target_1: ddt.target_1,
      target_2: ddt.target_2,
      target_final: ddt.target_final,
      hard_loss_stop: ddt.hard_loss_stop,
    },
    limits: {
      max_trades: ddt.max_trades,
      max_open_positions: ddt.max_open_positions,
      stop_after_losses: ddt.stop_after_losses,
      risk_reduction_pct: ddt.risk_reduction_pct,
      min_strategy_score_tier2: ddt.min_strategy_score_tier2,
    },
    account_mode: ddt.account_mode,
    last_reset_date: ddt.last_reset_date,
    ny_date: todayEt,
  };
}

const EDITABLE_KEYS = [
  "target_1", "target_2", "target_final", "hard_loss_stop",
  "max_trades", "max_open_positions", "stop_after_losses",
  "risk_reduction_pct", "min_strategy_score_tier2", "account_mode",
];

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}

    const base44 = createClientFromRequest(req);

    // ── Auth: cron secret OR authenticated user ──
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret ||
      body.cron_secret === cronSecret
    );

    if (!isCron) {
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) return Response.json({ error: "Unauthorized" }, { status: 403 });
      const user = await base44.auth.me().catch(() => null);
      if (!user) {
        // Internal scheduler (isAuthenticated=true, me()=null) — process all enabled users
        const allDdt = await base44.asServiceRole.entities.DynamicDailyTargetSettings.list();
        const allUsers = await base44.asServiceRole.entities.User.list();
        const userMap = new Map(allUsers.map((u) => [u.id, u]));
        const results = [];
        for (const ddt of allDdt) {
          if (!ddt.enabled || !ddt.created_by_id) continue;
          try {
            const result = await evaluateUser(base44, ddt.created_by_id, true, userMap);
            results.push(result);
          } catch (e) {
            results.push({ userId: ddt.created_by_id, error: e.message });
          }
        }
        return Response.json({ ok: true, usersProcessed: results.length, results, checkedAt: new Date().toISOString() });
      }

      // Ensure a DDT record exists for this user
      let ddtRecords = await base44.entities.DynamicDailyTargetSettings.list();
      if (!ddtRecords.length) {
        await base44.entities.DynamicDailyTargetSettings.create({
          enabled: false,
          account_mode: "Aggressive Scalping",
          target_1: 75, target_2: 120, target_final: 200,
          hard_loss_stop: 60, max_trades: 3, max_open_positions: 1,
          stop_after_losses: 2, risk_reduction_pct: 50, min_strategy_score_tier2: 85,
          current_tier: "pre_target",
          realized_today: 0, trades_today: 0, consecutive_losses: 0,
          last_reset_date: getEtDateStr(),
        });
      }

      // Handle settings update
      if (body.action === "update_settings" && body.settings) {
        ddtRecords = await base44.entities.DynamicDailyTargetSettings.list();
        const ddt = ddtRecords[0];
        const updateData = {};
        for (const key of EDITABLE_KEYS) {
          if (body.settings[key] != null) updateData[key] = body.settings[key];
        }
        if (ddt) {
          await base44.entities.DynamicDailyTargetSettings.update(ddt.id, updateData);
        } else {
          updateData.last_reset_date = getEtDateStr();
          await base44.entities.DynamicDailyTargetSettings.create(updateData);
        }
      }

      // Handle enable/disable toggle
      if (body.action === "toggle") {
        ddtRecords = await base44.entities.DynamicDailyTargetSettings.list();
        const ddt = ddtRecords[0];
        const newEnabled = body.enabled ?? !ddt?.enabled ?? true;
        if (ddt) {
          await base44.entities.DynamicDailyTargetSettings.update(ddt.id, { enabled: newEnabled });
        } else {
          await base44.entities.DynamicDailyTargetSettings.create({
            enabled: newEnabled,
            last_reset_date: getEtDateStr(),
          });
        }
      }

      // Handle manual reset of daily limits
      if (body.action === "reset") {
        ddtRecords = await base44.entities.DynamicDailyTargetSettings.list();
        const ddt = ddtRecords[0];
        if (ddt) {
          await base44.entities.DynamicDailyTargetSettings.update(ddt.id, {
            current_tier: "pre_target",
            realized_today: 0,
            trades_today: 0,
            consecutive_losses: 0,
            lock_message: null,
            last_reset_date: getEtDateStr(),
          });
        }
      }

      // Evaluate for this user
      const allUsers = await base44.asServiceRole.entities.User.list();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const result = await evaluateUser(base44, user.id, false, userMap);
      return Response.json({ ok: true, ...result });
    }

    // ── Cron mode — process all users with DDT enabled ──
    const allDdt = await base44.asServiceRole.entities.DynamicDailyTargetSettings.list();
    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const results = [];
    for (const ddt of allDdt) {
      if (!ddt.enabled || !ddt.created_by_id) continue;
      try {
        const result = await evaluateUser(base44, ddt.created_by_id, true, userMap);
        results.push(result);
      } catch (e) {
        results.push({ userId: ddt.created_by_id, error: e.message });
      }
    }

    return Response.json({
      ok: true,
      usersProcessed: results.length,
      results,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});