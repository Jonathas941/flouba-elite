import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import GlassCard from "@/components/GlassCard";
import {
  Activity, TrendingUp, TrendingDown, Minus, ShieldAlert, Target,
  Layers, Gauge, Lock, Waves, CheckCircle2, XCircle, Loader2, ScanLine,
} from "lucide-react";

const STRATEGY_NAME = "Hybrid Confluence Mode";

function nowET() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false,
    weekday: "short", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday").value;
  const hh = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const mm = parseInt(parts.find((p) => p.type === "minute").value, 10);
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: dayMap[wd] ?? 0, minutes: hh * 60 + mm };
}

function sessionState() {
  const { day, minutes } = nowET();
  if (day === 5 && minutes >= 16 * 60 + 55) return { open: false, reason: "Friday close — weekend block" };
  if (day === 6) return { open: false, reason: "Weekend — market closed" };
  if (day === 0 && minutes < 17 * 60 + 10) return { open: false, reason: "Weekend — market closed" };
  if (minutes >= 16 * 60 + 55 && minutes <= 17 * 60 + 15) return { open: false, reason: "Rollover / spread spike window" };
  const inAsian = minutes >= 19 * 60 + 15 || minutes <= 3 * 60 + 45;
  const inOverlap = minutes >= 8 * 60 && minutes <= 12 * 60;
  if (inAsian) return { open: true, name: "Asian Session" };
  if (inOverlap) return { open: true, name: "London / NY Overlap" };
  return { open: false, reason: "Outside enabled trading session" };
}

function Chip({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: "text-white/70 bg-white/5 border-white/10",
    up: "text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/25",
    down: "text-[#ff4d4d] bg-[#ff4d4d]/10 border-[#ff4d4d]/25",
    warn: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    cool: "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-[8px] uppercase tracking-[0.2em] opacity-70 font-heading">{label}</p>
      <p className="font-heading font-bold text-[12px] mt-0.5 truncate">{value}</p>
    </div>
  );
}

function StatusRow({ icon: Icon, label, value, tone }) {
  const toneClass = tone === "up" ? "text-[#00ff9d]" : tone === "down" ? "text-[#ff4d4d]" : tone === "warn" ? "text-amber-400" : tone === "cool" ? "text-cyan-300" : "text-white/70";
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

function ScoreBar({ label, value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tone = pct >= 80 ? "#00ff9d" : pct >= 50 ? "#ffce4d" : "#ff6b6b";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-white/55 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-heading font-bold" style={{ color: tone }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: tone }} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
      </div>
    </div>
  );
}

export default function HybridConfluenceLiveCard() {
  const [connected, setConnected] = useState(false);
  const [ind, setInd] = useState(null);
  const [quote, setQuote] = useState(null);
  const [positions, setPositions] = useState([]);
  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

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
      const pair = (stg?.[0]?.active_pair || "XAUUSD").toUpperCase();
      const sym = (Array.isArray(syms) ? syms : []).find((s) => (s.symbol || "").toUpperCase() === pair) || (Array.isArray(syms) ? syms : []).find((s) => (s.symbol || "").toUpperCase() === "XAUUSD") || (Array.isArray(syms) ? syms[0] : null);
      setQuote(sym && sym.bid != null ? { bid: Number(sym.bid), ask: Number(sym.ask), spread: sym.spread != null ? Number(sym.spread) : Number(sym.ask) - Number(sym.bid) } : null);
      setPositions(pos?.ok ? pos.data?.positions || [] : []);
      setTrades(Array.isArray(tr) ? tr : []);
      setSettings(stg?.[0] || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  const s = settings || {};
  const pair = (s.active_pair || "XAUUSD").toUpperCase();
  const ema6 = ind?.ema_6 ?? ind?.ema6 ?? null;
  const ema20 = ind?.ema_20 ?? ind?.ema20 ?? null;
  const ema25 = ind?.ema_25 ?? ind?.ema25 ?? null;
  const ema50 = ind?.ema_50 ?? ind?.ema50 ?? null;
  const atr = ind?.atr_14 ?? ind?.atr14 ?? null;
  const slope = ind?.ema_slope ?? ind?.slope ?? null;
  const price = quote?.bid ?? null;
  const spread = quote?.spread ?? null;
  const sweep = ind?.sweep ?? ind?.liquidity_sweep ?? null;
  const engulf = ind?.engulfing ?? ind?.signal ?? null;

  const minDist = s.hybrid_min_ema_distance ?? 0;
  const minAtr = s.hybrid_min_atr ?? 0;
  const wTrend = s.hybrid_score_trend ?? 30;
  const wPull = s.hybrid_score_pullback ?? 20;
  const wSweep = s.hybrid_score_sweep ?? 30;
  const wEng = s.hybrid_score_engulfing ?? 10;
  const wFil = s.hybrid_score_filters ?? 10;
  const minScore = s.hybrid_min_score ?? 80;

  // --- TREND LAYER ---
  const allEma = ema6 != null && ema20 != null && ema25 != null && ema50 != null;
  let trendOk = false;
  let trendDir = "Neutral";
  if (allEma) {
    const bullish = ema6 > ema25 && ema20 > ema50;
    const bearish = ema6 < ema25 && ema20 < ema50;
    const distOk = Math.abs(ema6 - ema25) >= minDist && Math.abs(ema20 - ema50) >= minDist;
    const atrOk = atr != null && atr >= minAtr;
    const slopeUp = slope == null || slope > 0;
    const slopeDn = slope == null || slope < 0;
    if (bullish && distOk && atrOk && slopeUp) { trendOk = true; trendDir = "Bullish"; }
    else if (bearish && distOk && atrOk && slopeDn) { trendOk = true; trendDir = "Bearish"; }
    else if (bullish) trendDir = "Weak Bullish";
    else if (bearish) trendDir = "Weak Bearish";
  }
  const trendScore = trendOk ? wTrend : 0;

  // --- PULLBACK LAYER ---
  let pullbackOk = false;
  let pullbackLabel = "Waiting";
  if (price != null && ema20 != null && atr != null && ema50 != null) {
    const zone = (s.hybrid_pullback_zone_atr ?? 0.25) * atr;
    const distToEma20 = Math.abs(price - ema20);
    const depth = (s.hybrid_max_pullback_depth_atr ?? 0.5) * atr;
    const notDeep = trendDir === "Bullish" ? price > ema50 - depth : trendDir === "Bearish" ? price < ema50 + depth : true;
    if (distToEma20 <= zone && notDeep) { pullbackOk = true; pullbackLabel = "In Zone"; }
    else if (!notDeep) pullbackLabel = "Too Deep";
    else pullbackLabel = "Waiting";
  } else if (!connected) pullbackLabel = "--";
  const pullbackScore = pullbackOk ? wPull : 0;

  // --- SMC LIQUIDITY SWEEP LAYER ---
  let sweepOk = false;
  let sweepLabel = "Waiting";
  if (sweep === "bullish" || sweep === "bearish") {
    sweepOk = true;
    sweepLabel = sweep === "bullish" ? "Bullish Sweep" : "Bearish Sweep";
  } else if (!connected) sweepLabel = "--";
  const sweepScore = sweepOk ? wSweep : 0;

  // --- ENGULFING CONFIRMATION ---
  let engulfOk = false;
  let engulfLabel = "Waiting";
  if (engulf === "bullish" || engulf === "bearish") {
    engulfOk = true;
    engulfLabel = engulf === "bullish" ? "Bullish" : "Bearish";
  } else if (!connected) engulfLabel = "--";
  const requireEng = s.hybrid_require_engulfing !== false;
  const engulfScore = engulfOk ? wEng : 0;

  // --- FILTERS ---
  const sess = sessionState();
  const balance = account?.balance ?? s.balance ?? 0;
  const equity = account?.equity ?? balance;

  // consecutive losses + cooldown
  let consecLosses = 0;
  for (const t of trades) {
    if ((t.profit ?? 0) < 0) consecLosses++;
    else break;
  }
  const maxConsec = s.hybrid_max_consecutive_losses ?? 2;
  const cooldownH = s.hybrid_cooldown_hours ?? 8;
  const lastLoss = trades.find((t) => (t.profit ?? 0) < 0);
  const lastLossAt = lastLoss?.closed_at ? new Date(lastLoss.closed_at).getTime() : null;
  const cooldownEnd = consecLosses >= maxConsec && lastLossAt ? lastLossAt + cooldownH * 3600 * 1000 : null;
  const cooldownActive = cooldownEnd != null && Date.now() < cooldownEnd;

  // daily realized
  const todayKey = new Date().toDateString();
  const realizedToday = trades
    .filter((t) => t.closed_at && new Date(t.closed_at).toDateString() === todayKey)
    .reduce((sum, t) => sum + (t.profit ?? 0), 0);
  const dailyTarget = s.daily_profit_target_amount ?? s.daily_profit_target ?? 100;
  const targetPct = dailyTarget > 0 ? Math.min(100, Math.max(0, (realizedToday / dailyTarget) * 100)) : 0;
  const targetReached = realizedToday >= dailyTarget && (s.stop_trading_at_daily_target !== false);

  const dailyLossPct = balance > 0 ? Math.min(0, realizedToday) / balance * 100 : 0;
  const dailyLossHit = dailyLossPct <= -(s.hybrid_max_daily_loss_pct ?? 2);
  const equityStopLevel = balance > 0 ? balance * (1 - (s.hybrid_equity_stop_pct ?? 3) / 100) : null;
  const equityStopHit = balance > 0 && equity <= equityStopLevel;

  // spread
  const spreadOk = spread == null || spread <= (s.hybrid_max_spread_points ?? 30);

  // open positions for XAUUSD
  const basket = positions.filter((p) => (p.symbol || "").toUpperCase() === pair);
  const openCount = basket.length;
  const recoveryCount = Math.max(0, openCount - 1);
  const maxPos = s.hybrid_max_positions ?? 2;
  const maxRec = s.hybrid_max_recovery_positions ?? 1;

  let basketPnL = 0;
  for (const p of basket) basketPnL += p.profit ?? p.unrealized_pnl ?? 0;

  const filtersOk = sess.open && spreadOk && !cooldownActive && !dailyLossHit && !targetReached && !equityStopHit;
  const filterScore = filtersOk ? wFil : 0;

  // total
  const totalScore = trendScore + pullbackScore + sweepScore + engulfScore + filterScore;

  // direction consistency
  const dirMatch = (trendDir === "Bullish" && sweep === "bullish" && (!engulf || engulf === "bullish")) ||
                   (trendDir === "Bearish" && sweep === "bearish" && (!engulf || engulf === "bearish"));

  const allLayers = trendOk && pullbackOk && sweepOk && (!requireEng || engulfOk) && filtersOk && dirMatch;
  const scorePass = totalScore >= minScore;

  // mode status
  let modeStatus = "Waiting";
  let blocked = null;
  if (!connected) { modeStatus = "Blocked"; blocked = "MT5 not connected"; }
  else if (equityStopHit) { modeStatus = "Blocked"; blocked = "Equity protection activated"; }
  else if (dailyLossHit) { modeStatus = "Blocked"; blocked = "Daily loss limit reached"; }
  else if (targetReached) { modeStatus = "Blocked"; blocked = "Daily profit target reached"; }
  else if (cooldownActive) { modeStatus = "Blocked"; blocked = "Cooldown active after consecutive losses"; }
  else if (!sess.open) { modeStatus = "Blocked"; blocked = sess.reason; }
  else if (!spreadOk) { modeStatus = "Blocked"; blocked = "Spread too high"; }
  else if (openCount >= maxPos) { modeStatus = "Waiting"; blocked = "Maximum positions reached"; }
  else if (trendDir === "Neutral" || trendDir.startsWith("Weak")) { modeStatus = "Waiting"; blocked = "Trend flat — EMAs too close or crossing"; }
  else if (!allLayers || !scorePass) { modeStatus = "Waiting"; blocked = "Confirmation layers incomplete"; }
  else { modeStatus = "Active"; }

  // recovery allowed
  let recoveryAllowed = false;
  let recoveryReason = "No open position";
  if (openCount >= 1) {
    recoveryAllowed = true;
    recoveryReason = "Allowed";
    if (!connected) { recoveryAllowed = false; recoveryReason = "MT5 not connected"; }
    else if (equityStopHit) { recoveryAllowed = false; recoveryReason = "Equity protection activated"; }
    else if (dailyLossHit || targetReached) { recoveryAllowed = false; recoveryReason = "Daily limit reached"; }
    else if (!sess.open) { recoveryAllowed = false; recoveryReason = "Session closed"; }
    else if (!spreadOk) { recoveryAllowed = false; recoveryReason = "Spread too high"; }
    else if (trendDir === "Neutral" || trendDir.startsWith("Weak")) { recoveryAllowed = false; recoveryReason = "Recovery blocked: EMA trend invalid"; }
    else if (openCount >= maxPos) { recoveryAllowed = false; recoveryReason = "Recovery blocked: maximum positions reached"; }
    else if (recoveryCount >= maxRec) { recoveryAllowed = false; recoveryReason = "Recovery blocked: recovery limit reached"; }
  }

  // live message
  let msg = "Awaiting market data";
  if (connected) {
    if (blocked && modeStatus === "Blocked") msg = `Blocked: ${blocked.toLowerCase()}`;
    else if (modeStatus === "Active") msg = `Hybrid ${trendDir} confluence confirmed — ${totalScore}/100. Entry valid.`;
    else if (trendOk && pullbackOk && !sweepOk) msg = `Trend + pullback aligned. Waiting for liquidity sweep confirmation.`;
    else if (trendOk && !pullbackOk) msg = pullbackLabel === "Too Deep" ? "Pullback too deep beyond EMA 50." : "Trend confirmed. Waiting for pullback into EMA 20 zone.";
    else if (!trendOk) msg = "Trend layer incomplete — EMAs not aligned or ATR too low.";
    else msg = "Confirmation layers incomplete — standing by.";
  }

  // layers confirmed list
  const layers = [
    { name: "Trend (EMA 6/25 + 20/50)", ok: trendOk },
    { name: "Pullback (EMA 20 zone)", ok: pullbackOk },
    { name: "Liquidity Sweep (SMC)", ok: sweepOk },
    { name: "Engulfing Confirmation", ok: engulfOk || !requireEng },
    { name: "Filters (spread/session/risk)", ok: filtersOk },
  ];

  const fmt = (v, d = 2) => (v == null ? "--" : Number(v).toFixed(d));
  const modeTone = modeStatus === "Active" ? "up" : modeStatus === "Blocked" ? "down" : "warn";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-black text-white tracking-wide leading-tight">{STRATEGY_NAME}</h3>
              <p className="text-[10px] text-white/40">{pair} · Trend · Pullback · Liquidity Sweep</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00ff9d] animate-pulse" : "bg-[#ff4d4d]"}`} />
            <span className="text-[9px] font-heading tracking-widest text-white/50">{connected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>

        {/* Mode status banner */}
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
          style={{ background: modeStatus === "Blocked" ? "rgba(255,77,77,0.08)" : modeStatus === "Active" ? "rgba(0,255,157,0.08)" : "rgba(0,229,255,0.07)", border: `1px solid ${modeStatus === "Blocked" ? "rgba(255,77,77,0.25)" : modeStatus === "Active" ? "rgba(0,255,157,0.25)" : "rgba(0,229,255,0.25)"}` }}>
          {loading ? <Loader2 className="w-4 h-4 text-cyan-300 animate-spin" /> : modeStatus === "Blocked" ? <ShieldAlert className="w-4 h-4 text-[#ff4d4d]" /> : modeStatus === "Active" ? <CheckCircle2 className="w-4 h-4 text-[#00ff9d]" /> : <Activity className="w-4 h-4 text-cyan-300" />}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-heading tracking-widest" style={{ color: modeStatus === "Blocked" ? "#ff9d9d" : modeStatus === "Active" ? "#9dffd4" : "#7dd8ff" }}>HYBRID MODE: {modeStatus.toUpperCase()}</p>
            <p className="text-[10px] text-white/60 truncate">{msg}</p>
          </div>
        </div>

        {/* Indicator grid */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-3">
          <Chip label="EMA 6" value={fmt(ema6, connected ? 2 : 0)} tone={trendDir === "Bullish" ? "up" : trendDir === "Bearish" ? "down" : "neutral"} />
          <Chip label="EMA 20" value={fmt(ema20, connected ? 2 : 0)} tone="cool" />
          <Chip label="EMA 50" value={fmt(ema50, connected ? 2 : 0)} tone="neutral" />
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          <Chip label="EMA 25" value={fmt(ema25, connected ? 2 : 0)} tone="neutral" />
          <Chip label="ATR 14" value={fmt(atr, 3)} tone={atr != null && atr >= minAtr ? "up" : "warn"} />
          <Chip label="Spread (pts)" value={spread == null ? "--" : spread} tone={!spreadOk ? "down" : "neutral"} />
        </div>

        {/* Trend + pullback status */}
        <div className="px-4 pt-3 space-y-1.5">
          <StatusRow icon={trendDir === "Bullish" ? TrendingUp : trendDir === "Bearish" ? TrendingDown : Minus} label="Trend Direction" value={trendDir} tone={trendOk ? (trendDir === "Bullish" ? "up" : "down") : "neutral"} />
          <StatusRow icon={Waves} label="Pullback Status" value={pullbackLabel} tone={pullbackOk ? "up" : "neutral"} />
          <StatusRow icon={ScanLine} label="Liquidity Sweep" value={sweepLabel} tone={sweepOk ? (sweep === "bullish" ? "up" : "down") : "neutral"} />
          <StatusRow icon={Activity} label="Engulfing" value={engulfLabel} tone={engulfOk ? (engulf === "bullish" ? "up" : "down") : "neutral"} />
        </div>

        {/* Confluence scoring */}
        <div className="mx-4 mt-3 rounded-xl px-3 py-3 space-y-2" style={{ background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.18)" }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-heading tracking-wider text-cyan-300">CONFLUENCE SCORE</p>
            <p className="text-[12px] font-heading font-black" style={{ color: totalScore >= minScore ? "#00ff9d" : totalScore >= 50 ? "#ffce4d" : "#ff6b6b" }}>
              {totalScore}/{minScore} min
            </p>
          </div>
          <ScoreBar label="Trend Alignment" value={trendScore} max={wTrend} />
          <ScoreBar label="Pullback Quality" value={pullbackScore} max={wPull} />
          <ScoreBar label="Liquidity Sweep" value={sweepScore} max={wSweep} />
          <ScoreBar label="Engulfing Confirm" value={engulfScore} max={wEng} />
          <ScoreBar label="Filters" value={filterScore} max={wFil} />
        </div>

        {/* Strategy layers confirmed */}
        <div className="px-4 pt-3">
          <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Confirmation Layers</p>
          <div className="space-y-1.5">
            {layers.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                {l.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff9d] shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-white/25 shrink-0" />}
                <span className={`text-[11px] ${l.ok ? "text-white/85" : "text-white/40"}`}>{l.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Position + recovery */}
        <div className="px-4 pt-3 space-y-1.5">
          <StatusRow icon={Layers} label="Open Positions" value={`${openCount} / ${maxPos}`} tone={openCount >= maxPos ? "warn" : "neutral"} />
          <StatusRow icon={Gauge} label="Recovery Status" value={recoveryCount > 0 ? `${recoveryCount} active` : "None"} tone={recoveryCount > 0 ? "warn" : "neutral"} />
          <StatusRow icon={Lock} label="Recovery Allowed" value={openCount === 0 ? "—" : recoveryAllowed ? "Yes" : "No"} tone={openCount === 0 ? "neutral" : recoveryAllowed ? "up" : "down"} />
          <StatusRow icon={Target} label="Basket Floating P&L" value={`${basketPnL >= 0 ? "+" : ""}$${fmt(Math.abs(basketPnL), 2)}`} tone={basketPnL >= 0 ? "up" : "down"} />
        </div>

        {/* Protection grid */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Chip label="Session" value={sess.open ? sess.name : "Closed"} tone={sess.open ? "up" : "down"} />
          <Chip label="Consecutive Losses" value={`${consecLosses} / ${maxConsec}`} tone={consecLosses >= maxConsec ? "down" : "neutral"} />
          <Chip label="Equity Stop" value={equityStopLevel != null ? `$${fmt(equityStopLevel, 2)}` : "--"} tone={equityStopHit ? "down" : "neutral"} />
          <Chip label="Daily Realized" value={`${realizedToday >= 0 ? "+" : ""}$${fmt(Math.abs(realizedToday), 2)}`} tone={realizedToday >= 0 ? "up" : "down"} />
        </div>

        {/* Daily profit target progress */}
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,206,77,0.06)", border: "1px solid rgba(255,206,77,0.2)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-heading tracking-wider text-white/70">DAILY PROFIT TARGET</p>
            <p className="text-[10px] font-heading font-bold text-white/80">${fmt(realizedToday, 2)} / ${fmt(dailyTarget, 0)}</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/8 overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: targetReached ? "#ffce4d" : "linear-gradient(90deg,#ffce4d,#ff9d4d)" }} animate={{ width: `${targetPct}%` }} transition={{ duration: 0.5 }} />
          </div>
        </div>

        {/* Blocked / ready footer */}
        {blocked && modeStatus === "Blocked" ? (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,77,77,0.06)", border: "1px solid rgba(255,77,77,0.2)" }}>
            <XCircle className="w-3.5 h-3.5 text-[#ff6b6b] shrink-0" />
            <p className="text-[10px] text-[#ff9d9d]">{blocked}</p>
          </div>
        ) : modeStatus === "Active" ? (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,255,157,0.06)", border: "1px solid rgba(0,255,157,0.2)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff9d] shrink-0" />
            <p className="text-[10px] text-[#9dffd4]">All confirmation layers agree — high-quality {trendDir.toLowerCase()} entry valid.</p>
          </div>
        ) : (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.18)" }}>
            <Activity className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <p className="text-[10px] text-white/60">{blocked ? `${blocked} — awaiting confluence.` : "Scanning for multi-strategy confluence."}</p>
          </div>
        )}

        {/* Config summary */}
        <div className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          {[
            ["Timeframe", s.hybrid_timeframe || "M15"],
            ["Lot Size", s.hybrid_lot_size ?? "0.01"],
            ["Max Positions", s.hybrid_max_positions ?? 2],
            ["SL ATR", `${s.hybrid_sl_atr_min ?? 1.5}–${s.hybrid_sl_atr_max ?? 1.8}×`],
            ["Min RR", `1:${s.hybrid_min_rr ?? 2}`],
            ["Min Score", `${minScore}/100`],
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