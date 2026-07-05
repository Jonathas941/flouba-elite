import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import GlassCard from "@/components/GlassCard";
import {
  Activity, TrendingUp, TrendingDown, Minus, ShieldAlert, Target,
  Layers, Gauge, Lock, CheckCircle2, XCircle, Loader2, Clock, Crosshair, Box, Link2,
} from "lucide-react";

const STRATEGY_NAME = "Gold Daily Breakout";
const PAIR = "XAUUSD";

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

function Chip({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: "text-white/70 bg-white/5 border-white/10",
    up: "text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/25",
    down: "text-[#ff4d4d] bg-[#ff4d4d]/10 border-[#ff4d4d]/25",
    warn: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    cool: "text-yellow-300 bg-yellow-500/10 border-yellow-500/25",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-[8px] uppercase tracking-[0.2em] opacity-70 font-heading">{label}</p>
      <p className="font-heading font-bold text-[12px] mt-0.5 truncate">{value}</p>
    </div>
  );
}

function StatusRow({ icon: Icon, label, value, tone }) {
  const toneClass = tone === "up" ? "text-[#00ff9d]" : tone === "down" ? "text-[#ff4d4d]" : tone === "warn" ? "text-amber-400" : tone === "cool" ? "text-yellow-300" : "text-white/70";
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

export default function GoldDailyBreakoutLiveCard() {
  const [connected, setConnected] = useState(false);
  const [quote, setQuote] = useState(null);
  const [account, setAccount] = useState(null);
  const [ind, setInd] = useState(null);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => nowET());

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
    const id = setInterval(load, 4000);
    const tick = setInterval(() => setNow(nowET()), 1000);
    return () => { clearInterval(id); clearInterval(tick); };
  }, []);

  const s = settings || {};
  const price = quote?.bid ?? null;
  const spread = quote?.spread ?? null;
  const atr = ind?.atr_14 ?? ind?.atr14 ?? null;

  // Previous-day high/low (from bridge/scanner)
  const pdh = ind?.prev_day_high ?? ind?.prevDayHigh ?? ind?.d1_high ?? null;
  const pdl = ind?.prev_day_low ?? ind?.prevDayLow ?? ind?.d1_low ?? null;
  const buf = s.gdb_breakout_buffer_points ?? 3;
  const slBuf = s.gdb_sl_buffer_points ?? 5;
  const buyStop = pdh != null ? pdh + buf : null;
  const sellStop = pdl != null ? pdl - buf : null;
  const dayRange = pdh != null && pdl != null ? pdh - pdl : null;

  // Session: London or New York only
  const isWeekend = now.day === 6 || (now.day === 0 && now.minutes < 17 * 60 + 10);
  const fridayLate = now.day === 5 && now.minutes >= 16 * 60 + 55;
  const inLondon = now.minutes >= 3 * 60 && now.minutes < 12 * 60; // 03:00–12:00 ET covers London open → NY morning
  const sessionOk = !isWeekend && !fridayLate && inLondon;
  let sessionName = "Closed";
  if (!isWeekend && !fridayLate) {
    if (now.minutes >= 3 * 60 && now.minutes < 8 * 60) sessionName = "London";
    else if (now.minutes >= 8 * 60 && now.minutes < 12 * 60) sessionName = "London / NY";
    else sessionName = "Outside session";
  }

  // Open positions on XAUUSD
  const xauOpen = positions.filter((p) => (p.symbol || "").toUpperCase() === PAIR);
  const xauOpenCount = xauOpen.length;

  // Trades today
  const todayKey = new Date().toDateString();
  const tradesToday = trades.filter((t) => (t.pair || "").toUpperCase() === PAIR && t.opened_at && new Date(t.opened_at).toDateString() === todayKey);
  const tradesTakenToday = tradesToday.length;
  const maxTrades = s.gdb_max_trades_per_day ?? 1;

  // Risk
  const realizedToday = trades.filter((t) => t.closed_at && new Date(t.closed_at).toDateString() === todayKey).reduce((sum, t) => sum + (t.profit ?? 0), 0);
  const balance = account?.balance ?? s.balance ?? 0;
  const dailyLossPct = balance > 0 ? Math.min(0, realizedToday) / balance * 100 : 0;
  const dailyLossHit = dailyLossPct <= -(s.gdb_max_daily_loss_pct ?? 2);
  const equityStopLevel = balance > 0 ? balance * (1 - (s.gdb_equity_stop_pct ?? 3) / 100) : null;
  const equityStopHit = balance > 0 && (account?.equity ?? balance) <= equityStopLevel;
  const dailyTarget = s.daily_profit_target_amount ?? s.daily_profit_target ?? 100;
  const targetReached = realizedToday >= dailyTarget && (s.stop_trading_at_daily_target !== false);

  let consecLosses = 0;
  for (const t of trades) { if ((t.profit ?? 0) < 0) consecLosses++; else break; }
  const maxConsec = s.gdb_max_consecutive_losses ?? 2;
  const cooldownH = s.gdb_cooldown_hours ?? 8;
  const lastLoss = trades.find((t) => (t.profit ?? 0) < 0);
  const lastLossAt = lastLoss?.closed_at ? new Date(lastLoss.closed_at).getTime() : null;
  const cooldownEnd = consecLosses >= maxConsec && lastLossAt ? lastLossAt + cooldownH * 3600 * 1000 : null;
  const cooldownActive = cooldownEnd != null && Date.now() < cooldownEnd;

  const spreadOk = spread == null || spread <= (s.gdb_max_spread_points ?? 30);
  const atrOk = !(s.gdb_use_atr_filter !== false) || (atr != null && atr >= (s.gdb_min_atr ?? 0));
  const rangeOk = dayRange != null ? dayRange >= (s.gdb_min_range_points ?? 50) && dayRange <= (s.gdb_max_range_points ?? 2000) : null;
  const capHit = tradesTakenToday >= maxTrades;

  // OCO state
  let ocoState = "No orders";
  if (xauOpenCount > 0) ocoState = xauOpen[0]?.direction?.toLowerCase().includes("sell") ? "Sell filled" : "Buy filled";
  else if (buyStop != null && sellStop != null) ocoState = "Both stops placed";

  // Blocked reason
  let blocked = null;
  let modeStatus = "Waiting";
  if (!connected) { modeStatus = "Blocked"; blocked = "MT5 not connected"; }
  else if (isWeekend || fridayLate) { modeStatus = "Blocked"; blocked = "XAUUSD market closed"; }
  else if (!sessionOk) { modeStatus = "Blocked"; blocked = "Outside London/NY session"; }
  else if (equityStopHit) { modeStatus = "Blocked"; blocked = "Equity protection activated"; }
  else if (dailyLossHit) { modeStatus = "Blocked"; blocked = "Daily loss limit reached"; }
  else if (targetReached) { modeStatus = "Blocked"; blocked = "Daily profit target reached"; }
  else if (cooldownActive) { modeStatus = "Blocked"; blocked = "Cooldown active after consecutive losses"; }
  else if (!spreadOk) { modeStatus = "Blocked"; blocked = "Spread too high"; }
  else if (!atrOk) { modeStatus = "Waiting"; blocked = "ATR volatility too low for breakout"; }
  else if (rangeOk === false) { modeStatus = "Waiting"; blocked = `Prev-day range invalid (${dayRange != null ? dayRange.toFixed(1) : "--"} pts)`; }
  else if (xauOpenCount > 0) { modeStatus = "Active"; blocked = null; }
  else if (capHit) { modeStatus = "Blocked"; blocked = "Daily trade cap reached (1/day)"; }
  else { modeStatus = "Active"; }

  let msg = "Awaiting market data";
  if (connected) {
    if (ocoState === "Buy filled" || ocoState === "Sell filled") msg = `${ocoState} — managing position, OCO cancelled the opposite stop.`;
    else if (blocked && modeStatus === "Blocked") msg = `Blocked: ${blocked.toLowerCase()}.`;
    else if (buyStop != null && sellStop != null) msg = `Buy Stop ${buyStop.toFixed(2)} / Sell Stop ${sellStop.toFixed(2)} placed — OCO armed. Waiting for trigger.`;
    else msg = "Waiting for previous-day D1 high/low levels from the bridge.";
  }

  // Planned trade (illustrative based on current levels)
  let planned = null;
  const rr = s.gdb_risk_reward ?? 2;
  if (buyStop != null) {
    const entry = buyStop;
    const sl = Math.min(pdh, entry) - slBuf;
    const risk = Math.abs(entry - sl);
    const tp = entry + risk * rr;
    planned = { dir: "BUY", entry, sl, tp, risk, rr };
  }

  const fmt = (v, d = 2) => (v == null ? "--" : Number(v).toFixed(d));
  const etTimeStr = `${String(now.hh).padStart(2, "0")}:${String(now.mm).padStart(2, "0")}:${String(now.seconds).padStart(2, "0")}`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center">
              <Box className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-black text-white tracking-wide leading-tight">{STRATEGY_NAME}</h3>
              <p className="text-[10px] text-white/40">{PAIR} · D1 levels · OCO pending stops</p>
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
          {loading ? <Loader2 className="w-4 h-4 text-yellow-300 animate-spin" /> : modeStatus === "Blocked" ? <ShieldAlert className="w-4 h-4 text-[#ff4d4d]" /> : modeStatus === "Active" ? <CheckCircle2 className="w-4 h-4 text-yellow-300" /> : <Activity className="w-4 h-4 text-amber-300" />}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-heading tracking-widest" style={{ color: modeStatus === "Active" ? "#ffce4d" : modeStatus === "Blocked" ? "#ff9d9d" : "#fcd34d" }}>
              {modeStatus === "Active" ? "GOLD DAILY BREAKOUT ACTIVE" : `GOLD DAILY BREAKOUT: ${modeStatus.toUpperCase()}`}
            </p>
            <p className="text-[10px] text-white/60 truncate">{msg}</p>
          </div>
        </div>

        {/* Time + session */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Chip label="Current ET Time" value={etTimeStr} tone="cool" />
          <Chip label="Session" value={sessionName} tone={sessionOk ? "up" : "down"} />
        </div>

        {/* Previous-day levels */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          <Chip label="Prev-Day High" value={fmt(pdh, 2)} tone="up" />
          <Chip label="Prev-Day Range" value={dayRange != null ? dayRange.toFixed(2) : "--"} tone={rangeOk === false ? "down" : rangeOk ? "up" : "neutral"} />
          <Chip label="Prev-Day Low" value={fmt(pdl, 2)} tone="down" />
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          <Chip label="Buy Stop" value={fmt(buyStop, 2)} tone="up" />
          <Chip label="Sell Stop" value={fmt(sellStop, 2)} tone="down" />
          <Chip label="Current Price" value={fmt(price, 2)} tone="cool" />
        </div>

        {/* Status rows */}
        <div className="px-4 pt-3 space-y-1.5">
          <StatusRow icon={Link2} label="OCO State" value={ocoState} tone={ocoState.includes("filled") ? "up" : "cool"} />
          <StatusRow icon={Gauge} label="ATR 14" value={fmt(atr, 3)} tone={atrOk ? "up" : "warn"} />
          <StatusRow icon={Activity} label="Spread (pts)" value={spread == null ? "--" : spread} tone={!spreadOk ? "down" : "neutral"} />
          <StatusRow icon={Clock} label="XAUUSD Open Positions" value={xauOpenCount} tone={xauOpenCount > 0 ? "warn" : "up"} />
          <StatusRow icon={Layers} label="Trades Today" value={`${tradesTakenToday} / ${maxTrades}`} tone={capHit ? "down" : "neutral"} />
        </div>

        {/* Planned trade */}
        {planned && (
          <div className="mx-4 mt-3 rounded-xl px-3 py-3 space-y-1.5" style={{ background: "rgba(255,206,77,0.06)", border: "1px solid rgba(255,206,77,0.2)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-heading tracking-wider text-yellow-300">PLANNED BUY STOP</p>
              <span className="text-[10px] font-heading font-bold text-[#00ff9d]">{planned.dir}</span>
            </div>
            <StatusRow icon={Crosshair} label="Entry (Buy Stop)" value={fmt(planned.entry, 2)} tone="cool" />
            <StatusRow icon={Lock} label="Stop Loss" value={fmt(planned.sl, 2)} tone="down" />
            <StatusRow icon={Target} label="Take Profit (2R)" value={fmt(planned.tp, 2)} tone="up" />
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
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,206,77,0.08)", border: "1px solid rgba(255,206,77,0.25)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
            <p className="text-[10px] text-[#fde68a]">Gold Daily Breakout active — OCO pending stops armed on previous-day high/low.</p>
          </div>
        ) : (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.18)" }}>
            <Activity className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <p className="text-[10px] text-white/60">{blocked ? `${blocked}.` : "Waiting for D1 levels and session open."}</p>
          </div>
        )}

        {/* Config summary */}
        <div className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          {[
            ["Symbol", PAIR],
            ["Lot Size", s.gdb_lot_size ?? "0.01"],
            ["Max Trades/Day", s.gdb_max_trades_per_day ?? 1],
            ["Risk Reward", `1:${s.gdb_risk_reward ?? 2}`],
            ["Breakout Buffer", s.gdb_breakout_buffer_points ?? 3],
            ["Break-Even", s.gdb_use_break_even ? "1R" : "Off"],
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