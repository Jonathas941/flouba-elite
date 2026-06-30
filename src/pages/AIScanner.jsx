import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import {
  TrendingUp, TrendingDown, Minus, Zap, Shield, Target,
  BarChart3, AlertTriangle, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Activity, Layers, Filter, Gauge,
} from "lucide-react";

/* ─── STATIC MARKET SCANNER DATA (refreshes every 8s) ─── */
const SCANNER_BASE = [
  { pair: "XAUUSD", trend: "Bullish", trendStrength: "Strong",  zone: "Demand Zone", signal: "Buy",    confidence: 87, status: "Active",  structure: "HH/HL", smc: "OB Mitigation",  fib: "61.8%", pattern: "Bullish Engulfing", price: 3368.45, entry: 3358.00, sl: 3345.00, tp: 3392.00 },
  { pair: "US30",   trend: "Bullish", trendStrength: "Strong",  zone: "Order Block",  signal: "Buy",    confidence: 83, status: "Active",  structure: "HH/HL", smc: "Demand Zone",   fib: "50%",   pattern: "Morning Star",       price: 44280,   entry: 44150,   sl: 43900,   tp: 44650   },
  { pair: "GBPUSD", trend: "Bullish", trendStrength: "Moderate",zone: "Demand Zone",  signal: "Buy",    confidence: 78, status: "Pending", structure: "HH/HL", smc: "FVG Fill",       fib: "61.8%", pattern: "Hammer",             price: 1.27314, entry: 1.27050, sl: 1.26700, tp: 1.27900 },
  { pair: "EURUSD", trend: "Bearish", trendStrength: "Moderate",zone: "Supply Zone",  signal: "Sell",   confidence: 66, status: "Pending", structure: "LH/LL", smc: "Supply Zone",    fib: "50%",   pattern: "Shooting Star",      price: 1.08423, entry: 1.08540, sl: 1.08750, tp: 1.08100 },
  { pair: "NAS100", trend: "Bearish", trendStrength: "Weak",    zone: "Supply Zone",  signal: "Sell",   confidence: 54, status: "No Trade",structure: "ChoCH", smc: "Liq. Sweep",    fib: "78.6%", pattern: "Evening Star",       price: 20145,   entry: 20210,   sl: 20400,   tp: 19900   },
  { pair: "USDJPY", trend: "Bullish", trendStrength: "Moderate",zone: "Order Block",  signal: "Buy",    confidence: 71, status: "Pending", structure: "BOS",   smc: "OB + FVG",      fib: "50%",   pattern: "Tweezer Bottom",     price: 149.821, entry: 149.550, sl: 149.100, tp: 150.400 },
];

const randomize = (base) =>
  base.map((r) => ({
    ...r,
    price: r.price + (Math.random() - 0.5) * (r.price > 1000 ? 2 : r.price > 100 ? 0.3 : 0.0003),
    confidence: Math.min(99, Math.max(30, r.confidence + Math.round((Math.random() - 0.5) * 4))),
  }));

/* ─── HELPERS ─── */
const scoreLabel = (s) =>
  s >= 80 ? { text: "Strong Signal", color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" }
  : s >= 65 ? { text: "Possible Trade", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" }
  : { text: "No Trade", color: "text-red-400", bg: "bg-red-500/15 border-red-500/30" };

const trendIcon = (trend) =>
  trend === "Bullish" ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
  : trend === "Bearish" ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  : <Minus className="w-3.5 h-3.5 text-muted-foreground" />;

const statusBadge = (s) => {
  if (s === "Active")   return "bg-green-500/15 text-green-400 border border-green-500/30";
  if (s === "Pending")  return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
  return "bg-white/5 text-muted-foreground border border-white/10";
};

const fmtPrice = (pair, p) => {
  if (!p) return "—";
  if (pair === "XAUUSD" || pair === "NAS100" || pair === "US30") return Number(p).toFixed(2);
  if (pair === "USDJPY") return Number(p).toFixed(3);
  return Number(p).toFixed(5);
};

/* ─── SUB-COMPONENTS ─── */
function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-red-400" />
      </div>
      <div>
        <h2 className="font-heading text-sm font-bold text-white uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function AIScoreMeter({ score }) {
  const lbl = scoreLabel(score);
  const CIRC = 2 * Math.PI * 38;
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(239,68,68,0.08)" strokeWidth="10" />
          <motion.circle
            cx="50" cy="50" r="38" fill="none"
            stroke={score >= 80 ? "#4ade80" : score >= 65 ? "#f59e0b" : "#ef4444"}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: CIRC }}
            animate={{ strokeDashoffset: CIRC * (1 - score / 100) }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-heading text-lg font-black text-white">{score}%</span>
        </div>
      </div>
      <div>
        <p className={`font-heading text-base font-bold ${lbl.color}`}>{lbl.text}</p>
        <div className="mt-2 space-y-1.5">
          {[
            { range: "80–100", label: "Strong Buy/Sell", color: "text-green-400" },
            { range: "65–79", label: "Possible Trade",  color: "text-amber-400" },
            { range: "0–64",  label: "No Trade",        color: "text-red-400" },
          ].map((r) => (
            <div key={r.range} className="flex items-center gap-2">
              <span className="text-[10px] font-heading text-muted-foreground w-14">{r.range}</span>
              <span className={`text-[10px] font-semibold ${r.color}`}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScannerCard({ row, index }) {
  const [open, setOpen] = useState(false);
  const lbl = scoreLabel(row.confidence);
  const buy = row.signal === "Buy";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <GlassCard className="p-0 overflow-hidden">
        <button className="w-full p-4 text-left" onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${buy ? "bg-green-500/10" : "bg-red-500/10"}`}>
                {buy ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
              </div>
              <div>
                <p className="font-heading font-black text-white text-base">{row.pair}</p>
                <p className="text-[11px] text-muted-foreground">{fmtPrice(row.pair, row.price)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${statusBadge(row.status)}`}>{row.status}</span>
              {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { l: "Trend",  v: row.trend, c: row.trend === "Bullish" ? "text-green-400" : "text-red-400" },
              { l: "Zone",   v: row.zone,  c: "text-amber-300" },
              { l: "Signal", v: row.signal, c: buy ? "text-green-400" : "text-red-400" },
              { l: "Structure", v: row.structure, c: "text-sky-300" },
            ].map((item) => (
              <div key={item.l}>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{item.l}</p>
                <p className={`text-xs font-bold font-heading ${item.c} mt-0.5`}>{item.v}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">AI Confidence</span>
              <span className={`text-[10px] font-bold ${lbl.color}`}>{row.confidence}% · {lbl.text}</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${row.confidence >= 80 ? "bg-green-500" : row.confidence >= 65 ? "bg-amber-500" : "bg-red-500"}`}
                initial={{ width: 0 }}
                animate={{ width: `${row.confidence}%` }}
                transition={{ duration: 1, delay: index * 0.05 + 0.2 }}
              />
            </div>
          </div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden border-t border-white/5"
            >
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: "Entry",       v: fmtPrice(row.pair, row.entry), c: "text-white" },
                    { l: "Stop Loss",   v: fmtPrice(row.pair, row.sl),    c: "text-red-400" },
                    { l: "Take Profit", v: fmtPrice(row.pair, row.tp),    c: "text-green-400" },
                  ].map((item) => (
                    <div key={item.l} className="glass rounded-xl p-2.5">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{item.l}</p>
                      <p className={`text-sm font-heading font-bold ${item.c} mt-0.5`}>{item.v}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: "SMC Setup",    v: row.smc },
                    { l: "Fibonacci",    v: row.fib },
                    { l: "Pattern",      v: row.pattern },
                    { l: "Strength",     v: row.trendStrength },
                  ].map((item) => (
                    <div key={item.l} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-red-400 shrink-0" />
                      <span className="text-[11px] text-muted-foreground">{item.l}: <span className="text-white font-semibold">{item.v}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

/* ─── MAIN PAGE ─── */
export default function AIScanner() {
  const [data, setData] = useState(SCANNER_BASE);
  const [tab, setTab] = useState("scanner");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setData(randomize(SCANNER_BASE));
      setLastUpdate(new Date());
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const activeSignals = data.filter((d) => d.confidence >= 65).length;
  const avgScore = Math.round(data.reduce((a, d) => a + d.confidence, 0) / data.length);

  const TABS = ["scanner", "structure", "smc", "filters", "patterns"];

  return (
    <div className="px-4 pt-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-black text-white neon-text">AI Scanner</h1>
          <p className="text-sm text-muted-foreground">Strategy & Market Analysis Engine</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <motion.div className="w-2 h-2 bg-green-400 rounded-full" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">Live</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{lastUpdate.toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Overview row */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Scanning</p>
          <p className="font-heading text-xl font-black text-white">{data.length}</p>
          <p className="text-[10px] text-muted-foreground">pairs</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Signals</p>
          <p className="font-heading text-xl font-black text-green-400">{activeSignals}</p>
          <p className="text-[10px] text-muted-foreground">valid</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg AI</p>
          <p className={`font-heading text-xl font-black ${avgScore >= 75 ? "text-green-400" : avgScore >= 65 ? "text-amber-400" : "text-red-400"}`}>{avgScore}%</p>
          <p className="text-[10px] text-muted-foreground">score</p>
        </GlassCard>
      </div>

      {/* Tab bar — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 rounded-xl font-heading text-[10px] uppercase tracking-widest font-bold transition-all ${tab === t ? "bg-red-600 text-white neon-red" : "glass text-muted-foreground"}`}>
            {t === "scanner" ? "Market Scanner" : t === "structure" ? "Market Structure" : t === "smc" ? "SMC" : t === "filters" ? "Filters" : "Patterns"}
          </button>
        ))}
      </div>

      {/* ── MARKET SCANNER ── */}
      {tab === "scanner" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Refreshes every 8s · tap a card to expand trade details</p>
          </div>
          {data.map((row, i) => <ScannerCard key={row.pair} row={row} index={i} />)}
        </div>
      )}

      {/* ── MARKET STRUCTURE ── */}
      {tab === "structure" && (
        <div className="space-y-3">
          <SectionHeader icon={Activity} title="Market Structure" subtitle="Trend identification via swing analysis" />

          {[
            { label: "Uptrend",  tag: "HH / HL", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: TrendingUp, desc: "Price makes Higher Highs (HH) followed by Higher Lows (HL). Only Buy setups are valid. Wait for HL retest before entry." },
            { label: "Downtrend", tag: "LH / LL", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: TrendingDown, desc: "Price makes Lower Highs (LH) followed by Lower Lows (LL). Only Sell setups are valid. Wait for LH rejection before entry." },
            { label: "Break of Structure", tag: "BOS", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20", icon: Zap, desc: "Price breaks the most recent swing high (bullish BOS) or swing low (bearish BOS). Confirms trend continuation — trade in the direction of the break." },
            { label: "Change of Character", tag: "ChoCH", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: AlertTriangle, desc: "First opposite BOS after a trend. Early reversal signal — shift directional bias. Wait for confirmation before entering counter-trend." },
          ].map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
              <GlassCard className={`border ${item.bg}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}>
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-heading text-sm font-bold ${item.color}`}>{item.label}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${item.bg} ${item.color} font-bold`}>{item.tag}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </GlassCard>
            </motion.div>
          ))}

          {/* Live structure panel */}
          <GlassCard>
            <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Current Pair Structure</h3>
            <div className="space-y-2">
              {data.map((row) => (
                <div key={row.pair} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="font-heading text-sm font-bold text-white">{row.pair}</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-heading text-xs font-bold ${row.trend === "Bullish" ? "text-green-400" : "text-red-400"}`}>{row.structure}</span>
                    <div className="flex items-center gap-1">{trendIcon(row.trend)}<span className={`text-xs ${row.trend === "Bullish" ? "text-green-400" : "text-red-400"}`}>{row.trend}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── SMART MONEY CONCEPTS ── */}
      {tab === "smc" && (
        <div className="space-y-3">
          <SectionHeader icon={Shield} title="Smart Money Concepts" subtitle="Institutional footprint tracking" />

          {[
            { title: "Order Block (OB)", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", desc: "Last opposing candle before a strong impulsive move. Bullish OB = last red candle before up-move. Bearish OB = last green candle before down-move.", rule: "Entry at 50% of OB body · SL below/above OB wick" },
            { title: "Supply Zone",       color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",    desc: "Area where price previously collapsed sharply. Institutional sell orders remain unfilled here. Price returns to the zone to fill those orders before dropping.", rule: "Sell at zone test · SL above zone top" },
            { title: "Demand Zone",       color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",desc: "Area where price previously exploded upward. Institutional buy orders remain unfilled here. Price returns to fill those orders before rallying again.", rule: "Buy at zone test · SL below zone bottom" },
            { title: "Liquidity Sweep",   color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20", desc: "Smart money drives price beyond obvious swing highs/lows to trigger retail stop losses, collecting that liquidity before reversing sharply.", rule: "Wait for sweep + reversal candle · tight SL at sweep wick" },
            { title: "Fair Value Gap (FVG)", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20",  desc: "A 3-candle imbalance where the wicks of candle 1 and 3 do not overlap. Price tends to return to fill this gap before continuing the trend.", rule: "Enter on FVG fill · OB + FVG confluence = premium setup" },
          ].map((item, i) => (
            <motion.div key={item.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <GlassCard className={`border ${item.bg}`}>
                <h3 className={`font-heading text-sm font-bold mb-1 ${item.color}`}>{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">{item.desc}</p>
                <div className="flex items-start gap-2 pt-2 border-t border-white/5">
                  <Target className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-300 font-semibold">{item.rule}</p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── CONFIRMATION FILTERS ── */}
      {tab === "filters" && (
        <div className="space-y-3">
          <SectionHeader icon={Filter} title="Confirmation Filters" subtitle="Multi-layer trade validation system" />

          {/* Fibonacci */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-red-400" />
              <h3 className="font-heading text-sm font-bold text-white">Fibonacci Retracement</h3>
            </div>
            {[
              { level: "50.0%",  label: "First entry zone",       color: "bg-amber-500",  width: "50%",   note: "Valid if OB aligns" },
              { level: "61.8%",  label: "Golden Ratio — optimal", color: "bg-green-500",  width: "61.8%", note: "Primary entry target" },
              { level: "78.6%",  label: "Final entry zone",       color: "bg-red-500",    width: "78.6%", note: "Last chance — tight SL" },
            ].map((fib) => (
              <div key={fib.level} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-black text-white">{fib.level}</span>
                    <span className="text-xs text-muted-foreground">{fib.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{fib.note}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className={`h-full ${fib.color} rounded-full`}
                    initial={{ width: 0 }} animate={{ width: fib.width }}
                    transition={{ duration: 1, ease: "easeOut" }} />
                </div>
              </div>
            ))}
          </GlassCard>

          {/* Other filters */}
          {[
            { icon: TrendingUp, title: "Trendline — 3-Touch Rule", desc: "A trendline is valid only with a minimum of 3 touch points. Third touch = entry trigger on bounce. Trendline break with candle close outside = ChoCH / BOS alert. Fakeouts rejected by waiting for candle close confirmation." },
            { icon: Gauge, title: "Psychological Levels", desc: "Round numbers (X.000, X.500) attract institutional orders. Major levels: 3400, 44000, 150.000. Always place TP slightly before these levels. OB or S&D zone + psychological level = premium confluence." },
            { icon: Activity, title: "Volume & Momentum", desc: "Displacement candles (large bodies, high volume) confirm institutional intent. Low-volume tests of OBs are ideal entries. Momentum divergence at supply/demand = reversal warning." },
            { icon: AlertTriangle, title: "News Filter", desc: "Robot pauses 30 minutes before and after high-impact news events (NFP, CPI, FOMC). Volatility spikes cause erratic price action that invalidates technical setups. Sessions resume after the news candle closes." },
          ].map((item, i) => (
            <motion.div key={item.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <GlassCard>
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className="w-4 h-4 text-red-400" />
                  <h3 className="font-heading text-sm font-bold text-white">{item.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </GlassCard>
            </motion.div>
          ))}

          {/* AI Score system */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-red-400" />
              <h3 className="font-heading text-sm font-bold text-white">AI Score Decision Engine</h3>
            </div>
            <AIScoreMeter score={avgScore} />
          </GlassCard>
        </div>
      )}

      {/* ── CANDLESTICK PATTERNS ── */}
      {tab === "patterns" && (
        <div className="space-y-4">
          <SectionHeader icon={Layers} title="Candlestick Patterns" subtitle="12 high-probability reversal setups" />

          {/* Bullish */}
          <div>
            <p className="text-xs text-green-400 uppercase tracking-widest font-bold mb-3">▲ Bullish Patterns</p>
            <div className="space-y-3">
              {[
                { name: "Hammer",              power: 82, desc: "Small body at top, long lower wick at demand zone. Buyers rejected the lows with force — reversal imminent." },
                { name: "Bullish Engulfing",   power: 88, desc: "Large green candle fully engulfs prior red candle. Decisive shift of control from sellers to buyers." },
                { name: "Morning Star",        power: 85, desc: "3-candle: bearish → doji → strong bullish. Seller exhaustion at lows, buyers stepping in." },
                { name: "Three White Soldiers",power: 80, desc: "3 consecutive strong bullish closes. Sustained institutional buying — continuation signal." },
                { name: "Tweezer Bottom",      power: 78, desc: "Two candles with identical lows. Double institutional rejection of the same level." },
                { name: "Piercing Line",       power: 74, desc: "Bullish candle closes above midpoint of prior bearish candle. Strong buyer re-entry after a push down." },
              ].map((p, i) => (
                <motion.div key={p.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <GlassCard className="flex gap-3 items-start">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-heading text-sm font-bold text-white">{p.name}</h4>
                        <span className="text-xs font-bold text-green-400">{p.power}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{p.desc}</p>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-green-500 rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${p.power}%` }}
                          transition={{ duration: 0.9, delay: 0.2 + i * 0.05 }} />
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bearish */}
          <div>
            <p className="text-xs text-red-400 uppercase tracking-widest font-bold mb-3">▼ Bearish Patterns</p>
            <div className="space-y-3">
              {[
                { name: "Shooting Star",      power: 81, desc: "Small body at bottom, long upper wick at supply zone. Buyers tried to push up — sellers overwhelmed them." },
                { name: "Hanging Man",        power: 72, desc: "Looks like Hammer but at market tops. Despite early buying, sellers closed price near the open." },
                { name: "Bearish Engulfing",  power: 88, desc: "Large red candle fully engulfs prior green candle. Sellers took complete control at key supply." },
                { name: "Evening Star",       power: 85, desc: "3-candle: bullish → doji → strong bearish. Buyer exhaustion at highs — sellers capitalize." },
                { name: "Three Black Crows",  power: 80, desc: "3 consecutive strong bearish closes. Sustained institutional selling — continuation to downside." },
                { name: "Dark Cloud Cover",   power: 75, desc: "Bearish candle opens above prior high and closes below midpoint. Bears overpower late buyers decisively." },
              ].map((p, i) => (
                <motion.div key={p.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <GlassCard className="flex gap-3 items-start">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-heading text-sm font-bold text-white">{p.name}</h4>
                        <span className="text-xs font-bold text-red-400">{p.power}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{p.desc}</p>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-red-500 rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${p.power}%` }}
                          transition={{ duration: 0.9, delay: 0.2 + i * 0.05 }} />
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}