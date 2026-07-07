import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Indicator helpers ──

function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

// Find confirmed swing highs / lows (fractal: higher/lower than `lookback` bars on each side)
function findSwings(candles, lookback = 3) {
  const highs = [], lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, time: candles[i].time, price: candles[i].high });
    if (isLow) lows.push({ index: i, time: candles[i].time, price: candles[i].low });
  }
  return { highs, lows };
}

// Bearish FVG: Candle A Low > Candle C High  (gap between A.low and C.high)
// Bullish FVG: Candle A High < Candle C Low  (gap between C.low and A.high)
function detectFVG(candles, direction, minSize) {
  for (let i = candles.length - 3; i >= 0; i--) {
    const a = candles[i], c = candles[i + 2];
    if (direction === "SELL") {
      if (a.low > c.high) {
        const size = a.low - c.high;
        if (size >= minSize) return { high: a.low, low: c.high, size, index: i };
      }
    } else {
      if (a.high < c.low) {
        const size = c.low - a.high;
        if (size >= minSize) return { high: c.low, low: a.high, size, index: i };
      }
    }
  }
  return null;
}

function fmtPrice(v, digits = 5) {
  if (v == null || isNaN(v)) return null;
  return Number(v.toFixed(digits));
}

// ── Main handler ──

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const action = body.action || "scan";
    const symbol = body.symbol || "XAUUSD";

    // Fetch or create user settings
    const settingsRecs = await base44.entities.LSR3RSettings.filter({ created_by_id: user.id }, "-created_date", 1);
    let settings = settingsRecs?.[0];
    if (!settings) {
      settings = await base44.entities.LSR3RSettings.create({ symbol });
    }

    // ── Non-scan actions ──
    if (action === "settings") {
      return Response.json({ ok: true, settings });
    }

    if (action === "update_settings") {
      const updates = body.settings || {};
      settings = await base44.entities.LSR3RSettings.update(settings.id, updates);
      return Response.json({ ok: true, settings });
    }

    if (action === "history") {
      const signals = await base44.entities.LSR3RSignal.filter({ created_by_id: user.id }, "-created_date", 200);
      return Response.json({ ok: true, signals });
    }

    if (action === "analytics") {
      const all = await base44.entities.LSR3RSignal.filter({ created_by_id: user.id }, "-created_date", 500);
      const completed = all.filter(s => s.result === "TP" || s.result === "SL");
      const wins = completed.filter(s => s.result === "TP");
      const losses = completed.filter(s => s.result === "SL");
      const grossProfit = wins.reduce((a, s) => a + (s.pnl || 0), 0);
      const grossLoss = Math.abs(losses.reduce((a, s) => a + (s.pnl || 0), 0));
      const winRate = completed.length ? (wins.length / completed.length) * 100 : 0;
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99 : 0);
      const avgWin = wins.length ? grossProfit / wins.length : 0;
      const avgLoss = losses.length ? grossLoss / losses.length : 0;
      let peak = 0, cum = 0, maxDD = 0;
      for (const s of completed) {
        cum += (s.pnl || 0);
        if (cum > peak) peak = cum;
        const dd = peak - cum;
        if (dd > maxDD) maxDD = dd;
      }
      const byPair = {}, bySession = {}, byDirection = {}, byNews = {};
      const bucket = (obj, key, s) => {
        if (!obj[key]) obj[key] = { wins: 0, losses: 0, pnl: 0, total: 0 };
        obj[key].total++;
        if (s.result === "TP") obj[key].wins++;
        else obj[key].losses++;
        obj[key].pnl += (s.pnl || 0);
      };
      for (const s of completed) {
        bucket(byPair, s.symbol, s);
        bucket(bySession, s.anchor_session, s);
        bucket(byDirection, s.direction, s);
        bucket(byNews, s.news_filtered ? "With News Filter" : "Without News Filter", s);
      }
      return Response.json({
        ok: true,
        analytics: {
          total_signals: all.length,
          total_completed: completed.length,
          wins: wins.length,
          losses: losses.length,
          win_rate: winRate,
          profit_factor: profitFactor,
          avg_win: avgWin,
          avg_loss: avgLoss,
          max_drawdown: maxDD,
          net_profit: cum,
          by_pair: byPair,
          by_session: bySession,
          by_direction: byDirection,
          by_news: byNews,
        }
      });
    }

    // ── SCAN ──

    // Fetch live quotes for spread + current price + broker server time
    let spread = null, currentPrice = null, brokerServerTime = null, connected = false;
    try {
      const qRes = await base44.functions.invoke("mt5Bridge", { action: "symbols" });
      const qd = qRes?.data?.data;
      if (qd) {
        const symbolsArr = qd.symbols || (Array.isArray(qd) ? qd : []);
        const symObj = Array.isArray(symbolsArr)
          ? symbolsArr.find(s => (s.symbol || s.name) === symbol)
          : (qd[symbol] || symbolsArr[symbol]);
        if (symObj) {
          const bid = symObj.bid ?? symObj.Bid;
          const ask = symObj.ask ?? symObj.Ask;
          if (bid != null && ask != null) {
            spread = ask - bid;
            currentPrice = (bid + ask) / 2;
            connected = true;
          }
          brokerServerTime = symObj.time || symObj.server_time || qd.time || qd.server_time;
        }
      }
    } catch {}

    // Fetch account equity/balance
    let equity = settings.account_equity, balance = settings.account_balance;
    try {
      const accRes = await base44.functions.invoke("mt5Bridge", { action: "account" });
      const ad = accRes?.data?.data?.account || accRes?.data?.data;
      if (ad?.equity != null) equity = ad.equity;
      if (ad?.balance != null) balance = ad.balance;
    } catch {}

    // Fetch M1 + M5 candles
    const fetchCandles = async (timeframe, count) => {
      try {
        const r = await base44.functions.invoke("mt5Bridge", { action: "rates", symbol, timeframe, count });
        const d = r?.data?.data;
        const raw = d?.rates || d?.candles || d?.bars || (Array.isArray(d) ? d : []);
        if (!Array.isArray(raw) || raw.length === 0) return null;
        return raw.map(c => ({
          time: typeof c.time === "number" ? c.time : Math.floor(new Date(c.time).getTime() / 1000),
          open: +c.open, high: +c.high, low: +c.low, close: +c.close, volume: +c.volume || 0,
        }));
      } catch { return null; }
    };

    const m1 = await fetchCandles("M1", 150);
    const m5 = await fetchCandles("M5", 80);

    if (!m1 || m1.length < 25 || !connected) {
      return Response.json({
        ok: true,
        status: {
          setup_status: "Market feed disconnected",
          connected: false,
          symbol,
          current_price: currentPrice,
          spread,
          broker_server_time: brokerServerTime,
          equity, balance,
          anchor_high: null, anchor_low: null, anchor_session: null,
        }
      });
    }

    // ── Broker timezone offset ──
    let brokerOffset = settings.broker_timezone_offset ?? 0;
    if (brokerServerTime) {
      const sTime = typeof brokerServerTime === "number" ? brokerServerTime * 1000 : new Date(brokerServerTime).getTime();
      const diffHrs = (sTime - Date.now()) / 3600000;
      brokerOffset = Math.round(diffHrs * 10) / 10; // nearest 0.1h
    }
    const anchorOffset = settings.anchor_timezone_offset ?? 8;

    // Convert anchor hours from GMT+8 to broker time
    const a1H = parseInt(String(settings.anchor_time_1 || "14:00").split(":")[0]);
    const a2H = parseInt(String(settings.anchor_time_2 || "20:00").split(":")[0]);
    const shift = brokerOffset - anchorOffset;
    const a1Broker = ((a1H + shift) % 24 + 24) % 24;
    const a2Broker = ((a2H + shift) % 24 + 24) % 24;

    const nowSec = Math.floor(Date.now() / 1000);
    const expiryMin = settings.setup_expiry_minutes || 75;

    // Find the most recent anchor candle within the expiry window
    let anchor = null, anchorSession = null, anchorHigh = null, anchorLow = null, anchorTime = null;
    for (let i = m1.length - 1; i >= 0; i--) {
      const c = m1[i];
      const brokerHour = ((new Date(c.time * 1000).getUTCHours() + brokerOffset) % 24 + 24) % 24;
      const minsSince = (nowSec - c.time) / 60;
      if ((brokerHour === a1Broker || brokerHour === a2Broker) && minsSince >= 0 && minsSince <= expiryMin) {
        anchor = c;
        anchorHigh = c.high;
        anchorLow = c.low;
        anchorTime = new Date(c.time * 1000).toISOString();
        anchorSession = brokerHour === a1Broker ? settings.anchor_time_1 : settings.anchor_time_2;
        break;
      }
    }

    if (!anchor) {
      return Response.json({
        ok: true,
        status: {
          setup_status: "Waiting for anchor",
          connected: true,
          symbol,
          current_price: fmtPrice(currentPrice, symbol === "XAUUSD" ? 2 : 5),
          spread,
          broker_server_time: brokerServerTime,
          broker_offset: brokerOffset,
          anchor_times_broker: { a1: a1Broker, a2: a2Broker },
          equity, balance,
          anchor_high: null, anchor_low: null, anchor_session: null,
        }
      });
    }

    // ── ATR(14) M1 ──
    const atrM1 = calcATR(m1, 14);
    const atrM5 = calcATR(m5 || m1, 14) || atrM1;

    if (!atrM1 || atrM1 <= 0) {
      return Response.json({ ok: true, status: { setup_status: "Waiting for sweep", connected: true, symbol, anchor_high: anchorHigh, anchor_low: anchorLow, anchor_session: anchorSession, current_price: currentPrice, spread, equity, balance } });
    }

    // ── Buffer calculations ──
    const spreadVal = spread || 0;
    const sweepBuffer = Math.max(1.5 * spreadVal, settings.sweep_buffer_atr_mult * atrM1);
    const slBuffer = Math.max(1.5 * spreadVal, settings.sl_buffer_atr_mult * atrM1);
    const minFvg = Math.max(2 * spreadVal, settings.min_fvg_size_atr_mult * atrM1);
    const minBody = settings.min_break_body_atr_mult * atrM1;
    const minSlDist = Math.max(2.5 * spreadVal, settings.min_sl_distance_atr_mult_m5 * atrM5);
    const maxSlDist = settings.max_sl_distance_atr_mult_m5 * atrM5;

    // Candles after the anchor
    const postAnchor = m1.filter(c => c.time > anchor.time);
    if (postAnchor.length < 3) {
      return Response.json({ ok: true, status: { setup_status: "Waiting for sweep", connected: true, symbol, anchor_high: anchorHigh, anchor_low: anchorLow, anchor_session: anchorSession, anchor_time: anchorTime, current_price: fmtPrice(currentPrice, symbol === "XAUUSD" ? 2 : 5), spread, atr: atrM1, equity, balance } });
    }

    // ── SELL path: sweep above anchor high ──
    let sweepHigh = null, sweepCandleIdx = -1;
    for (let i = 0; i < postAnchor.length; i++) {
      if (postAnchor[i].high >= anchorHigh + sweepBuffer) {
        sweepHigh = postAnchor[i].high;
        sweepCandleIdx = i;
        break;
      }
    }

    // ── BUY path: sweep below anchor low ──
    let sweepLow = null, sweepCandleIdxBuy = -1;
    for (let i = 0; i < postAnchor.length; i++) {
      if (postAnchor[i].low <= anchorLow - sweepBuffer) {
        sweepLow = postAnchor[i].low;
        sweepCandleIdxBuy = i;
        break;
      }
    }

    const bothSwept = sweepHigh != null && sweepLow != null;
    const digits = symbol === "XAUUSD" ? 2 : 5;

    // ── Check for existing active signal this session ──
    const existing = await base44.entities.LSR3RSignal.filter({
      created_by_id: user.id, symbol, anchor_session: anchorSession, anchor_time: anchorTime,
      result: "Pending",
    }, "-created_date", 1);

    // Daily loss / consecutive loss checks
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todaySignals = await base44.entities.LSR3RSignal.filter({
      created_by_id: user.id, symbol, created_date: { $gte: todayStart.toISOString() },
    }, "-created_date", 50);
    const todayCompleted = todaySignals.filter(s => s.result === "TP" || s.result === "SL");
    const todayLoss = todayCompleted.filter(s => s.result === "SL").reduce((a, s) => a + Math.abs(s.pnl || 0), 0);
    const dailyLossLimit = (balance || equity || 0) * (settings.max_daily_loss_pct / 100);
    const dailyLossReached = balance > 0 && todayLoss >= dailyLossLimit;
    const tradesToday = todayCompleted.length;
    const maxTradesReached = tradesToday >= (settings.max_trades_per_day || 2);

    // Consecutive losses
    let consecLosses = 0;
    for (const s of todayCompleted) {
      if (s.result === "SL") consecLosses++;
      else break;
    }
    const consecLossLimitReached = consecLosses >= (settings.max_consecutive_losses || 2);

    // ── SELL setup evaluation ──
    let sellResult = evaluateSetup("SELL", postAnchor, sweepCandleIdx, sweepHigh, anchorHigh, anchorLow, m1, atrM1, atrM5, spreadVal, sweepBuffer, slBuffer, minFvg, minBody, minSlDist, maxSlDist, anchor);

    // ── BUY setup evaluation ──
    let buyResult = evaluateSetup("BUY", postAnchor, sweepCandleIdxBuy, sweepLow, anchorHigh, anchorLow, m1, atrM1, atrM5, spreadVal, sweepBuffer, slBuffer, minFvg, minBody, minSlDist, maxSlDist, anchor);

    // ── Determine best signal ──
    let chosen = null;
    if (sellResult?.valid && buyResult?.valid) {
      // Prefer the one whose sweep happened first
      chosen = (sweepCandleIdx >= 0 && (sweepCandleIdxBuy < 0 || sweepCandleIdx <= sweepCandleIdxBuy)) ? sellResult : buyResult;
    } else if (sellResult?.valid) {
      chosen = sellResult;
    } else if (buyResult?.valid) {
      chosen = buyResult;
    }

    // ── Apply safety filters ──
    let skipReason = null;
    if (existing?.length) skipReason = "Active signal already exists for this session";
    else if (dailyLossReached) skipReason = "Daily loss limit reached";
    else if (maxTradesReached) skipReason = "Maximum trades per day reached";
    else if (consecLossLimitReached) skipReason = "Two consecutive losses — scanner paused";
    else if (bothSwept) skipReason = "Both anchor high and low already swept";
    else if (chosen) {
      // Spread filter
      if (settings.spread_filter_enabled && chosen.slDistance > 0) {
        const spreadPct = (spreadVal / chosen.slDistance) * 100;
        if (spreadPct > (settings.max_spread_pct_of_sl || 12)) skipReason = `Spread too wide (${spreadPct.toFixed(1)}% of SL)`;
      }
      // SL distance filter
      if (!skipReason && chosen.slDistance < minSlDist) skipReason = "Stop loss too close";
      if (!skipReason && chosen.slDistance > maxSlDist) skipReason = "Stop loss too large";
    }

    // ── FVG entry expiry (20 min) ──
    if (chosen && !skipReason) {
      const fvgAge = (nowSec - m1[chosen.fvg.index + 2].time) / 60;
      if (fvgAge > (settings.fvg_entry_expiry_minutes || 20)) {
        skipReason = "FVG not touched within 20 minutes";
        chosen.valid = false;
      }
    }

    // ── Lot size calculation ──
    let lotSize = null, lotSkipReason = null;
    if (chosen && !skipReason) {
      const riskAmt = (equity || balance || 0) * (settings.risk_per_trade_pct / 100);
      const tickVal = settings.tick_value || (symbol === "XAUUSD" ? 1 : 1);
      const tickSize = settings.tick_size || (symbol === "XAUUSD" ? 0.01 : 0.00001);
      const minLot = settings.min_lot || 0.01;
      const lotStep = settings.lot_step || 0.01;
      if (chosen.slDistance > 0 && tickSize > 0 && tickVal > 0) {
        const slTicks = chosen.slDistance / tickSize;
        const rawLot = riskAmt / (slTicks * tickVal);
        lotSize = Math.floor(rawLot / lotStep) * lotStep;
        if (lotSize < minLot) {
          lotSkipReason = "Trade skipped: minimum broker lot exceeds your risk limit.";
          lotSize = null;
        }
        chosen.riskAmount = riskAmt;
        chosen.lotSize = lotSize;
      }
    }

    // ── Create or update signal ──
    let signalRecord = null;
    if (chosen && !skipReason && !lotSkipReason) {
      // Check for invalidation: new high before entry on SELL, new low before entry on BUY
      let invalidated = false, invalidReason = null;
      for (const c of postAnchor) {
        if (chosen.direction === "SELL" && c.high > chosen.sweepExtreme) {
          invalidated = true; invalidReason = "New invalidating high before entry"; break;
        }
        if (chosen.direction === "BUY" && c.low < chosen.sweepExtreme) {
          invalidated = true; invalidReason = "New invalidating low before entry"; break;
        }
      }

      if (invalidated) {
        signalRecord = await base44.entities.LSR3RSignal.create({
          symbol, direction: chosen.direction, anchor_session: anchorSession,
          anchor_high: anchorHigh, anchor_low: anchorLow, anchor_time: anchorTime,
          sweep_high: chosen.direction === "SELL" ? chosen.sweepExtreme : null,
          sweep_low: chosen.direction === "BUY" ? chosen.sweepExtreme : null,
          choch_level: chosen.chochLevel,
          fvg_high: chosen.fvg.high, fvg_low: chosen.fvg.low,
          entry_price: chosen.entry, stop_loss: chosen.sl, take_profit: chosen.tp,
          risk_reward: settings.risk_reward || 3,
          risk_amount: chosen.riskAmount, lot_size: chosen.lotSize,
          result: "Invalidated", setup_status: "Setup invalidated",
          reason: invalidReason, is_demo: settings.demo_mode,
          broker_time_offset: brokerOffset, spread_at_signal: spreadVal, atr_at_signal: atrM1,
          close_time: new Date().toISOString(), close_reason: invalidReason,
        });
      } else {
        const expiry = new Date(anchor.time * 1000 + expiryMin * 60000).toISOString();
        signalRecord = await base44.entities.LSR3RSignal.create({
          symbol, direction: chosen.direction, anchor_session: anchorSession,
          anchor_high: anchorHigh, anchor_low: anchorLow, anchor_time: anchorTime,
          sweep_high: chosen.direction === "SELL" ? chosen.sweepExtreme : null,
          sweep_low: chosen.direction === "BUY" ? chosen.sweepExtreme : null,
          choch_level: chosen.chochLevel,
          fvg_high: chosen.fvg.high, fvg_low: chosen.fvg.low,
          entry_price: chosen.entry, stop_loss: chosen.sl, take_profit: chosen.tp,
          risk_reward: settings.risk_reward || 3,
          risk_amount: chosen.riskAmount, lot_size: chosen.lotSize,
          result: "Pending", setup_status: "Entry signal ready",
          expiry_time: expiry, entry_time: new Date().toISOString(),
          reason: chosen.reason, is_demo: settings.demo_mode,
          broker_time_offset: brokerOffset, spread_at_signal: spreadVal, atr_at_signal: atrM1,
        });

        // Send notification
        if (settings.notifications_enabled) {
          const dir = chosen.direction;
          await base44.entities.Notification.create({
            type: "trade", category: dir === "BUY" ? "success" : "warning",
            title: `LSR-3R ${dir} Signal Ready — ${symbol} M1`,
            message: `Entry: ${fmtPrice(chosen.entry, digits)}\nSL: ${fmtPrice(chosen.sl, digits)}\nTP: ${fmtPrice(chosen.tp, digits)}\nRisk/Reward: 1:${settings.risk_reward || 3}\nSession: ${anchorSession}\nStatus: Waiting for FVG retest.`,
            meta: { module: "lsr3r", symbol, direction: dir, signal_id: signalRecord.id },
          });
        }
      }
    } else if (skipReason || lotSkipReason) {
      // Log skipped setup
      if (chosen) {
        await base44.entities.LSR3RSignal.create({
          symbol, direction: chosen.direction, anchor_session: anchorSession,
          anchor_high: anchorHigh, anchor_low: anchorLow, anchor_time: anchorTime,
          entry_price: chosen.entry, stop_loss: chosen.sl, take_profit: chosen.tp,
          risk_reward: settings.risk_reward || 3,
          result: "Skipped", setup_status: "Setup invalidated",
          reason: lotSkipReason || skipReason, is_demo: settings.demo_mode,
          broker_time_offset: brokerOffset,
        });
      }
      if (settings.notifications_enabled && (skipReason === "Daily loss limit reached" || skipReason === "Two consecutive losses — scanner paused")) {
        await base44.entities.Notification.create({
          type: "alert", category: "danger",
          title: "LSR-3R Scanner Paused",
          message: skipReason,
          meta: { module: "lsr3r", symbol },
        });
      }
    }

    // ── Build response status ──
    let setupStatus = "Waiting for sweep";
    if (chosen?.valid && !skipReason && !lotSkipReason && signalRecord?.result === "Pending") {
      setupStatus = "Entry signal ready";
    } else if (chosen?.valid && !skipReason && lotSkipReason) {
      setupStatus = "Setup invalidated";
    } else if (chosen?.chochConfirmed && chosen?.fvg) {
      setupStatus = "FVG detected";
    } else if (chosen?.chochConfirmed) {
      setupStatus = "CHOCH confirmed";
    } else if (sellResult?.swept || buyResult?.swept) {
      setupStatus = "Sweep detected";
    } else if (skipReason) {
      setupStatus = "Setup invalidated";
    }

    // Check expiry
    if (existing?.length && signalRecord?.result !== "Pending") {
      const ageMin = (nowSec - anchor.time) / 60;
      if (ageMin > expiryMin) setupStatus = "Session completed";
    }

    // Expire pending signals past their window
    if (existing?.length) {
      const ageMin = (nowSec - anchor.time) / 60;
      if (ageMin > expiryMin) {
        await base44.entities.LSR3RSignal.update(existing[0].id, {
          result: "Expired", setup_status: "Session completed",
          close_time: new Date().toISOString(), close_reason: "Setup expired",
        });
        if (settings.notifications_enabled) {
          await base44.entities.Notification.create({
            type: "alert", category: "info",
            title: "LSR-3R Signal Expired",
            message: `${symbol} ${existing[0].direction} signal expired after ${expiryMin} min session window.`,
            meta: { module: "lsr3r", symbol },
          });
        }
        setupStatus = "Session completed";
      }
    }

    return Response.json({
      ok: true,
      status: {
        setup_status: setupStatus,
        connected: true,
        symbol,
        current_price: fmtPrice(currentPrice, digits),
        spread: spreadVal,
        broker_server_time: brokerServerTime,
        broker_offset: brokerOffset,
        anchor_times_broker: { a1: `${a1Broker}:00`, a2: `${a2Broker}:00` },
        anchor_high: fmtPrice(anchorHigh, digits),
        anchor_low: fmtPrice(anchorLow, digits),
        anchor_session: anchorSession,
        anchor_time: anchorTime,
        atr_m1: atrM1, atr_m5: atrM5,
        sweep_high: sweepHigh ? fmtPrice(sweepHigh, digits) : null,
        sweep_low: sweepLow ? fmtPrice(sweepLow, digits) : null,
        direction: chosen?.valid && !skipReason && !lotSkipReason ? chosen.direction : (chosen?.direction || null),
        entry: chosen?.entry ? fmtPrice(chosen.entry, digits) : null,
        stop_loss: chosen?.sl ? fmtPrice(chosen.sl, digits) : null,
        take_profit: chosen?.tp ? fmtPrice(chosen.tp, digits) : null,
        risk_reward: settings.risk_reward || 3,
        risk_amount: chosen?.riskAmount || null,
        lot_size: chosen?.lotSize || null,
        lot_skip_reason: lotSkipReason,
        skip_reason: skipReason,
        fvg_high: chosen?.fvg?.high ? fmtPrice(chosen.fvg.high, digits) : null,
        fvg_low: chosen?.fvg?.low ? fmtPrice(chosen.fvg.low, digits) : null,
        choch_level: chosen?.chochLevel ? fmtPrice(chosen.chochLevel, digits) : null,
        expiry_time: signalRecord?.expiry_time || null,
        signal_id: signalRecord?.id || null,
        equity, balance,
        daily_loss: todayLoss,
        daily_loss_limit: dailyLossLimit,
        trades_today: tradesToday,
        consecutive_losses: consecLosses,
        is_demo: settings.demo_mode,
      }
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ── Setup evaluation ──
function evaluateSetup(direction, postAnchor, sweepIdx, sweepExtreme, anchorHigh, anchorLow, m1, atrM1, atrM5, spread, sweepBuffer, slBuffer, minFvg, minBody, minSlDist, maxSlDist, anchor) {
  if (sweepIdx < 0 || sweepExtreme == null) return { swept: false, valid: false };

  const sweepCandles = postAnchor.slice(0, sweepIdx + 1);
  const afterSweep = postAnchor.slice(sweepIdx + 1);

  // Condition 2 (SELL): candle closes back below anchor high
  // Condition 2 (BUY): candle closes back above anchor low
  let rejectionIdx = -1;
  for (let i = 0; i < afterSweep.length; i++) {
    if (direction === "SELL" && afterSweep[i].close < anchorHigh) { rejectionIdx = i; break; }
    if (direction === "BUY" && afterSweep[i].close > anchorLow) { rejectionIdx = i; break; }
  }
  if (rejectionIdx < 0) return { swept: true, valid: false, setup_status: "Waiting for CHOCH" };

  // Condition 3: CHOCH — break of most recent M1 swing before sweep
  const preSweepM1 = m1.filter(c => c.time < postAnchor[sweepIdx].time);
  const swings = findSwings(preSweepM1, 3);
  let chochLevel = null, chochIdx = -1;
  if (direction === "SELL") {
    // Need break below most recent swing low
    const recentLows = swings.lows;
    if (recentLows.length === 0) return { swept: true, valid: false };
    chochLevel = recentLows[recentLows.length - 1].price;
    for (let i = rejectionIdx; i < afterSweep.length; i++) {
      if (afterSweep[i].close < chochLevel) { chochIdx = i; break; }
    }
  } else {
    const recentHighs = swings.highs;
    if (recentHighs.length === 0) return { swept: true, valid: false };
    chochLevel = recentHighs[recentHighs.length - 1].price;
    for (let i = rejectionIdx; i < afterSweep.length; i++) {
      if (afterSweep[i].close > chochLevel) { chochIdx = i; break; }
    }
  }
  if (chochIdx < 0) return { swept: true, valid: false, chochConfirmed: false, setup_status: "Waiting for CHOCH" };

  // Condition 4: break candle must be bearish (SELL) / bullish (BUY), body >= 0.80 × ATR
  const breakCandle = afterSweep[chochIdx];
  const body = Math.abs(breakCandle.close - breakCandle.open);
  const isBearish = breakCandle.close < breakCandle.open;
  const isBullish = breakCandle.close > breakCandle.open;
  if (direction === "SELL" && (!isBearish || body < minBody)) return { swept: true, valid: false, chochConfirmed: true, setup_status: "CHOCH confirmed" };
  if (direction === "BUY" && (!isBullish || body < minBody)) return { swept: true, valid: false, chochConfirmed: true, setup_status: "CHOCH confirmed" };

  // Condition 5: FVG detection
  const candlesForFvg = afterSweep.slice(0, chochIdx + 3);
  if (candlesForFvg.length < 3) return { swept: true, valid: false, chochConfirmed: true, setup_status: "CHOCH confirmed" };
  const fvg = detectFVG(candlesForFvg, direction, minFvg);
  if (!fvg) return { swept: true, valid: false, chochConfirmed: true, setup_status: "CHOCH confirmed" };

  // Condition 7: Entry = 50% midpoint of FVG
  const entry = (fvg.high + fvg.low) / 2;

  // Condition 8 & 9: SL and TP
  let sl, tp, risk, slDistance;
  if (direction === "SELL") {
    sl = sweepExtreme + slBuffer;
    risk = sl - entry;
    tp = entry - (risk * 3);
    slDistance = Math.abs(sl - entry);
  } else {
    sl = sweepExtreme - slBuffer;
    risk = entry - sl;
    tp = entry + (risk * 3);
    slDistance = Math.abs(entry - sl);
  }

  if (risk <= 0 || slDistance <= 0) return { swept: true, valid: false, chochConfirmed: true, fvg, setup_status: "FVG detected" };

  return {
    swept: true, valid: true, chochConfirmed: true, fvg,
    sweepExtreme, chochLevel, entry, sl, tp, risk, slDistance,
    direction, setup_status: "Entry signal ready",
    reason: `${direction} setup: sweep + CHOCH + FVG confirmed`,
  };
}