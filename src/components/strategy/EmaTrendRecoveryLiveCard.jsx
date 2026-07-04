import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import GlassCard from "@/components/GlassCard";
import {
  Activity, TrendingUp, TrendingDown, Minus, ShieldAlert, Target,
  Layers, Gauge, Lock, Loader2, CheckCircle2, XCircle,
} from "lucide-react";

const STRATEGY_NAME = "EMA Trend Progressive Recovery";

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
  const toneClass = tone === "up" ? "text-[#00ff9d]" : tone === "down" ? "text-[#ff4d4d]" : tone === "warn" ? "text-amber-400" : "text-white/70";
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

export default function EmaTrendRecoveryLiveCard() {
  const [connected, setConnected] = useState(false);
  const [ind, setInd] = useState(null);
  const [quote, setQuote] = useState(null);
  const [positions, setPositions] = useState([]);
  const [account, setAccount] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [acct, scan, quotes, pos, stg] = await Promise.all([
        mt5Api.account().catch(() => null),
        mt5Api.scannerStatus().catch(() => null),
        mt5Api.quotes().catch(() => null),
        mt5Api.positions().catch(() => null),
        base44.entities.BotSettings.list("-created_date", 1).catch(() => []),
      ]);
      const a = acct?.ok && acct.data?.account;
      setConnected(a?.connected === true);
      setAccount(a);
      setInd(scan?.ok ? scan.data?.scanner?.indicators || scan.data?.indicators || null : null);
      const syms = quotes?.ok ? (quotes.data?.symbols || []) : [];
      const sym = (Array.isArray(syms) ? syms : []).find((s) => (s.symbol || "").toUpperCase() === "XAUUSD") || (Array.isArray(syms) ? syms[0] : null);
      setQuote(sym && sym.bid != null ? { bid: Number(sym.bid), ask: Number(sym.ask), spread: sym.spread != null ? Number(sym.spread) : Number(sym.ask) - Number(sym.bid) } : null);
      setPositions(pos?.ok ? pos.data?.positions || [] : []);
      setSettings(stg?.[0] || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  const s = settings || {};
  const emaFast = ind?.ema_6 ?? ind?.ema6 ?? ind?.ema_20 ?? ind?.ema20 ?? null;
  const emaSlow = ind?.ema_25 ?? ind?.ema25 ?? ind?.ema_50 ?? ind?.ema50 ?? null;
  const atr = ind?.atr_14 ?? ind?.atr14 ?? null;
  const slope = ind?.ema_slope ?? ind?.slope ?? null;
  const price = quote?.bid ?? null;
  const spread = quote?.spread ?? null;

  const emaDist = (emaFast != null && emaSlow != null) ? Math.abs(emaFast - emaSlow) : null;
  const minDist = s.tpr_min_ema_distance ?? 0;
  const trendStrength = s.tpr_trend_strength ?? 0;

  let trend = "Neutral";
  if (emaFast != null && emaSlow != null) {
    if (emaFast > emaSlow && (slope == null || slope > trendStrength) && emaDist >= minDist) trend = "Bullish";
    else if (emaFast < emaSlow && (slope == null || slope < -trendStrength) && emaDist >= minDist) trend = "Bearish";
    else if (emaFast > emaSlow) trend = "Weak Bullish";
    else if (emaFast < emaSlow) trend = "Weak Bearish";
  } else if (!connected) trend = "--";

  const recoveryDist = atr != null ? atr * (s.tpr_recovery_atr_mult ?? 1.2) : null;

  // Basket from open XAUUSD positions
  const basket = positions.filter((p) => (p.symbol || "").toUpperCase() === "XAUUSD");
  const openCount = basket.length;
  let basketAvg = null, basketPnL = 0, totalVol = 0;
  for (const p of basket) {
    const vol = Number(p.volume ?? p.lot ?? 0);
    const ep = Number(p.openPrice ?? p.open_price ?? p.entry_price ?? 0);
    totalVol += vol;
    basketPnL += p.profit ?? p.unrealized_pnl ?? 0;
    if (ep && vol) basketAvg = (basketAvg || 0) + ep * vol;
  }
  if (totalVol > 0) basketAvg = basketAvg / totalVol;

  const initialStatus = openCount >= 1 ? "Open" : "None";
  const recoveryCount = Math.max(0, openCount - 1);
  const recoveryStatus = openCount >= 2 ? `${recoveryCount} active` : "None";

  // Risk gates
  const sess = sessionState();
  const balance = account?.balance ?? s.balance ?? 0;
  const equity = account?.equity ?? balance;
  const equityStopLevel = balance > 0 ? balance * (1 - (s.tpr_equity_stop_pct ?? 3) / 100) : null;
  const floatingPnL = basketPnL;
  const equityDD = balance > 0 ? (floatingPnL / balance) * 100 : 0;

  // Daily realized from closed trades today
  const [realizedToday, setRealizedToday] = useState(0);
  useEffect(() => {
    base44.entities.Trade.list("-closed_at", 30).then((tr) => {
      const todayKey = new Date().toDateString();
      const sum = (tr || []).filter((t) => t.closed_at && new Date(t.closed_at).toDateString() === todayKey).reduce((a, t) => a + (t.profit ?? 0), 0);
      setRealizedToday(sum);
    }).catch(() => {});
  }, [loading]);

  const dailyTarget = s.daily_profit_target_amount ?? s.daily_profit_target ?? 100;
  const targetPct = dailyTarget > 0 ? Math.min(100, Math.max(0, (realizedToday / dailyTarget) * 100)) : 0;
  const targetReached = realizedToday >= dailyTarget && (s.stop_trading_at_daily_target !== false);

  const dailyLossPct = balance > 0 ? Math.min(0, realizedToday + floatingPnL) / balance * 100 : 0;
  const dailyLossHit = dailyLossPct <= -(s.tpr_daily_loss_limit_pct ?? 2);
  const equityStopHit = balance > 0 && equity <= equityStopLevel;

  // Recovery allowed?
  let recoveryAllowed = true;
  let recoveryReason = "Allowed";
  if (!connected) { recoveryAllowed = false; recoveryReason = "MT5 not connected"; }
  else if (equityStopHit) { recoveryAllowed = false; recoveryReason = "Equity protection activated"; }
  else if (dailyLossHit) { recoveryAllowed = false; recoveryReason = "Daily loss limit reached"; }
  else if (targetReached) { recoveryAllowed = false; recoveryReason = "Daily target reached"; }
  else if (!sess.open) { recoveryAllowed = false; recoveryReason = `Session closed — ${sess.reason || ""}`; }
  else if (spread != null && spread > (s.tpr_max_spread_points ?? 30)) { recoveryAllowed = false; recoveryReason = "Spread too high"; }
  else if (trend === "Neutral" || trend.startsWith("Weak")) { recoveryAllowed = false; recoveryReason = "Recovery blocked: trend invalid"; }
  else if (openCount >= (s.tpr_max_open_positions ?? 2)) { recoveryAllowed = false; recoveryReason = "Recovery blocked: maximum positions reached"; }
  else if (recoveryCount >= (s.tpr_max_recovery_positions ?? 1)) { recoveryAllowed = false; recoveryReason = "Recovery blocked: maximum positions reached"; }

  // Live message
  let msg = "Awaiting market data";
  if (connected) {
    if (equityStopHit) msg = "Equity protection activated. Closing positions.";
    else if (targetReached) msg = "Daily target reached. New trading disabled.";
    else if (!sess.open) msg = `No new entries — ${sess.reason || "session closed"}.`;
    else if (openCount >= 2 && basketPnL >= (s.tpr_basket_profit_target ?? 10)) msg = "Basket target reached. Closing all positions.";
    else if (trend === "Bullish") msg = "Strong bullish EMA trend detected.";
    else if (trend === "Bearish") msg = "Strong bearish EMA trend detected.";
    else if (openCount >= 1) msg = recoveryAllowed ? "Recovery window monitoring — trend still valid." : `Recovery blocked: ${(recoveryReason || "").toLowerCase()}`;
    else msg = "Trend neutral — standing by for EMA alignment.";
  }

  const fmt = (v, d = 2) => (v == null ? "--" : Number(v).toFixed(d));
  const blocked = !connected || equityStopHit || dailyLossHit || targetReached || !sess.open || trend === "Neutral" || trend.startsWith("Weak");

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-black text-white tracking-wide leading-tight">{STRATEGY_NAME}</h3>
              <p className="text-[10px] text-white/40">EMA 6/25 · ATR · Capped Recovery · Basket</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00ff9d] animate-pulse" : "bg-[#ff4d4d]"}`} />
            <span className="text-[9px] font-heading tracking-widest text-white/50">{connected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>

        {/* Live message banner */}
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
          style={{ background: blocked ? "rgba(255,77,77,0.08)" : "rgba(255,206,77,0.07)", border: `1px solid ${blocked ? "rgba(255,77,77,0.25)" : "rgba(255,206,77,0.25)"}` }}>
          {loading ? <Loader2 className="w-4 h-4 text-amber-300 animate-spin" /> : blocked ? <ShieldAlert className="w-4 h-4 text-[#ff4d4d]" /> : <Activity className="w-4 h-4 text-amber-400" />}
          <p className="text-[11px] font-heading tracking-wide text-white/85">{msg}</p>
        </div>

        {/* Indicator grid */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-3">
          <Chip label="EMA Fast" value={fmt(emaFast, connected ? 2 : 0)} tone={trend === "Bullish" ? "up" : trend === "Bearish" ? "down" : "neutral"} />
          <Chip label="EMA Slow" value={fmt(emaSlow, connected ? 2 : 0)} tone="neutral" />
          <Chip label="ATR 14" value={fmt(atr, 3)} tone="cool" />
        </div>

        {/* Status rows */}
        <div className="px-4 pt-3 space-y-1.5">
          <StatusRow icon={trend === "Bullish" ? TrendingUp : trend === "Bearish" ? TrendingDown : Minus} label="Trend Direction" value={trend} tone={trend === "Bullish" ? "up" : trend === "Bearish" ? "down" : "neutral"} />
          <StatusRow icon={Layers} label="EMA Distance" value={fmt(emaDist, 3)} tone={emaDist != null && emaDist >= minDist ? "up" : "warn"} />
          <StatusRow icon={Gauge} label="Recovery Distance" value={fmt(recoveryDist, 3)} tone="cool" />
          <StatusRow icon={Activity} label="Initial Position" value={initialStatus} tone={initialStatus === "Open" ? "up" : "neutral"} />
          <StatusRow icon={Layers} label="Recovery Position" value={recoveryStatus} tone={recoveryStatus !== "None" ? "warn" : "neutral"} />
          <StatusRow icon={Activity} label="Open Positions" value={`${openCount} / ${s.tpr_max_open_positions ?? 2}`} tone={openCount >= (s.tpr_max_open_positions ?? 2) ? "warn" : "neutral"} />
          <StatusRow icon={Target} label="Basket Avg Entry" value={fmt(basketAvg, 2)} tone="neutral" />
          <StatusRow icon={Target} label="Basket Floating P&L" value={`${basketPnL >= 0 ? "+" : ""}$${fmt(Math.abs(basketPnL), 2)}`} tone={basketPnL >= 0 ? "up" : "down"} />
          <StatusRow icon={ShieldAlert} label="Equity Stop Level" value={equityStopLevel != null ? `$${fmt(equityStopLevel, 2)}` : "--"} tone={equityStopHit ? "down" : "warn"} />
          <StatusRow icon={Lock} label="Recovery Allowed" value={recoveryAllowed ? "Yes" : "No"} tone={recoveryAllowed ? "up" : "down"} />
        </div>

        {/* Protection grid */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Chip label="Session" value={sess.open ? sess.name : "Closed"} tone={sess.open ? "up" : "down"} />
          <Chip label="Spread (pts)" value={spread == null ? "--" : spread} tone={spread != null && spread > (s.tpr_max_spread_points ?? 30) ? "down" : "neutral"} />
          <Chip label="Equity DD" value={`${equityDD >= 0 ? "+" : ""}${fmt(equityDD, 2)}%`} tone={equityDD < -(s.tpr_equity_stop_pct ?? 3) ? "down" : "neutral"} />
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
          {targetReached && <p className="text-[10px] text-amber-300 mt-1.5 font-heading">Daily target reached. New trading disabled.</p>}
        </div>

        {/* Recovery block reason */}
        {recoveryAllowed ? (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,255,157,0.06)", border: "1px solid rgba(0,255,157,0.2)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff9d] shrink-0" />
            <p className="text-[10px] text-[#9dffd4]">{openCount === 0 ? "Trend valid — awaiting initial entry confirmation." : "Trend valid — one controlled recovery position permitted."}</p>
          </div>
        ) : (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,77,77,0.06)", border: "1px solid rgba(255,77,77,0.2)" }}>
            <XCircle className="w-3.5 h-3.5 text-[#ff6b6b] shrink-0" />
            <p className="text-[10px] text-[#ff9d9d]">{recoveryReason}</p>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}