import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import GlassCard from "@/components/GlassCard";
import {
  Activity, ShieldAlert, Target,
  Layers, Gauge, Lock, CheckCircle2, XCircle, Loader2, GitBranch, Crosshair,
} from "lucide-react";

const STRATEGY_NAME = "Market Structure BOS Retest Scalper";

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
    cool: "text-violet-300 bg-violet-500/10 border-violet-500/25",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-[8px] uppercase tracking-[0.2em] opacity-70 font-heading">{label}</p>
      <p className="font-heading font-bold text-[12px] mt-0.5 truncate">{value}</p>
    </div>
  );
}

function StatusRow({ icon: Icon, label, value, tone }) {
  const toneClass = tone === "up" ? "text-[#00ff9d]" : tone === "down" ? "text-[#ff4d4d]" : tone === "warn" ? "text-amber-400" : tone === "cool" ? "text-violet-300" : "text-white/70";
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

export default function MsBosRetestLiveCard() {
  const [connected, setConnected] = useState(false);
  const [quote, setQuote] = useState(null);
  const [positions, setPositions] = useState([]);
  const [account, setAccount] = useState(null);
  const [ind, setInd] = useState(null);
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
      const sym = (Array.isArray(syms) ? syms : []).find((s) => (s.symbol || "").toUpperCase() === pair) || (Array.isArray(syms) ? syms[0] : null);
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
  const price = quote?.bid ?? null;
  const spread = quote?.spread ?? null;

  // Structure / BOS / retest from scanner if available
  const structure = ind?.structure ?? ind?.h1_structure ?? null;     // "bullish" | "bearish" | "range"
  const swingHigh = ind?.swing_high ?? ind?.h1_swing_high ?? null;
  const swingLow = ind?.swing_low ?? ind?.h1_swing_low ?? null;
  const bos = ind?.bos ?? ind?.m5_bos ?? null;                       // "bullish" | "bearish" | null
  const retest = ind?.retest ?? ind?.m5_retest ?? null;               // "in_zone" | "confirmed" | null
  const confirm = ind?.confirmation ?? ind?.confirm_candle ?? null;  // "bullish" | "bearish" | null

  const h1Label = structure === "bullish" ? "Bullish" : structure === "bearish" ? "Bearish" : structure === "range" ? "Range" : "Analyzing";
  const bosLabel = bos === "bullish" ? "Bullish BOS" : bos === "bearish" ? "Bearish BOS" : "Waiting";
  const retestLabel = retest === "confirmed" ? "Confirmed" : retest === "in_zone" ? "In Retest Zone" : "Waiting";
  const confirmLabel = confirm === "bullish" ? "Bullish" : confirm === "bearish" ? "Bearish" : "None";

  // risk gates
  const sess = sessionState();
  const balance = account?.balance ?? s.balance ?? 0;
  const equity = account?.equity ?? balance;
  const todayKey = new Date().toDateString();
  const realizedToday = trades
    .filter((t) => t.closed_at && new Date(t.closed_at).toDateString() === todayKey)
    .reduce((sum, t) => sum + (t.profit ?? 0), 0);
  const dailyLossPct = balance > 0 ? Math.min(0, realizedToday) / balance * 100 : 0;
  const dailyLossHit = dailyLossPct <= -(s.ms_max_daily_loss_pct ?? 2);
  const dailyDDHit = balance > 0 && (account?.daily_drawdown ?? 0) !== 0 ? Math.abs(account?.daily_drawdown ?? 0) >= (s.ms_max_daily_drawdown_pct ?? 3) : false;
  const dailyTarget = s.daily_profit_target_amount ?? s.daily_profit_target ?? 100;
  const targetReached = realizedToday >= dailyTarget && (s.stop_trading_at_daily_target !== false);

  let consecLosses = 0;
  for (const t of trades) { if ((t.profit ?? 0) < 0) consecLosses++; else break; }
  const maxConsec = s.ms_max_consecutive_losses ?? 2;
  const cooldownH = s.ms_cooldown_hours ?? 8;
  const lastLoss = trades.find((t) => (t.profit ?? 0) < 0);
  const lastLossAt = lastLoss?.closed_at ? new Date(lastLoss.closed_at).getTime() : null;
  const cooldownEnd = consecLosses >= maxConsec && lastLossAt ? lastLossAt + cooldownH * 3600 * 1000 : null;
  const cooldownActive = cooldownEnd != null && Date.now() < cooldownEnd;

  const spreadOk = spread == null || spread <= (s.ms_max_spread_points ?? 30);

  const todayTrades = trades.filter((t) => (t.pair || "").toUpperCase() === pair && t.opened_at && new Date(t.opened_at).toDateString() === todayKey);
  const tradesToday = todayTrades.length;
  const maxDay = s.ms_max_trades_per_day ?? 3;

  // open positions
  const open = positions.filter((p) => (p.symbol || "").toUpperCase() === pair);
  const openCount = open.length;
  const maxOpen = s.ms_max_open_trades ?? 1;

  // blocked reason + mode status
  let blocked = null;
  let modeStatus = "Waiting";
  if (!connected) { modeStatus = "Blocked"; blocked = "MT5 not connected"; }
  else if (!sess.open) { modeStatus = "Blocked"; blocked = sess.reason; }
  else if (dailyLossHit) { modeStatus = "Blocked"; blocked = "Daily loss limit reached"; }
  else if (dailyDDHit) { modeStatus = "Blocked"; blocked = "Daily drawdown limit reached"; }
  else if (targetReached) { modeStatus = "Blocked"; blocked = "Daily profit target reached"; }
  else if (cooldownActive) { modeStatus = "Blocked"; blocked = "Cooldown active after consecutive losses"; }
  else if (!spreadOk) { modeStatus = "Blocked"; blocked = "Spread too high"; }
  else if (openCount >= maxOpen) { modeStatus = "Waiting"; blocked = "Max open trades reached"; }
  else if (tradesToday >= maxDay) { modeStatus = "Waiting"; blocked = "Daily trade cap reached"; }
  else if (h1Label === "Range") { modeStatus = "Waiting"; blocked = "H1 structure range — no clear BOS"; }
  else if (h1Label === "Analyzing") { modeStatus = "Waiting"; blocked = null; }
  else { modeStatus = "Active"; }

  // live message
  let msg = "Awaiting market data";
  if (connected) {
    if (h1Label === "Analyzing") msg = "Analyzing H1 market structure.";
    else if (h1Label === "Bullish") msg = "Bullish structure detected.";
    else if (h1Label === "Bearish") msg = "Bearish structure detected.";
    else if (bosLabel === "Waiting") msg = "Waiting for M5 Break of Structure.";
    else if (retestLabel === "Waiting") msg = "Breakout detected. Waiting for retest.";
    else if (retestLabel === "In Retest Zone") msg = "Retest in progress.";
    else if (confirmLabel === "Bullish") msg = "Bullish confirmation confirmed. BUY opened.";
    else if (confirmLabel === "Bearish") msg = "Bearish confirmation confirmed. SELL opened.";
    if (blocked && modeStatus === "Blocked") msg = `Blocked: ${blocked.toLowerCase()}.`;
  }

  // planned trade (illustrative, from confirmation candle proxy if present)
  const rr = s.ms_risk_reward ?? 2;
  const slBuf = s.ms_sl_buffer_points ?? 5;
  let planned = null;
  if (confirm === "bullish" && price != null) {
    const sl = price - slBuf;
    const risk = Math.abs(price - sl);
    planned = { dir: "BUY", entry: price, sl, tp: price + risk * rr, risk, rr };
  } else if (confirm === "bearish" && price != null) {
    const sl = price + slBuf;
    const risk = Math.abs(sl - price);
    planned = { dir: "SELL", entry: price, sl, tp: price - risk * rr, risk, rr };
  }

  const fmt = (v, d = 2) => (v == null ? "--" : Number(v).toFixed(d));
  const now = nowET();
  const etTimeStr = `${String(now.hh).padStart(2, "0")}:${String(now.mm).padStart(2, "0")}:${String(now.seconds).padStart(2, "0")}`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-black text-white tracking-wide leading-tight">{STRATEGY_NAME}</h3>
              <p className="text-[10px] text-white/40">{pair} · H1 structure → M5 BOS → Retest → Confirm</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00ff9d] animate-pulse" : "bg-[#ff4d4d]"}`} />
            <span className="text-[9px] font-heading tracking-widest text-white/50">{connected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>

        {/* Mode status banner */}
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
          style={{ background: modeStatus === "Blocked" ? "rgba(255,77,77,0.08)" : modeStatus === "Active" ? "rgba(0,255,157,0.08)" : "rgba(139,92,246,0.07)", border: `1px solid ${modeStatus === "Blocked" ? "rgba(255,77,77,0.25)" : modeStatus === "Active" ? "rgba(0,255,157,0.25)" : "rgba(139,92,246,0.25)"}` }}>
          {loading ? <Loader2 className="w-4 h-4 text-violet-300 animate-spin" /> : modeStatus === "Blocked" ? <ShieldAlert className="w-4 h-4 text-[#ff4d4d]" /> : modeStatus === "Active" ? <CheckCircle2 className="w-4 h-4 text-[#00ff9d]" /> : <Activity className="w-4 h-4 text-violet-300" />}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-heading tracking-widest" style={{ color: modeStatus === "Blocked" ? "#ff9d9d" : modeStatus === "Active" ? "#9dffd4" : "#c4b5fd" }}>BOS RETEST: {modeStatus.toUpperCase()}</p>
            <p className="text-[10px] text-white/60 truncate">{msg}</p>
          </div>
        </div>

        {/* Time + session */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Chip label="Current ET Time" value={etTimeStr} tone="cool" />
          <Chip label="Session" value={sess.open ? sess.name : "Closed"} tone={sess.open ? "up" : "down"} />
        </div>

        {/* Structure grid */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-2">
          <Chip label="H1 Market Structure" value={h1Label} tone={h1Label === "Bullish" ? "up" : h1Label === "Bearish" ? "down" : "warn"} />
          <Chip label="M5 BOS Status" value={bosLabel} tone={bos === "bullish" ? "up" : bos === "bearish" ? "down" : "neutral"} />
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pt-2">
          <Chip label="Retest Status" value={retestLabel} tone={retest === "confirmed" ? "up" : retest === "in_zone" ? "warn" : "neutral"} />
          <Chip label="Confirmation Candle" value={confirmLabel} tone={confirm === "bullish" ? "up" : confirm === "bearish" ? "down" : "neutral"} />
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pt-2">
          <Chip label="Swing High (H1)" value={fmt(swingHigh, 1)} tone="up" />
          <Chip label="Swing Low (H1)" value={fmt(swingLow, 1)} tone="down" />
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pt-2">
          <Chip label="Current Price" value={fmt(price, 1)} tone="cool" />
          <Chip label="Spread (pts)" value={spread == null ? "--" : spread} tone={!spreadOk ? "down" : "neutral"} />
        </div>

        {/* Status rows */}
        <div className="px-4 pt-3 space-y-1.5">
          <StatusRow icon={GitBranch} label="Trade Direction" value={confirm === "bullish" ? "BUY" : confirm === "bearish" ? "SELL" : "--"} tone={confirm === "bullish" ? "up" : confirm === "bearish" ? "down" : "neutral"} />
          <StatusRow icon={Layers} label="Open Positions" value={`${openCount} / ${maxOpen}`} tone={openCount >= maxOpen ? "warn" : "neutral"} />
          <StatusRow icon={Gauge} label="Trades Today" value={`${tradesToday} / ${maxDay}`} tone={tradesToday >= maxDay ? "down" : "neutral"} />
        </div>

        {/* Planned trade */}
        {planned && (
          <div className="mx-4 mt-3 rounded-xl px-3 py-3 space-y-1.5" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-heading tracking-wider text-violet-300">PLANNED TRADE</p>
              <span className={`text-[10px] font-heading font-bold ${planned.dir === "BUY" ? "text-[#00ff9d]" : "text-[#ff4d4d]"}`}>{planned.dir}</span>
            </div>
            <StatusRow icon={Crosshair} label="Entry" value={fmt(planned.entry, 1)} tone="cool" />
            <StatusRow icon={Lock} label="Stop Loss" value={fmt(planned.sl, 1)} tone="down" />
            <StatusRow icon={Target} label="Take Profit" value={fmt(planned.tp, 1)} tone="up" />
            <StatusRow icon={Activity} label="Risk Distance" value={fmt(planned.risk, 1)} tone="warn" />
            <StatusRow icon={Gauge} label="Risk : Reward" value={`1 : ${planned.rr}`} tone="up" />
          </div>
        )}

        {/* Protection grid */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Chip label="Daily Realized" value={`${realizedToday >= 0 ? "+" : ""}$${fmt(Math.abs(realizedToday), 2)}`} tone={realizedToday >= 0 ? "up" : "down"} />
          <Chip label="Consecutive Losses" value={`${consecLosses} / ${maxConsec}`} tone={consecLosses >= maxConsec ? "down" : "neutral"} />
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
            <p className="text-[10px] text-[#9dffd4]">Structure + BOS + retest + confirmation aligned — awaiting entry.</p>
          </div>
        ) : (
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.18)" }}>
            <Activity className="w-3.5 h-3.5 text-violet-300 shrink-0" />
            <p className="text-[10px] text-white/60">{blocked ? `${blocked}.` : "Scanning H1 structure and M5 break of structure."}</p>
          </div>
        )}

        {/* Config summary */}
        <div className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          {[
            ["Symbol", pair],
            ["HTF / ETF", `${s.ms_htf_timeframe || "H1"} / ${s.ms_entry_timeframe || "M5"}`],
            ["Lot Size", s.ms_lot_size ?? "0.01"],
            ["Max Trades/Day", s.ms_max_trades_per_day ?? 3],
            ["Risk Reward", `1:${s.ms_risk_reward ?? 2}`],
            ["SL Buffer (pts)", s.ms_sl_buffer_points ?? 5],
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