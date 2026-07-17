import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const BASE = "https://dazzling-perception-production-8e53.up.railway.app/api";

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

// ── Compute EMA from an array of close prices ──
function computeEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

// ── Fetch HTF candles and determine trend direction via EMA ──
async function getTrendDirection(authHeaders, symbol, timeframe, emaPeriod) {
  const url = `${BASE}/rates?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&count=${emaPeriod + 20}`;
  const res = await fetch(url, { headers: authHeaders }).catch(() => null);
  if (!res?.ok) return null;
  const j = await res.json().catch(() => ({}));
  const candles = j?.candles || j?.rates || j?.data || (Array.isArray(j) ? j : []);
  if (!Array.isArray(candles) || candles.length < emaPeriod) return null;
  const closes = candles.map(c => Number(c.close ?? c[4] ?? 0)).filter(c => c > 0);
  if (closes.length < emaPeriod) return null;
  const ema = computeEMA(closes, emaPeriod);
  const lastClose = closes[closes.length - 1];
  if (lastClose > ema) return "bullish";
  if (lastClose < ema) return "bearish";
  return null;
}

// ── Fetch current bid/ask for a symbol from the bridge ──
async function getCurrentPrice(authHeaders, symbol) {
  const res = await fetch(`${BASE}/symbols`, { headers: authHeaders }).catch(() => null);
  if (!res?.ok) return null;
  const j = await res.json().catch(() => ({}));
  const symbols = j?.symbols || (Array.isArray(j) ? j : []);
  const symUpper = symbol.toUpperCase();
  const baseMatch = symUpper.replace(/[MS]$/i, "");
  const sym = symbols.find(s => {
    const name = (s.symbol || s.name || "").toUpperCase();
    return name === symUpper || name.startsWith(baseMatch);
  });
  if (!sym) return null;
  const bid = Number(sym.bid);
  const ask = Number(sym.ask);
  if (isNaN(bid) || isNaN(ask)) return null;
  return { bid, ask, mid: (bid + ask) / 2 };
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const cronSecret = Deno.env.get("CRON_SECRET");
    const secretMatch = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret || body.cron_secret === cronSecret
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

      // Only process if pyramiding or trailing TP is enabled
      if (!config.pyramiding_enabled && !config.trailing_tp_enabled) {
        results.push({ user: config.created_by_id, skipped: "Pyramiding and trailing TP both disabled" });
        continue;
      }

      const userData = userMap.get(config.created_by_id);
      const jwt = userData?.flouba_token;
      if (!jwt) {
        results.push({ user: config.created_by_id, skipped: "No bridge token" });
        continue;
      }

      const authHeaders = buildHeaders(jwt, config);
      const symbol = config.active_pair || "XAUUSD";
      const symUpper = symbol.toUpperCase();
      const baseMatch = symUpper.replace(/[MS]$/i, "");

      // Fetch positions and account
      const [posRes, acctRes] = await Promise.all([
        fetch(`${BASE}/positions`, { headers: authHeaders }).catch(() => null),
        fetch(`${BASE}/account`, { headers: authHeaders }).catch(() => null),
      ]);

      const posJson = posRes?.ok ? await posRes.json().catch(() => ({})) : {};
      const acctJson = acctRes?.ok ? await acctRes.json().catch(() => ({})) : {};

      const allPositions = posJson?.positions ?? posJson?.data?.positions ?? [];
      const balance = Number(acctJson?.balance ?? acctJson?.data?.balance ?? 0);
      const equity = Number(acctJson?.equity ?? acctJson?.data?.equity ?? 0);

      // Filter to positions matching our symbol (XAUUSD, XAUUSDm, etc.)
      const symbolPositions = allPositions.filter(p => {
        const psym = String(p.symbol || "").toUpperCase();
        return psym === symUpper || psym.startsWith(baseMatch);
      });

      if (symbolPositions.length === 0) {
        results.push({
          user: config.created_by_id,
          login: config.mt5_account,
          symbol,
          positions: 0,
          actions: ["No open positions for symbol — nothing to pyramid or trail"],
        });
        continue;
      }

      // Determine position direction (all should be same for pyramiding)
      const firstPosType = String(symbolPositions[0].type || symbolPositions[0].direction || "").toLowerCase();
      const isBuy = firstPosType.includes("buy") || firstPosType === "0";
      const isSell = firstPosType.includes("sell") || firstPosType === "1";
      const direction = isBuy ? "buy" : (isSell ? "sell" : null);

      if (!direction) {
        results.push({ user: config.created_by_id, skipped: "Cannot determine position direction" });
        continue;
      }

      // Get current price
      const priceInfo = await getCurrentPrice(authHeaders, symbol);
      const currentPrice = priceInfo?.mid ?? Number(symbolPositions[0].current_price ?? symbolPositions[0].price_current ?? 0);

      if (!currentPrice) {
        results.push({ user: config.created_by_id, skipped: "No current price available" });
        continue;
      }

      const actions = [];
      let pyramidingAction = null;
      let trailingAction = null;

      // ═══════════════════════════════════════════════════════════════
      // PHASE II: POSITION ACCUMULATION (PYRAMIDING / SCALE-INS)
      // ═══════════════════════════════════════════════════════════════
      if (config.pyramiding_enabled) {
        const maxLayers = config.pyramiding_max_layers ?? 5;
        const stepUsd = config.pyramiding_step_usd ?? 2.0;
        const pyrLot = config.pyramiding_lot_size ?? 0.01;

        if (symbolPositions.length < maxLayers) {
          // The most recent entry is the one closest to current price in the favorable direction.
          // For BUY: highest entry price = most recent (price went up to trigger scale-in).
          // For SELL: lowest entry price = most recent (price went down to trigger scale-in).
          const lastEntryPrice = isBuy
            ? Math.max(...symbolPositions.map(p => Number(p.open_price ?? p.price_open ?? 0)))
            : Math.min(...symbolPositions.map(p => Number(p.open_price ?? p.price_open ?? 0)));

          // Measure favorable distance from last entry
          const favorableDistance = isBuy
            ? (currentPrice - lastEntryPrice)
            : (lastEntryPrice - currentPrice);

          if (favorableDistance >= stepUsd) {
            // Check HTF trend confirmation if required
            let trendValid = true;
            if (config.pyramiding_require_trend) {
              const trendTf = config.pyramiding_trend_timeframe || "H1";
              const trendEma = config.pyramiding_trend_ema_period || 200;
              const trend = await getTrendDirection(authHeaders, symbol, trendTf, trendEma);
              if (trend === null) {
                trendValid = false;
                actions.push("PYRAMID SKIPPED: could not confirm HTF trend");
              } else if (isBuy && trend !== "bullish") {
                trendValid = false;
                actions.push(`PYRAMID SKIPPED: HTF trend is ${trend}, not bullish`);
              } else if (isSell && trend !== "bearish") {
                trendValid = false;
                actions.push(`PYRAMID SKIPPED: HTF trend is ${trend}, not bearish`);
              }
            }

            if (trendValid) {
              // Execute scale-in entry
              const tradeAction = isBuy ? "buy" : "sell";
              const tradeRes = await fetch(`${BASE}/trade/${tradeAction}`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                  symbol,
                  lot_size: pyrLot,
                  sl: 0,
                  tp: 0,
                }),
              }).catch(() => null);

              const tradeJson = tradeRes?.ok ? await tradeRes.json().catch(() => ({})) : {};
              const tradeSuccess = tradeJson?.success === true || tradeRes?.ok;

              pyramidingAction = {
                action: "scale_in",
                direction: tradeAction,
                lot_size: pyrLot,
                trigger_price: currentPrice,
                last_entry: lastEntryPrice,
                favorable_distance: Math.round(favorableDistance * 100) / 100,
                layers_before: symbolPositions.length,
                layers_after: symbolPositions.length + 1,
                max_layers: maxLayers,
                sent: tradeSuccess,
                bridge_response: tradeJson?.message || tradeJson?.error || (tradeRes ? `HTTP ${tradeRes.status}` : "no response"),
              };
              actions.push(`PYRAMID: ${tradeAction} ${pyrLot} lot at ~${currentPrice} (layer ${symbolPositions.length + 1}/${maxLayers})`);
            }
          } else {
            actions.push(`PYRAMID WAIT: favorable distance $${Math.round(favorableDistance * 100) / 100} < step $${stepUsd}`);
          }
        } else {
          actions.push(`PYRAMID MAX: ${symbolPositions.length}/${maxLayers} layers reached`);
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE III: DYNAMIC PROFIT SECURING (TRAILING TP)
      // ═══════════════════════════════════════════════════════════════
      // Re-fetch positions if we just pyramided (new position added)
      let activePositions = symbolPositions;
      if (pyramidingAction?.sent) {
        const newPosRes = await fetch(`${BASE}/positions`, { headers: authHeaders }).catch(() => null);
        const newPosJson = newPosRes?.ok ? await newPosRes.json().catch(() => ({})) : {};
        const newAllPositions = newPosJson?.positions ?? newPosJson?.data?.positions ?? [];
        activePositions = newAllPositions.filter(p => {
          const psym = String(p.symbol || "").toUpperCase();
          return psym === symUpper || psym.startsWith(baseMatch);
        });
      }

      if (config.trailing_tp_enabled && activePositions.length > 0) {
        const triggerUsd = config.trailing_trigger_usd ?? 2.0;
        const tpDistance = config.trailing_tp_distance_usd ?? 1.5;

        // Calculate total floating P/L from positions
        const totalFloating = activePositions.reduce((sum, p) => sum + Number(p.profit ?? p.pnl ?? 0), 0);
        // Fallback to equity - balance if position profit is unavailable
        const floatingPnl = totalFloating !== 0 ? totalFloating : (equity - balance);

        if (floatingPnl >= triggerUsd) {
          // ── PROGRESSIVE TIGHTENING: trail closer as profit grows to capture more ──
          // Distance shrinks from tpDistance (at trigger) down to minDistance as
          // profit doubles beyond the trigger, locking in more of the trend.
          let effectiveDistance = tpDistance;
          const tightenEnabled = config.trailing_tp_tighten_enabled !== false;
          if (tightenEnabled) {
            const minDistance = config.trailing_tp_min_distance_usd ?? 0.3;
            const profitBeyondTrigger = floatingPnl - triggerUsd;
            const tightenRange = triggerUsd * 2; // fully tight at 3× trigger profit
            const tightenPct = Math.min(1, Math.max(0, profitBeyondTrigger / tightenRange));
            effectiveDistance = tpDistance - (tpDistance - minDistance) * tightenPct;
          }

          // ── DYNAMIC MODE: trail TP ahead of current price ──
          const newGlobalTP = isBuy
            ? Math.round((currentPrice + effectiveDistance) * 100) / 100
            : Math.round((currentPrice - effectiveDistance) * 100) / 100;

          // Find positions whose current TP is worse than the new global TP
          const positionsToModify = activePositions.filter(p => {
            const currentTP = Number(p.tp ?? p.take_profit ?? 0);
            if (currentTP === 0) return true; // no TP set yet
            return isBuy ? (newGlobalTP > currentTP) : (newGlobalTP < currentTP);
          });

          if (positionsToModify.length > 0) {
            // Modify all positions to the new consolidated global TP
            const modifications = [];
            for (const pos of positionsToModify) {
              const ticket = pos.ticket || pos.id;
              const currentSL = Number(pos.sl ?? pos.stop_loss ?? 0);
              if (!ticket) continue;

              const modRes = await fetch(`${BASE}/trade/modify`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                  ticket: Number(ticket),
                  sl: currentSL,
                  tp: newGlobalTP,
                }),
              }).catch(() => null);

              const modJson = modRes?.ok ? await modRes.json().catch(() => ({})) : {};
              const modSuccess = modJson?.success === true || modRes?.ok;
              modifications.push({
                ticket,
                old_tp: Number(pos.tp ?? pos.take_profit ?? 0),
                new_tp: newGlobalTP,
                sent: modSuccess,
              });
            }

            trailingAction = {
              mode: "dynamic",
              floating_pnl: Math.round(floatingPnl * 100) / 100,
              trigger: triggerUsd,
              current_price: currentPrice,
              new_global_tp: newGlobalTP,
              tp_distance: effectiveDistance,
              tp_distance_base: tpDistance,
              tighten_enabled: tightenEnabled,
              positions_modified: modifications.length,
              modifications,
            };
            actions.push(`TRAILING TP (DYNAMIC): set global TP=${newGlobalTP} on ${modifications.length} positions (floating P/L $${Math.round(floatingPnl * 100) / 100}, distance $${Math.round(effectiveDistance * 100) / 100})`);
          } else {
            actions.push(`TRAILING TP (DYNAMIC): all positions already at or beyond TP=${newGlobalTP}`);
          }
        } else {
          actions.push(`TRAILING TP (STATIC): floating P/L $${Math.round(floatingPnl * 100) / 100} < trigger $${triggerUsd}`);
        }
      }

      results.push({
        user: config.created_by_id,
        login: config.mt5_account,
        symbol,
        positions: activePositions.length,
        direction,
        current_price: currentPrice,
        pyramiding: pyramidingAction,
        trailing_tp: trailingAction,
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