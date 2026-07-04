import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import GlassCard from "@/components/GlassCard";
import {
  Activity, TrendingUp, TrendingDown, Minus, ShieldAlert, Target,
  Layers, Gauge, Lock, CheckCircle2, XCircle, Loader2, Clock, Crosshair, Box, BarChart3, Newspaper,
} from "lucide-react";

const STRATEGY_NAME = "Gold Morning Range Breakout";

// America/New_York time helpers (DST-aware via Intl)
function nowET() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false,
    weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday").value;
  const hh = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const mm = parseInt(parts.find((p) => p.type === "minute").value, 10);
  const ss = parseInt(parts.find((p) => p.type === "second").value, 10);
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: dayMap[wd] ?? 0, minutes: hh * 60 + mm, seconds: ss, hh, mm };
}

function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function minutesUntil(targetMin, now) {
  let diff = targetMin - now.minutes;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function Chip({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: "text-white/70 bg-white/5 border-white/10",
    up: "text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/25",
    down: "text-[#ff4d4d] bg-[#ff4d4d]/10 border-[#ff4d4d]/25",
    warn: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    cool: "text-amber-300 bg-amber-400/10 border-amber-400/25",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-[8px] uppercase tracking-[0.2em] opacity-70 font-heading">{label}</p>
      <p className="font-heading font-bold text-[12px] mt-0.5 truncate">{value}</p>
    </div>
  );
}

function StatusRow({ icon: Icon, label, value, tone }) {
  const toneClass = tone === "up" ? "text-[#00ff9d]" : tone === "down" ? "text-[#ff4d4d]" : tone === "warn" ? "text-amber-400" : tone === "cool" ? "text-amber-300" : "text-white/70";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${toneClass}`} />
        <span className="text-[11px] text-white/55">{label}</span>
      </div>
      <span className={`text-[11px] font-heading font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}

export default function GoldMorningRangeLiveCard() {
  const [connected, setConnected] = useState(false);
  const [quote, setQuote] = useState(null);
  const [account, setAccount] = useState(null);
  const [ind, setInd] = useState(null);
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => nowET());

  const load = async () => {
    try {
      const [acct, scan, quotes, tr, stg] = await Promise.all([
        mt5Api.account().catch(() => null),
        mt5Api.scannerStatus().catch(() => null),
        mt5Api.quotes().catch(() => null),
        base44.entities.Trade.list("-closed_at", 30).catch(() => []),
        base44.entities.BotSettings.list("-created_date", 1).catch(() => []),
      ]);
      const a = acct?.ok && acct.data?.account;
      setConnected(a?.connected === true);
      setAccount(a);
      setInd(scan?.ok ? scan.data?.scanner?.indicators || scan.data?.indicators || null : null);
      const syms = quotes?.ok ? (quotes.data?.symbols || []) : [];
      const pair = "XAUUSD";
      const sym = (Array.isArray(syms) ? syms : []).find((s) => (s.symbol || "").toUpperCase() === pair) ||
        (Array.isArray(syms) ? syms[0] : null);
      setQuote(sym && sym.bid != null ? { bid: Number(sym.bid), ask: Number(sym.ask), spread: sym.spread != null ? Number(sym.spread) : Number(sym.ask) - Number(sym.bid) } : null);
      setTrades(Array.isArray(tr) ? tr : []);
      setSettings(stg?.[0] || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    const tick = setInterval(() => setNow(nowET()), 1000);
    return () => { clearInterval(id); clearInterval(tick); };
  }, []);

  const s = settings || {};
  const pair = "XAUUSD";
  const price = quote?.bid ?? null;
  const spread = quote?.spread ?? null;
  const atr = ind?.atr_14 ?? ind?.atr14 ?? null;

  // Morning range high/low — prefer backend-computed fields, else fall back
  const mrHigh = ind?.morningrange_high ?? ind?.gmr_high ?? null;
  const mrLow = ind?.morningrange_low ?? ind?.gmr_low ?? null;
  const mrMid = mrHigh != null && mrLow != null ? (mrHigh + mrLow) / 2 : null;

  // tick volume vs average during range
  const tickVol = ind?.tick_volume ?? ind?.volume ?? null;
  const avgVol = ind?.avg_tick_volume ?? ind?.volume_avg ?? null;
  const volMult = s.gmr_volume_threshold_mult ?? 1;
  const useVol = s.gmr_use_volume_filter !== false;
  const volOk = !useVol || (tickVol != null && avgVol != null && avgVol > 0 && tickVol / avgVol >= volMult);
  const volUnknown = useVol && (tickVol == null || avgVol == null);

  // Phase determination (all times ET)
  const RANGE_START = 8 * 60;        // 08:00
  const RANGE_END = 9 * 60 + 30;     // 09:30
  const ENTRY_END = 11 * 60;          // 11:00

  const isWeekend = now.day === 6 || (now.day === 0 && now.minutes < 17 * 60 + 10);
  const fridayLate = now.day === 5 && now.minutes >= 16 * 60 + 55;

  let phase = "pre";
  let phaseLabel = "Pre-open";
  if (isWeekend || fridayLate) { phase = "closed"; phaseLabel = "Market closed"; }
  else if (now.minutes >= RANGE_START && now.minutes < RANGE_END) { phase = "building"; phaseLabel = "Building range"; }
  else if (now.minutes >= RANGE_END && now.minutes < ENTRY_END) { phase = "entry"; phaseLabel = "Entry window open"; }
  else if (now.minutes >= ENTRY_END) { phase = "cutoff"; phaseLabel = "Cutoff reached"; }

  const cdToOpen = phase === "pre" ? minutesUntil(RANGE_END, now) * 60 - now.seconds : null;
  const cdToCutoff = phase === "entry" ? minutesUntil(ENTRY_END, now) * 60 - now.seconds : null;

  // trades today (this symbol)
  const todayKey = new Date().toDateString();
  const tradesToday = trades.filter((t) => (t.pair || "").toUpperCase() === pair && t.opened_at && new Date(t.opened_at).toDateString() === todayKey);
  const tradesTakenToday = tradesToday.length;

  // risk gates
  const realizedToday = trades
    .filter((t) => t.closed_at && new Date(t.closed_at).toDateString() === todayKey)
    .reduce((sum, t) => sum + (t.profit ?? 0), 0);
  const balance = account?.balance ?? s.balance ?? 0;
  const dailyLossPct = balance > 0 ? Math.min(0, realizedToday) / balance * 100 : 0;
  const dailyLossHit = dailyLossPct <= -(s.gmr_max_daily_loss_pct ?? 2);
  const equityStopLevel = balance > 0 ? balance * (1 - (s.gmr_equity_stop_pct ?? 3) / 100) : null;
  const equityStopHit = balance > 0 && (account?.equity ?? balance) <= equityStopLevel;
  const dailyTarget = s.daily_profit_target_amount ?? s.daily_profit_target ?? 100;
  const targetReached = realizedToday >= dailyTarget && (s.stop_trading_at_daily_target !== false);

  let consecLosses = 0;
  for (const t of trades) { if ((t.profit ?? 0) < 0) consecLosses++; else break; }
  const maxConsec = s.gmr_max_consecutive_losses ?? 2;
  const cooldownH = s.gmr_cooldown_hours ?? 8;
  const lastLoss = trades.find((t) => (t.profit ?? 0) < 0);
  const lastLossAt = lastLoss?.closed_at ? new Date(lastLoss.closed_at).getTime() : null;
  const cooldownEnd = consecLosses >= maxConsec && lastLossAt ? lastLossAt + cooldownH * 3600 * 1000 : null;
  const cooldownActive = cooldownEnd != null && Date.now() < cooldownEnd;

  const spreadOk = spread == null || spread <= (s.gmr_max_spread_points ?? 30);
  const rangeOk = mrHigh != null && mrLow != null;
  const rangeSize = rangeOk ? mrHigh - mrLow : null;
  const minRange = s.gmr_min_range_points ?? 20;
  const maxRange = s.gmr_max_range_points ?? 400;
  const rangeSizeOk = rangeSize != null ? rangeSize >= minRange && rangeSize <= maxRange : false;
  const atrOk = !(s.gmr_use_atr_filter !== false) || (atr != null && atr >= (s.gmr_min_atr ?? 0));
  const maxTrades = s.gmr_max_trades_per_day ?? 2;
  const capHit = tradesTakenToday >= maxTrades;
  // news: blocked if scanner reports high impact news active
  const newsActive = ind?.news_high_impact === true || ind?.high_impact_news === true;
  const newsBlocked = (s.gmr_use_news_filter !== false) && newsActive;

  // breakout status (price-based proxy; final confirmation requires closed M5 candle)
  let breakout = "Waiting";
  if (rangeOk && price != null) {
    if (price > mrHigh) breakout = "Buy pending close";
    else if (price < mrLow) breakout = "Sell pending close";
  }

  // retest proxy: price returned near the broken level
  let retest = "None";
  if (rangeOk && price != null && (breakout === "Buy pending close" || breakout === "Sell pending close")) {
    const buf = s.gmr_retest_buffer_points ?? 10;
    if (breakout === "Buy pending close") retest = Math.abs(price - mrHigh) <= buf ? "At level" : "Away";
    else retest = Math.abs(price - mrLow) <= buf ? "At level" : "Away";
  }

  // blocked reason
  let blocked = null;
  let modeStatus = "Waiting";
  if (!connected) { modeStatus = "Blocked"; blocked = "MT5 not connected"; }
  else if (isWeekend || fridayLate) { modeStatus = "Blocked"; blocked = "Market closed / weekend"; }
  else if (phase === "pre") { modeStatus = "Waiting"; blocked = "Before 08:00 ET — range not started"; }
  else if (phase === "building") { modeStatus = "Waiting"; blocked = null; }
  else if (phase === "cutoff") { modeStatus = "Blocked"; blocked = "11:00 AM hard cutoff reached"; }
  else if (equityStopHit) { modeStatus = "Blocked"; blocked = "Equity protection activated"; }
  else if (dailyLossHit) { modeStatus = "Blocked"; blocked = "Daily loss limit reached"; }
  else if (targetReached) { modeStatus = "Blocked"; blocked = "Daily profit target reached"; }
  else if (cooldownActive) { modeStatus = "Blocked"; blocked = "Cooldown active after consecutive losses"; }
  else if (newsBlocked) { modeStatus = "Blocked"; blocked = "High-impact news conditions"; }
  else if (!spreadOk) { modeStatus = "Blocked"; blocked = "Spread too high"; }
  else if (!rangeOk) { modeStatus = "Waiting"; blocked = "Range not yet built"; }
  else if (!rangeSizeOk) { modeStatus = "Waiting"; blocked = `Range size invalid (${rangeSize != null ? rangeSize.toFixed(1) : "--"} pts)`; }
  else if (!atrOk) { modeStatus = "Waiting"; blocked = "ATR volatility filter not met"; }
  else if (capHit) { modeStatus = "Blocked"; blocked = "Daily trade cap reached"; }
  else { modeStatus = "Active"; }

  // live message
  let msg = "Awaiting market data";
  if (connected) {
    if (phase === "building") msg = "Building Gold Morning Range (08:00–09:30 ET).";
    else if (phase === "pre") msg = "Range starts at 08:00 AM ET.";
    else if (blocked && modeStatus === "Blocked") msg = `Blocked: ${blocked.toLowerCase()}.`;
    else if (breakout === "Buy pending close" && volUnknown) msg = "BUY breakout forming — awaiting tick volume confirmation.";
    else if (breakout === "Sell pending close" && volUnknown) msg = "SELL breakout forming — awaiting tick volume confirmation.";
    else if (breakout === "Buy pending close" && !volOk) msg = "BUY breakout forming — tick volume below threshold.";
    else if (breakout === "Sell pending close" && !volOk) msg = "SELL breakout forming — tick volume below threshold.";
    else if (breakout === "Buy pending close") msg = "BUY breakout + volume confirmed — awaiting M5 close / retest.";
    else if (breakout === "Sell pending close") msg = "SELL breakout + volume confirmed — awaiting M5 close / retest.";
    else msg = "Waiting for a confirmed M5 breakout above/below the morning range.";
  }

  // planned trade (illustrative based on current range + price proxy)
  let planned = null;
  const rr = s.gmr_risk_reward ?? 2;
  const slBuf = s.gmr_sl_buffer_points ?? 5;
  if (rangeOk && price != null && (breakout === "Buy pending close" || breakout === "Sell pending close")) {
    const isBuy = breakout === "Buy pending close";
    const retestRef = isBuy ? mrHigh : mrLow;
    const sl = isBuy ? Math.min(retestRef, price) - slBuf : Math.max(retestRef, price) + slBuf;
    const risk = Math.abs(price - sl);
    const tp = isBuy ? price + risk * rr : price - risk * rr;
    planned = { dir: isBuy ? "BUY" : "SELL", entry: price, sl, tp, risk, rr };
  }

  const fmt = (v, d = 2) => (v == null ? "--" : Number(v).toFixed(d));
  const etTimeStr = `${String(now.hh).padStart(2, "0")}:${String(now.mm).padStart(2, "0")}:${String(now.seconds).padStart(2, "0")}`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-black text-white tracking-wide leading-tight">{STRATEGY_NAME}</h3>
              <p className="text-[10px] text-white/40">{pair} · M5 · Morning Range 08:00–09:30 ET</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00ff9d] animate-pulse" : "bg-[#ff4d4d]"}`} />
            <span className="text-[9px] font-heading tracking-widest text-white/50">{connected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>

        {/* Mode status banner */}
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
          style={{ background: modeStatus === "Blocked" ? "rgba(255,77,77,0.08)" : modeStatus === "Active" ? "rgba(0,255,157,0.08)" : "rgba(251,191,36,0.07)", border: `1px solid ${modeStatus === "Blocked" ? "rgba(255,77,77,0.25)" : modeStatus === "Active" ? "rgba(0,255,157,0.25)" : "rgba(251,191,36,0.25)"}` }}>
          {loading ? <Loader2 className="w-4 h-4 text-amber-300 animate-spin" /> : modeStatus === "Blocked" ? <ShieldAlert className="w-4 h-4 text-[#ff4d4d]" /> : modeStatus === "Active" ? <CheckCircle2 className="w-4 h-4 text-[#00ff9d]" /> : <Activity className="w-4 h-4 text-amber-300" />}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-heading tracking-widest" style={{ color: modeStatus === "Blocked" ? "#ff9d9d" : modeStatus === "Active" ? "#9dffd4" : "#fcd34d" }}>MORNING RANGE: {modeStatus.toUpperCase()}</p>
            <p className="text-[10px] text-white/60 truncate">{msg}</p>
          </div>
        </div>

        {/* Time + phase */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Chip label="Current ET Time" value={etTimeStr} tone="cool" />
          <Chip label="Phase" value={phaseLabel} tone={phase === "entry" ? "up" : phase === "closed" || phase === "cutoff" ? "down" : "cool"} />
        </div>

        {/* Countdowns */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-2">
          <Chip label="Countdown to 09:30" value={cdToOpen != null ? fmtClock(cdToOpen) : "--"} tone={phase === "pre" || phase === "building" ? "warn" : "neutral"} />
          <Chip label="Countdown to 11:00" value={cdToCutoff != null ? fmtClock(cdToCutoff) : phase === "cutoff" ? "00:00:00" : "--"} tone={phase === "entry" ? "warn" : "neutral"} />
        </div>

        {/* Morning range levels + price */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          <Chip label="Range High" value={fmt(mrHigh, 2)} tone="up" />
          <Chip label="Range Mid" value={fmt(mrMid, 2)} tone="neutral" />
          <Chip label="Range Low" value={fmt(mrLow, 2)} tone="down" />
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          <Chip label="Current Price" value={fmt(price, 2)} tone="cool" />
          <Chip label="Range Size (pts)" value={rangeSize != null ? rangeSize.toFixed(2) : "--"} tone={rangeSizeOk ? "up" : "warn"} />
          <Chip label="Spread (pts)" value={spread == null ? "--" : spread} tone={!spreadOk ? "down" : "neutral"} />
        </div>

        {/* Status rows */}
        <div className="px-4 pt-3 space-y-1.5">
          <StatusRow icon={Box} label="Range Building" value={phase === "building" ? "In progress" : phase === "entry" || phase === "cutoff" ? "Complete" : "Pending"} tone={phase === "building" ? "warn" : phase === "entry" ? "up" : "neutral"} />
          <StatusRow icon={Clock} label="Entry Window" value={phase === "entry" ? "Open" : "Closed"} tone={phase === "entry" ? "up" : "down"} />
          <StatusRow icon={breakout.startsWith("Buy") ? TrendingUp : breakout.startsWith("Sell") ? TrendingDown : Minus} label="M5 Breakout" value={breakout} tone={breakout.startsWith("Buy") ? "up" : breakout.startsWith("Sell") ? "down" : "neutral"} />
          <StatusRow icon={BarChart3} label="Tick Volume" value={volUnknown ? "No data" : volOk ? "Confirmed" : "Below avg"} tone={volOk ? "up" : "warn"} />
          <StatusRow icon={Gauge} label="ATR 14" value={fmt(atr, 3)} tone={atrOk ? "up" : "warn"} />
          <StatusRow icon={Activity} label="Retest Status" value={retest} tone={retest === "At level" ? "up" : "neutral"} />
          <StatusRow icon={Newspaper} label="News Filter" value={newsBlocked ? "High impact" : "Clear"} tone={newsBlocked ? "down" : "up"} />
          <StatusRow icon={Layers} label="Trades Today" value={`${tradesTakenToday} / ${maxTrades}`} tone={capHit ? "down" : "neutral"} />
        </div>

        {/* Planned trade */}
        {planned && (
          <div className="mx-4 mt-3 rounded-xl px-3 py-3 space-y-1.5" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-heading tracking-wider text-amber-300">PLANNED TRADE</p>
              <span className={`text-[10px] font-heading font-bold ${planned.dir === "BUY" ? "text-[#00ff9d]" : "text-[#ff4d4d]"}`}>{planned.dir}</span>
            </div>
            <StatusRow icon={Crosshair} label="Entry" value={fmt(planned.entry, 2)} tone="cool" />
            <StatusRow icon={Lock} label="Stop Loss" value={fmt(planned.sl, 2)} tone="down" />
            <StatusRow icon={Target} label="Take Profit" value={fmt(planned.tp, 2)} tone="up" />
            <StatusRow icon={Activity} label="Risk Distance" value={fmt(planned.risk, 2)} tone="warn" />
            <StatusRow icon={Gauge} label="Risk : Reward" value={`1 : ${planned.rr}`} tone="up" />
          </div>
        )}

        {/* Protection grid */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Chip label="Daily Realized" value={`${realizedToday >= 0 ? "+" : ""}$${fmt(Math.abs(realizedToday), 2)}`} tone={realizedToday >= 0 ? "up" : "down"} />
          <Chip label="Consecutive Losses" value={`${consecLosses} / ${maxConsec}`} tone={consecLosses >= maxConsec ? "down" : "neutral"} />
          <Chip label="Equity Stop" value={equityStopLevel != null ? `$${fmt(equityStopLevel, 2)}` : "--"} tone={equityStopHit ? "down" : "neutral"} />
          <Chip label="Daily Target" value={`$${fmt(realizedToday, 2)} / $${fmt(dailyTarget, 0)}`} tone={targetReached ? "up" : "neutral"} />
        </div>

        {/* Footer */}
        {blocked && modeStatus === "Blocked" ? (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,77,77,0.06)", border: "1px solid rgba(255,77,77,0.2)" }}>
            <XCircle className="w-3.5 h-3.5 text-[#ff6b6b] shrink-0" />
            <p className="text-[10px] text-[#ff9d9d]">{blocked}</p>
          </div>
        ) : modeStatus === "Active" ? (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,255,157,0.06)", border: "1px solid rgba(0,255,157,0.2)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff9d] shrink-0" />
            <p className="text-[10px] text-[#9dffd4]">Entry window open — watching for confirmed M5 breakout with volume.</p>
          </div>
        ) : (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.18)" }}>
            <Activity className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <p className="text-[10px] text-white/60">{blocked ? `${blocked}.` : "Building range / waiting for breakout confirmation."}</p>
          </div>
        )}

        {/* Config summary */}
        <div className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          {[
            ["Symbol", pair],
            ["Timeframe", "M5"],
            ["Lot Size", s.gmr_lot_size ?? "0.01"],
            ["Max Trades/Day", s.gmr_max_trades_per_day ?? 2],
            ["Risk Reward", `1:${s.gmr_risk_reward ?? 2}`],
            ["SL Buffer (pts)", s.gmr_sl_buffer_points ?? 5],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-white/5 py-1">
              <span className="text-white/40 uppercase tracking-wider">{k}</span>
              <span className="text-white/80 font-heading font-bold">{v}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}