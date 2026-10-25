import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import GlassCard from "@/components/GlassCard";
import { pollInterval } from "@/lib/visibleInterval";
import {
  Activity, ShieldAlert, Target,
  Gauge, Lock, CheckCircle2, XCircle, Loader2, Clock,
  TrendingDown, TrendingUp, BarChart3,
} from "lucide-react";

const STRATEGY_NAME = "Gold Mean Reversion";
const PAIR = "XAUUSD";

function nowUTC() {
  const d = new Date();
  return {
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
    ss: d.getUTCSeconds(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

function Chip({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: "text-white/70 bg-white/5 border-white/10",
    up: "text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/25",
    down: "text-[#ff4d4d] bg-[#ff4d4d]/10 border-[#ff4d4d]/25",
    warn: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    cool: "text-amber-300 bg-amber-500/10 border-amber-500/25",
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

export default function GoldMeanReversionLiveCard() {
  const [connected, setConnected] = useState(false);
  const [quote, setQuote] = useState(null);
  const [account, setAccount] = useState(null);
  const [ind, setInd] = useState(null);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => nowUTC());

  const load = async () => {
    try {
      const [acct, scan, quotes, pos, tr, stg] = await Promise.all([
        mt5Api.account().catch(() => null),
        mt5Api.scannerStatus().catch(() => null),
        mt5Api.quotes().catch(() => null),
        mt5Api.positions().catch(() => null),
        base44.entities.Trade.list("-closed_at", 30).catch(() => []),
        base44.entities.BotSettings.list("-created_date", 1).catch(() => []),
      ]);
      const a = acct?.ok && acct.data?.account;
      setConnected(a?.connected === true);
      setAccount(a);
      setInd(scan?.ok ? scan.data?.scanner?.indicators || scan.data?.indicators || null : null);
      const syms = quotes?.ok ? (quotes.data?.symbols || []) : [];
      const sym = (Array.isArray(syms) ? syms : []).find((s) => (s.symbol || "").toUpperCase() === PAIR) || (Array.isArray(syms) ? syms[0] : null);
      setQuote(sym && sym.bid != null ? { bid: Number(sym.bid), ask: Number(sym.ask), spread: sym.spread != null ? Number(sym.spread) : Number(sym.ask) - Number(sym.bid) } : null);
      const p = pos?.ok ? (pos.data?.positions || []) : [];
      setPositions(Array.isArray(p) ? p : []);
      setTrades(Array.isArray(tr) ? tr : []);
      setSettings(stg?.[0] || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = pollInterval(load, 4000);
    const tick = setInterval(() => setNow(nowUTC()), 1000);
    return () => { clearInterval(id); clearInterval(tick); };
  }, []);

  const s = settings || {};
  const price = quote?.bid ?? null;
  const spread = quote?.spread ?? null;
  const atr = ind?.atr_14 ?? ind?.atr14 ?? null;
  const rsi2 = ind?.rsi_2 ?? ind?.rsi2 ?? null;
  const bbLower = ind?.bb_lower ?? ind?.bbLower ?? null;
  const bbUpper = ind?.bb_upper ?? ind?.bbUpper ?? null;
  const ema200H4 = ind?.ema200_h4 ?? ind?.ema200H4 ?? null;
  const h4Close = ind?.h4_close ?? ind?.h4Close ?? null;

  // Session check (UTC)
  const sessionStart = s.gmrv_session_start_hour ?? 7;
  const sessionEnd = s.gmrv_session_end_hour ?? 20;
  const inSession = now.minutes >= sessionStart * 60 && now.minutes < sessionEnd * 60;

  // Trend filter
  const trendUp = h4Close != null && ema200H4 != null ? h4Close > ema200H4 : null;
  const trendFilterOn = s.gmrv_trend_filter !== false;

  // Entry signal evaluation
  const rsiThresh = s.gmrv_rsi_threshold ?? 10;
  const entryMode = s.gmrv_entry_mode ?? "both";
  const buyRsiSignal = rsi2 != null ? rsi2 < rsiThresh : false;
  const buyBbSignal = bbLower != null && price != null ? price <= bbLower : false;
  const sellRsiSignal = rsi2 != null ? rsi2 > 100 - rsiThresh : false;
  const sellBbSignal = bbUpper != null && price != null ? price >= bbUpper : false;

  const buySignal = entryMode === "both" ? (buyRsiSignal && buyBbSignal) : entryMode === "rsi" ? buyRsiSignal : buyBbSignal;
  const sellSignal = entryMode === "both" ? (sellRsiSignal && sellBbSignal) : entryMode === "rsi" ? sellRsiSignal : sellBbSignal;

  // Apply trend filter
  const buyAllowed = buySignal && (!trendFilterOn || trendUp === true);
  const sellAllowed = sellSignal && (!trendFilterOn || trendUp === false);

  // Open positions on XAUUSD
  const xauOpen = positions.filter((p) => (p.symbol || "").toUpperCase() === PAIR);
  const xauOpenCount = xauOpen.length;

  // Trades today
  const todayKey = new Date().toDateString();
  const tradesToday = trades.filter((t) => (t.pair || "").toUpperCase() === PAIR && t.opened_at && new Date(t.opened_at).toDateString() === todayKey);
  const tradesTakenToday = tradesToday.length;
  const maxTrades = s.gmrv_max_trades_per_day ?? 3;

  // Risk
  const realizedToday = trades.filter((t) => t.closed_at && new Date(t.closed_at).toDateString() === todayKey).reduce((sum, t) => sum + (t.profit ?? 0), 0);
  const balance = account?.balance ?? s.balance ?? 0;
  const dailyLossPct = balance > 0 ? Math.min(0, realizedToday) / balance * 100 : 0;
  const dailyLossHit = dailyLossPct <= -(s.gmrv_max_daily_loss_pct ?? 2);
  const equityStopLevel = balance > 0 ? balance * (1 - (s.gmrv_equity_stop_pct ?? 3) / 100) : null;
  const equityStopHit = balance > 0 && (account?.equity ?? balance) <= equityStopLevel;
  const dailyTarget = s.daily_profit_target_amount ?? s.daily_profit_target ?? 100;
  const targetReached = realizedToday >= dailyTarget && (s.stop_trading_at_daily_target !== false);

  let consecLosses = 0;
  for (const t of trades) { if ((t.profit ?? 0) < 0) consecLosses++; else break; }
  const maxConsec = s.gmrv_max_consecutive_losses ?? 2;
  const cooldownH = s.gmrv_cooldown_hours ?? 8;
  const lastLoss = trades.find((t) => (t.profit ?? 0) < 0);
  const lastLossAt = lastLoss?.closed_at ? new Date(lastLoss.closed_at).getTime() : null;
  const cooldownEnd = consecLosses >= maxConsec && lastLossAt ? lastLossAt + cooldownH * 3600 * 1000 : null;
  const cooldownActive = cooldownEnd != null && Date.now() < cooldownEnd;

  const spreadOk = spread == null || spread <= (s.gmrv_max_spread_points ?? 30);
  const capHit = tradesTakenToday >= maxTrades;

  // Planned trade
  let planned = null;
  const tpMult = s.gmrv_tp_atr_mult ?? 0.7;
  const slMult = s.gmrv_sl_atr_mult ?? 2.0;
  const cost = s.gmrv_round_trip_cost ?? 0.4;
  if (price != null && atr != null && atr > 0) {
    if (buyAllowed) {
      const entry = price;
      const sl = entry - slMult * atr;
      const tp = entry + tpMult * atr;
      const risk = slMult * atr;
      planned = { dir: "BUY", entry, sl, tp, risk, rr: tpMult / slMult, cost };
    } else if (sellAllowed) {
      const entry = price;
      const sl = entry + slMult * atr;
      const tp = entry - tpMult * atr;
      const risk = slMult * atr;
      planned = { dir: "SELL", entry, sl, tp, risk, rr: tpMult / slMult, cost };
    }
  }

  // Blocked reason
  let blocked = null;
  let modeStatus = "Waiting";
  if (!connected) { modeStatus = "Blocked"; blocked = "MT5 not connected"; }
  else if (!inSession) { modeStatus = "Blocked"; blocked = `Outside session (${sessionStart}:00–${sessionEnd}:00 UTC)`; }
  else if (equityStopHit) { modeStatus = "Blocked"; blocked = "Equity protection activated"; }
  else if (dailyLossHit) { modeStatus = "Blocked"; blocked = "Daily loss limit reached"; }
  else if (targetReached) { modeStatus = "Blocked"; blocked = "Daily profit target reached"; }
  else if (cooldownActive) { modeStatus = "Blocked"; blocked = "Cooldown active after consecutive losses"; }
  else if (!spreadOk) { modeStatus = "Blocked"; blocked = "Spread too high"; }
  else if (xauOpenCount > 0) { modeStatus = "Active"; blocked = null; }
  else if (capHit) { modeStatus = "Blocked"; blocked = "Daily trade cap reached"; }
  else { modeStatus = "Active"; }

  let msg = "Awaiting market data";
  if (connected) {
    if (blocked && modeStatus === "Blocked") msg = `Blocked: ${blocked.toLowerCase()}.`;
    else if (planned) msg = `${planned.dir} signal — RSI(2) ${rsi2 != null ? rsi2.toFixed(1) : "--"}${buyAllowed ? " < " + rsiThresh : sellAllowed ? " > " + (100 - rsiThresh) : ""}, BB touch confirmed.`;
    else if (trendFilterOn && trendUp === false) msg = "H4 trend is DOWN — only SELL signals active. Waiting for overbought.";
    else if (trendFilterOn && trendUp === true) msg = "H4 trend is UP — only BUY signals active. Waiting for oversold.";
    else msg = "Scanning for RSI(2) + Bollinger Band mean-reversion entry.";
  }

  const fmt = (v, d = 2) => (v == null ? "--" : Number(v).toFixed(d));
  const utcTimeStr = `${String(now.hh).padStart(2, "0")}:${String(now.mm).padStart(2, "0")}:${String(now.ss).padStart(2, "0")}`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-black text-white tracking-wide leading-tight">{STRATEGY_NAME}</h3>
              <p className="text-[10px] text-white/40">{PAIR} · H1 · RSI(2) + BB mean-reversion</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00ff9d] animate-pulse" : "bg-[#ff4d4d]"}`} />
            <span className="text-[9px] font-heading tracking-widest text-white/50">{connected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>

        {/* Active banner */}
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
          style={{ background: modeStatus === "Active" ? "rgba(255,206,77,0.1)" : modeStatus === "Blocked" ? "rgba(255,77,77,0.08)" : "rgba(251,191,36,0.07)", border: `1px solid ${modeStatus === "Active" ? "rgba(255,206,77,0.35)" : modeStatus === "Blocked" ? "rgba(255,77,77,0.25)" : "rgba(251,191,36,0.25)"}` }}>
          {loading ? <Loader2 className="w-4 h-4 text-amber-300 animate-spin" /> : modeStatus === "Blocked" ? <ShieldAlert className="w-4 h-4 text-[#ff4d4d]" /> : modeStatus === "Active" ? <CheckCircle2 className="w-4 h-4 text-amber-300" /> : <Activity className="w-4 h-4 text-amber-300" />}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-heading tracking-widest" style={{ color: modeStatus === "Active" ? "#ffce4d" : modeStatus === "Blocked" ? "#ff9d9d" : "#fcd34d" }}>
              {modeStatus === "Active" ? "GOLD MEAN REVERSION ACTIVE" : `GOLD MEAN REVERSION: ${modeStatus.toUpperCase()}`}
            </p>
            <p className="text-[10px] text-white/60 truncate">{msg}</p>
          </div>
        </div>

        {/* Time + session */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Chip label="Current UTC Time" value={utcTimeStr} tone="cool" />
          <Chip label="Session" value={inSession ? "Active" : "Closed"} tone={inSession ? "up" : "down"} />
        </div>

        {/* Indicators */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          <Chip label="RSI(2)" value={fmt(rsi2, 1)} tone={rsi2 != null && rsi2 < rsiThresh ? "up" : rsi2 != null && rsi2 > 100 - rsiThresh ? "down" : "neutral"} />
          <Chip label="ATR(14)" value={fmt(atr, 3)} tone="cool" />
          <Chip label="Price" value={fmt(price, 2)} tone="cool" />
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          <Chip label="BB Lower" value={fmt(bbLower, 2)} tone="up" />
          <Chip label="BB Upper" value={fmt(bbUpper, 2)} tone="down" />
          <Chip label="EMA200 H4" value={fmt(ema200H4, 2)} tone={trendUp === true ? "up" : trendUp === false ? "down" : "neutral"} />
        </div>

        {/* Status rows */}
        <div className="px-4 pt-3 space-y-1.5">
          <StatusRow icon={trendUp === true ? TrendingUp : trendUp === false ? TrendingDown : Activity} label="H4 Trend" value={trendUp === true ? "Bullish" : trendUp === false ? "Bearish" : "--"} tone={trendUp === true ? "up" : trendUp === false ? "down" : "neutral"} />
          <StatusRow icon={Activity} label="BUY Signal" value={buySignal ? "Active" : "No"} tone={buySignal ? "up" : "neutral"} />
          <StatusRow icon={Activity} label="SELL Signal" value={sellSignal ? "Active" : "No"} tone={sellSignal ? "down" : "neutral"} />
          <StatusRow icon={Activity} label="Spread (pts)" value={spread == null ? "--" : spread} tone={!spreadOk ? "down" : "neutral"} />
          <StatusRow icon={Clock} label="XAUUSD Open Positions" value={xauOpenCount} tone={xauOpenCount > 0 ? "warn" : "up"} />
          <StatusRow icon={Gauge} label="Trades Today" value={`${tradesTakenToday} / ${maxTrades}`} tone={capHit ? "down" : "neutral"} />
        </div>

        {/* Planned trade */}
        {planned && (
          <div className="mx-4 mt-3 rounded-xl px-3 py-3 space-y-1.5" style={{ background: planned.dir === "BUY" ? "rgba(0,255,157,0.06)" : "rgba(255,77,77,0.06)", border: `1px solid ${planned.dir === "BUY" ? "rgba(0,255,157,0.2)" : "rgba(255,77,77,0.2)"}` }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-heading tracking-wider text-amber-300">PLANNED {planned.dir}</p>
              <span className={`text-[10px] font-heading font-bold ${planned.dir === "BUY" ? "text-[#00ff9d]" : "text-[#ff4d4d]"}`}>{planned.dir}</span>
            </div>
            <StatusRow icon={Activity} label="Entry" value={fmt(planned.entry, 2)} tone="cool" />
            <StatusRow icon={Lock} label="Stop Loss" value={fmt(planned.sl, 2)} tone="down" />
            <StatusRow icon={Target} label="Take Profit" value={fmt(planned.tp, 2)} tone="up" />
            <StatusRow icon={Gauge} label="Risk Distance" value={fmt(planned.risk, 2)} tone="warn" />
            <StatusRow icon={Gauge} label="Risk : Reward" value={`1 : ${planned.rr.toFixed(2)}`} tone="warn" />
            <StatusRow icon={Activity} label="Round-Trip Cost" value={`$${fmt(planned.cost, 2)}`} tone="neutral" />
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
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,206,77,0.08)", border: "1px solid rgba(255,206,77,0.25)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <p className="text-[10px] text-[#fde68a]">Gold Mean Reversion active — scanning for RSI(2) + BB entry signals.</p>
          </div>
        ) : (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.18)" }}>
            <Activity className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <p className="text-[10px] text-white/60">{blocked ? `${blocked}.` : "Waiting for session and indicator data."}</p>
          </div>
        )}

        {/* Config summary */}
        <div className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          {[
            ["Symbol", PAIR],
            ["Lot Size", s.gmrv_lot_size ?? "0.01"],
            ["Max Trades/Day", s.gmrv_max_trades_per_day ?? 3],
            ["RSI Period", s.gmrv_rsi_period ?? 2],
            ["RSI Threshold", s.gmrv_rsi_threshold ?? 10],
            ["Entry Mode", s.gmrv_entry_mode ?? "both"],
            ["TP (×ATR)", s.gmrv_tp_atr_mult ?? 0.7],
            ["SL (×ATR)", s.gmrv_sl_atr_mult ?? 2.0],
            ["Time Stop (bars)", s.gmrv_max_bars ?? 10],
            ["Break-Even", s.gmrv_use_break_even ? "1R" : "Off"],
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