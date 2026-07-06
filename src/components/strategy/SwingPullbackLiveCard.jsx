import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import GlassCard from "@/components/GlassCard";
import {
  Activity, TrendingUp, TrendingDown, Minus, ShieldAlert,
  Clock, Target, Layers, Waves, CheckCircle2, XCircle, Loader2,
} from "lucide-react";

const STRATEGY_NAME = "Swing Trend Pullback Continuation 2026";

// America/New_York session windows (ET)
function nowInET() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false,
    weekday: "short", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday").value;
  const hh = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const mm = parseInt(parts.find((p) => p.type === "minute").value, 10);
  return { wd, minutes: hh * 60 + mm };
}

function sessionState() {
  const { wd, minutes } = nowInET();
  const day = wd.toLowerCase();
  // Friday 16:55 ET → Sunday 17:10 ET: full block
  if (day === "fri" && minutes >= 16 * 60 + 55) return { open: false, reason: "Friday close — weekend block" };
  if (day === "sat") return { open: false, reason: "Weekend — market closed" };
  if (day === "sun" && minutes < 17 * 60 + 10) return { open: false, reason: "Weekend — market closed" };
  // Daily rollover 16:55–17:15 ET
  if (minutes >= 16 * 60 + 55 && minutes <= 17 * 60 + 15) return { open: false, reason: "Rollover / spread spike window" };
  // Asian session 19:15–03:45 (wraps midnight)
  const inAsian = minutes >= 19 * 60 + 15 || minutes <= 3 * 60 + 45;
  // London/NY overlap 08:00–12:00
  const inOverlap = minutes >= 8 * 60 && minutes <= 12 * 60;
  if (inAsian) return { open: true, name: "Asian Session" };
  if (inOverlap) return { open: true, name: "London / New York Overlap" };
  return { open: false, reason: "Outside enabled trading session" };
}

function fmtET(ms) {
  if (!ms) return "--";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: true,
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(ms));
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

export default function SwingPullbackLiveCard() {
  const [connected, setConnected] = useState(false);
  const [ind, setInd] = useState(null);   // scanner indicators
  const [quote, setQuote] = useState(null);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const tick = useRef(0);

  const load = async () => {
    try {
      const [acct, scan, quotes, pos, tr, stg] = await Promise.all([
        mt5Api.account().catch(() => null),
        mt5Api.scannerStatus().catch(() => null),
        mt5Api.quotes().catch(() => null),
        mt5Api.positions().catch(() => null),
        base44.entities.Trade.list("-closed_at", 12).catch(() => []),
        base44.entities.BotSettings.list("-created_date", 1).catch(() => []),
      ]);
      const a = acct?.ok && acct.data?.account;
      setConnected(a?.connected === true);
      const scanner = scan?.ok ? scan.data?.scanner : null;
      setInd(scanner?.indicators || null);
      const syms = quotes?.ok ? quotes.data?.symbols : null;
      const sym = Array.isArray(syms) ? syms.find((s) => (s.symbol || "").toUpperCase() === "XAUUSD") : null;
      setQuote(sym && sym.bid != null ? { bid: Number(sym.bid), ask: Number(sym.ask), spread: sym.spread } : null);
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
  const emaFast = ind?.ema_20 ?? ind?.ema20 ?? null;
  const emaSlow = ind?.ema_50 ?? ind?.ema50 ?? null;
  const atr = ind?.atr_14 ?? ind?.atr14 ?? null;
  const price = quote?.bid ?? null;
  const spread = quote?.spread ?? null;

  // Trend direction
  let trend = "Neutral";
  if (emaFast != null && emaSlow != null) {
    if (emaFast > emaSlow) trend = "Bullish";
    else if (emaFast < emaSlow) trend = "Bearish";
  } else if (!connected) trend = "--";

  // EMA slope (needs scanner-provided prior EMA; otherwise unavailable)
  const slope = ind?.ema_slope ?? ind?.slope ?? null;
  const slopeLabel = slope == null ? "Awaiting" : slope > 0 ? "Up" : slope < 0 ? "Down" : "Flat";

  // Pullback zone
  let pullback = "Waiting";
  if (price != null && emaFast != null && atr != null) {
    const zone = (s.swing_pullback_zone_atr ?? 0.25) * atr;
    const dist = Math.abs(price - emaFast);
    pullback = dist <= zone ? "In Zone" : "Waiting";
  } else if (!connected) pullback = "--";

  // Engulfing (needs closed candles — scanner may expose it)
  const engulfRaw = ind?.engulfing ?? ind?.signal ?? null;
  const engulf = !connected ? "--"
    : engulfRaw === "bullish" ? "Bullish Confirmed"
    : engulfRaw === "bearish" ? "Bearish Confirmed"
    : "Waiting";

  // Consecutive losses + cooldown from closed trades
  let consecLosses = 0;
  for (const t of trades) {
    if ((t.profit ?? 0) < 0) consecLosses++;
    else break;
  }
  const maxConsec = s.swing_max_consecutive_losses ?? 2;
  const cooldownH = s.swing_cooldown_hours ?? 8;
  const lastLoss = trades.find((t) => (t.profit ?? 0) < 0);
  const lastLossAt = lastLoss?.closed_at ? new Date(lastLoss.closed_at).getTime() : null;
  const cooldownEnd = consecLosses >= maxConsec && lastLossAt ? lastLossAt + cooldownH * 3600 * 1000 : null;
  const cooldownActive = cooldownEnd != null && Date.now() < cooldownEnd;

  // Daily P&L from today's closed trades
  const todayKey = new Date().toDateString();
  const todayPnL = trades
    .filter((t) => t.closed_at && new Date(t.closed_at).toDateString() === todayKey)
    .reduce((sum, t) => sum + (t.profit ?? 0), 0);
  const balance = s.balance ?? null;
  const dailyLossPct = balance > 0 ? Math.min(0, todayPnL) / balance * 100 : 0;

  // Session
  const sess = sessionState();

  // Open trades for XAUUSD
  const openCount = positions.filter((p) => (p.symbol || "").toUpperCase() === "XAUUSD").length;

  // Trade status + blocked reason
  let tradeStatus = "Ready";
  let blocked = null;
  if (!connected) { tradeStatus = "Blocked"; blocked = "MT5 not connected"; }
  else if (cooldownActive) { tradeStatus = "Cooldown"; blocked = "Cooldown active after consecutive losses"; }
  else if (!sess.open) { tradeStatus = "Blocked"; blocked = sess.reason; }
  else if (spread != null && spread > (s.swing_max_spread_points ?? 30)) { tradeStatus = "Blocked"; blocked = "Spread too high"; }
  else if (balance > 0 && dailyLossPct <= -(s.swing_max_daily_loss_pct ?? 2)) { tradeStatus = "Blocked"; blocked = "Daily loss limit reached"; }
  else if (openCount >= (s.swing_max_open_trades ?? 2)) { tradeStatus = "Open Position"; blocked = "Maximum open trades reached"; }
  else if (trend === "Neutral") { tradeStatus = "Blocked"; blocked = "Trend neutral — no direction"; }

  // Live message
  let msg = "Awaiting market data";
  if (connected) {
    if (blocked) msg = `Blocked: ${blocked.toLowerCase()}`;
    else if (pullback === "In Zone" && engulf === "Bullish Confirmed") msg = "Bullish engulfing confirmed — BUY setup valid";
    else if (pullback === "In Zone" && engulf === "Bearish Confirmed") msg = "Bearish engulfing confirmed — SELL setup valid";
    else if (pullback === "In Zone") msg = trend === "Bullish" ? "Waiting for bullish pullback" : "Waiting for bearish pullback";
    else if (trend === "Bullish") msg = "EMA trend bullish — waiting for pullback to EMA 20";
    else if (trend === "Bearish") msg = "EMA trend bearish — waiting for pullback to EMA 20";
    else msg = "Trend neutral — standing by";
  }

  const fmt = (v, d = 2) => (v == null ? "--" : Number(v).toFixed(d));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Waves className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-black text-white tracking-wide leading-tight">{STRATEGY_NAME}</h3>
              <p className="text-[10px] text-white/40">Trend · Pullback · Engulfing · ATR</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00ff9d] animate-pulse" : "bg-[#ff4d4d]"}`} />
            <span className="text-[9px] font-heading tracking-widest text-white/50">{connected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>

        {/* Live message banner */}
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
          style={{ background: blocked ? "rgba(255,77,77,0.08)" : "rgba(0,255,157,0.07)", border: `1px solid ${blocked ? "rgba(255,77,77,0.25)" : "rgba(0,255,157,0.25)"}` }}>
          {loading ? <Loader2 className="w-4 h-4 text-cyan-300 animate-spin" /> : blocked ? <ShieldAlert className="w-4 h-4 text-[#ff4d4d]" /> : <Activity className="w-4 h-4 text-[#00ff9d]" />}
          <p className="text-[11px] font-heading tracking-wide text-white/85">{msg}</p>
        </div>

        {/* Indicator grid */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-3">
          <Chip label="EMA 20" value={fmt(emaFast, connected ? 2 : 0)} tone={trend === "Bullish" ? "up" : trend === "Bearish" ? "down" : "neutral"} />
          <Chip label="EMA 50" value={fmt(emaSlow, connected ? 2 : 0)} tone="neutral" />
          <Chip label="ATR 14" value={fmt(atr, 3)} tone="cool" />
        </div>

        {/* Status rows */}
        <div className="px-4 pt-3 space-y-1.5">
          <StatusRow icon={trend === "Bullish" ? TrendingUp : trend === "Bearish" ? TrendingDown : Minus} label="Trend Direction" value={trend} tone={trend === "Bullish" ? "up" : trend === "Bearish" ? "down" : "neutral"} />
          <StatusRow icon={Layers} label="EMA Slope" value={slopeLabel} tone={slopeLabel === "Up" ? "up" : slopeLabel === "Down" ? "down" : "neutral"} />
          <StatusRow icon={Waves} label="Pullback Status" value={pullback} tone={pullback === "In Zone" ? "warn" : "neutral"} />
          <StatusRow icon={Activity} label="Engulfing" value={engulf} tone={engulf.includes("Bullish") ? "up" : engulf.includes("Bearish") ? "down" : "neutral"} />
          <StatusRow icon={Target} label="Trade Status" value={tradeStatus} tone={tradeStatus === "Ready" ? "up" : tradeStatus === "Cooldown" ? "warn" : "down"} />
        </div>

        {/* Protection grid */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Chip label="Consecutive Losses" value={`${consecLosses} / ${maxConsec}`} tone={consecLosses >= maxConsec ? "down" : "neutral"} />
          <Chip label="Open Trades" value={`${openCount} / ${s.swing_max_open_trades ?? 2}`} tone={openCount >= (s.swing_max_open_trades ?? 2) ? "warn" : "neutral"} />
          <Chip label="Session" value={sess.open ? sess.name : "Closed"} tone={sess.open ? "up" : "down"} />
          <Chip label="Spread (pts)" value={spread == null ? "--" : spread} tone={spread != null && spread > (s.swing_max_spread_points ?? 30) ? "down" : "neutral"} />
        </div>

        {/* Cooldown */}
        {cooldownActive && (
          <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: "rgba(255,206,77,0.08)", border: "1px solid rgba(255,206,77,0.25)" }}>
            <Clock className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-[10px] font-heading tracking-wider text-amber-300">COOLDOWN ACTIVE</p>
              <p className="text-[10px] text-white/55">New entries paused until {fmtET(cooldownEnd)} (ET)</p>
            </div>
          </div>
        )}

        {/* Config summary */}
        <div className="px-4 pt-3 pb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          {[
            ["Timeframe", s.swing_timeframe || "M15"],
            ["Lot Size", s.swing_lot_size ?? "0.01"],
            ["ATR SL ×", s.swing_atr_sl_multiplier ?? "1.5"],
            ["Min RR", `1:${s.swing_min_rr ?? 2}`],
            ["Break-Even", s.swing_use_break_even ? "1R" : "Off"],
            ["Partial 50%", s.swing_partial_close_50 ? "1R" : "Off"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-white/5 py-1">
              <span className="text-white/40 uppercase tracking-wider">{k}</span>
              <span className="text-white/80 font-heading font-bold">{v}</span>
            </div>
          ))}
        </div>

        {blocked && (
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,77,77,0.06)", border: "1px solid rgba(255,77,77,0.2)" }}>
            <XCircle className="w-3.5 h-3.5 text-[#ff6b6b] shrink-0" />
            <p className="text-[10px] text-[#ff9d9d]">{blocked}</p>
          </div>
        )}
        {!blocked && connected && (
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,255,157,0.06)", border: "1px solid rgba(0,255,157,0.2)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff9d] shrink-0" />
            <p className="text-[10px] text-[#9dffd4]">Engine ready — scanning closed candles for valid setups.</p>
          </div>
        )}
      </GlassCard>
    </motion.div>
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