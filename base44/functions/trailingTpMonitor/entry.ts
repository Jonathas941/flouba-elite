import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

// ── Trailing TP parameters (Gold / XAUUSD configuration) ──
const TRAILING_TRIGGER_USD = 2.0;  // Start trailing after $2.00 profit
const TP_DISTANCE_USD = 1.5;       // Distance to set the new TP ahead of price

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
    // Read body FIRST — SDK may consume the body stream during auth
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    // Auth: cron secret (scheduled automation) OR authenticated user (manual call)
    const cronSecret = Deno.env.get("CRON_SECRET");
    const secretMatch = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret ||
      body.cron_secret === cronSecret
    );

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    let userId = body.user_id || null;

    if (!secretMatch) {
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const user = await base44.auth.me().catch(() => null);
      if (user) userId = user.id;
    }

    // Get BotSettings for the target user (or all users if cron)
    let targetSettings;
    if (userId) {
      targetSettings = await base44.asServiceRole.entities.BotSettings.filter({ created_by_id: userId }, "-created_date", 1);
    } else {
      targetSettings = await base44.asServiceRole.entities.BotSettings.list();
    }

    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const results = [];

    for (const config of targetSettings) {
      if (!config.mt5_account || !config.mt5_password || !config.mt5_server) {
        results.push({ user: config.created_by_id, skipped: "No MT5 credentials" });
        continue;
      }

      const userData = userMap.get(config.created_by_id);
      const jwt = userData?.flouba_token;
      if (!jwt) {
        results.push({ user: config.created_by_id, skipped: "No bridge token" });
        continue;
      }

      const authHeaders = buildHeaders(jwt, config);

      // Fetch account + positions
      const [acctRes, posRes] = await Promise.all([
        fetch(`${BASE}/account`, { headers: authHeaders }).catch(() => null),
        fetch(`${BASE}/positions`, { headers: authHeaders }).catch(() => null),
      ]);

      const acctJson = acctRes?.ok ? await acctRes.json().catch(() => ({})) : {};
      const posJson = posRes?.ok ? await posRes.json().catch(() => ({})) : {};

      const balance = Number(acctJson?.balance ?? acctJson?.data?.balance ?? 0);
      const equity = Number(acctJson?.equity ?? acctJson?.data?.equity ?? 0);
      const positions = posJson?.positions ?? posJson?.data?.positions ?? [];

      const floatingPnl = equity - balance;
      const marginLevelPct = balance > 0 ? (equity / balance) * 100 : 0;

      const modifications = [];

      // Process each open position — apply trailing TP logic
      for (const pos of positions) {
        const ticket = pos.ticket || pos.id;
        const posType = String(pos.type || pos.direction || "").toLowerCase();
        const openPrice = Number(pos.open_price ?? pos.price_open ?? 0);
        const currentPrice = Number(pos.current_price ?? pos.price_current ?? pos.bid ?? 0);
        const currentSL = Number(pos.sl ?? pos.stop_loss ?? 0);
        const currentTP = Number(pos.tp ?? pos.take_profit ?? 0);

        if (!ticket || !openPrice || !currentPrice) continue;

        let shouldModify = false;
        let newTP = currentTP;

        // Trailing logic for BUY orders
        if (posType.includes("buy") || posType === "0") {
          if (currentPrice > openPrice + TRAILING_TRIGGER_USD) {
            const calculatedTP = Math.round((currentPrice + TP_DISTANCE_USD) * 100) / 100;
            if (currentTP === 0 || calculatedTP > currentTP) {
              newTP = calculatedTP;
              shouldModify = true;
            }
          }
        }
        // Trailing logic for SELL orders
        else if (posType.includes("sell") || posType === "1") {
          if (currentPrice < openPrice - TRAILING_TRIGGER_USD) {
            const calculatedTP = Math.round((currentPrice - TP_DISTANCE_USD) * 100) / 100;
            if (currentTP === 0 || calculatedTP < currentTP) {
              newTP = calculatedTP;
              shouldModify = true;
            }
          }
        }

        if (shouldModify) {
          // Send modification command to the bridge
          const modRes = await fetch(`${BASE}/trade/modify`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              ticket: Number(ticket),
              sl: currentSL,
              tp: newTP,
            }),
          }).catch(() => null);

          const modJson = modRes?.ok ? await modRes.json().catch(() => ({})) : {};
          const modSuccess = modJson?.success === true || modRes?.ok;

          modifications.push({
            ticket,
            type: posType,
            open_price: openPrice,
            current_price: currentPrice,
            old_tp: currentTP,
            new_tp: newTP,
            reason: `Trailing TP triggered at ${currentPrice}`,
            sent: modSuccess,
            bridge_response: modJson?.message || modJson?.error || (modRes ? `HTTP ${modRes.status}` : "no response"),
          });
        }
      }

      results.push({
        user: config.created_by_id,
        login: config.mt5_account,
        account_summary: {
          balance: Math.round(balance * 100) / 100,
          equity: Math.round(equity * 100) / 100,
          floating_pnl: Math.round(floatingPnl * 100) / 100,
          margin_level_percent: Math.round(marginLevelPct * 100) / 100,
        },
        positions_checked: positions.length,
        modifications_to_execute: modifications,
        has_modifications: modifications.length > 0,
      });
    }

    return Response.json({
      ok: true,
      usersChecked: results.length,
      results,
      checkedAt: new Date().toISOString(),
      params: { trailing_trigger_usd: TRAILING_TRIGGER_USD, tp_distance_usd: TP_DISTANCE_USD },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});