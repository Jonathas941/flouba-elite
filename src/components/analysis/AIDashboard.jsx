import React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, Zap, Target, Radio, Brain,
} from "lucide-react";

function Metric({ label, value, color = "text-white", small = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] uppercase tracking-[0.2em] text-white/25 font-heading">{label}</span>
      <span className={`font-heading font-bold ${small ? "text-[11px]" : "text-sm"} ${color} leading-tight`}>{value ?? "--"}</span>
    </div>
  );
}

const STRATEGY_META = {
  "Momentum Scalping": { color: "text-green-400",  border: "border-green-500/30",  bg: "bg-green-500/10",  icon: TrendingUp },
  "Range Breakout":    { color: "text-sky-400",    border: "border-sky-500/30",    bg: "bg-sky-500/10",    icon: Activity },
  "Volatility Spike":  { color: "text-amber-400",  border: "border-amber-500/30",  bg: "bg-amber-500/10",  icon: Zap },
  "Hybrid Manual":     { color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10", icon: Target },
  "HFT Scalper":       { color: "text-pink-400",   border: "border-pink-500/30",   bg: "bg-pink-500/10",   icon: Zap },
  "Auto":              { color: "text-white/60",   border: "border-white/15",      bg: "bg-white/5",       icon: Brain },
};

const STRATEGY_LABELS = {
  momentum_scalping: "Momentum Scalping",
  range_breakout:    "Range Breakout",
  volatility_spike:  "Volatility Spike",
  hybrid_manual:     "Hybrid Manual",
  hft_scalper:       "HFT Scalper",
  auto:              "Auto",
};

function strategyLabel(raw) {
  if (!raw) return "Auto";
  return STRATEGY_LABELS[raw] || raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * AIDashboard — renders the live AI scanner panel using REAL data
 * pulled from the MT5 backend's scanner_status endpoint (no simulated values).
 * Props: scanner — raw scanner object { strategy, symbol, signal_score, last_signal, reason, conditions, indicators, risk }
 */
export default function AIDashboard({ scanner }) {
  if (!scanner) {
    return (
      <div className="py-8 flex flex-col items-center gap-3 text-center rounded-2xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Radio className="w-7 h-7 text-white/15" />
        <p className="font-heading text-xs uppercase tracking-widest text-white/25">Waiting for scan data…</p>
      </div>
    );
  }

  const ind = scanner.indicators || {};
  const strategy = strategyLabel(scanner.strategy);
  const sm = STRATEGY_META[strategy] || STRATEGY_META["Auto"];
  const StratIcon = sm.icon;

  const score = scanner.signal_score ?? 0;
  const scoreColor = score >= 85 ? "text-green-400"
    : score >= 70 ? "text-amber-400"
    : score >= 60 ? "text-orange-400" : "text-white/30";

  const direction = scanner.last_signal && scanner.last_signal !== "HOLD"
    ? scanner.last_signal
    : (ind.ema_20 > ind.ema_50 ? "BUY" : "SELL");

  const adxOk    = (ind.adx_14 ?? 0) > 20;
  const atrOk    = (ind.atr_14 ?? 0) > 0;
  const trend    = ind.ema_20 > ind.ema_50 ? "Uptrend" : "Downtrend";
  const trendColor = trend === "Uptrend" ? "text-green-400" : "text-red-400";

  const riskLevel = score >= 80 ? "Low" : score >= 60 ? "Medium" : "High";

  // Smart SL/TP derived from the real ATR value (not random — actual indicator)
  const slDistance = ind.atr_14 != null ? (ind.atr_14 * 1.5).toFixed(3) : "--";
  const tpDistance = ind.atr_14 != null ? (ind.atr_14 * 3.0).toFixed(3) : "--";

  return (
    <div className="space-y-2">

      {/* ── AI Strategy Banner ─────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${sm.border} ${sm.bg}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sm.bg} border ${sm.border}`}>
            <StratIcon className={`w-4 h-4 ${sm.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Brain className="w-3 h-3 text-white/30" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-heading">AI Strategy</span>
            </div>
            <p className={`font-heading font-black text-sm tracking-wide ${sm.color}`}>{strategy}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-widest text-white/25 font-heading">{scanner.symbol}</p>
        </div>
      </div>

      {/* ── Trade Quality Score ────────────────────────────────────────── */}
      <div className="rounded-2xl px-4 py-4 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/30 font-heading mb-1">Signal Score</p>
          <div className="flex items-end gap-1">
            <span className={`font-heading font-black text-4xl ${scoreColor}`}>{score}</span>
            <span className="font-heading text-sm text-white/30 mb-1">/100</span>
          </div>
          <div className="w-40 h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
            <motion.div
              className={`h-full rounded-full ${score >= 85 ? "bg-green-500" : score >= 70 ? "bg-amber-500" : score >= 60 ? "bg-orange-500" : "bg-white/15"}`}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`px-2 py-1 rounded-lg font-heading font-black text-[10px] tracking-widest ${
            direction === "BUY"
              ? "bg-green-500/20 text-green-400 border border-green-500/40"
              : "bg-red-500/20 text-red-400 border border-red-500/40"
          }`}>
            {direction === "BUY" ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
            {direction}
          </div>
          <div className={`px-2 py-0.5 rounded-lg font-heading font-bold text-[9px] ${
            riskLevel === "Low" ? "bg-green-500/10 text-green-400"
            : riskLevel === "Medium" ? "bg-amber-500/10 text-amber-400"
            : "bg-red-500/10 text-red-400"
          }`}>
            {riskLevel} Risk
          </div>
        </div>
      </div>

      {/* ── Reason (why no trade yet) ─────────────────────────────────── */}
      {scanner.reason && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <Activity className="w-4 h-4 text-white/30 shrink-0" />
          <p className="text-[11px] font-heading font-bold text-white/40">{scanner.reason}</p>
        </div>
      )}

      {/* ── Live Indicators Grid (real MT5 values) ─────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-white/5 rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-3 py-2.5">
          <Metric label="Trend" value={trend} color={trendColor} small />
        </div>
        <div className="px-3 py-2.5">
          <Metric label="Bid" value={ind.bid} small />
        </div>
        <div className="px-3 py-2.5">
          <Metric label="Ask" value={ind.ask} small />
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-white/5 rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-2 py-2.5">
          <Metric label="ADX" value={ind.adx_14?.toFixed(1)} color={adxOk ? "text-green-400" : "text-red-400"} small />
        </div>
        <div className="px-2 py-2.5">
          <Metric label="RSI" value={ind.rsi_14?.toFixed(1)} small />
        </div>
        <div className="px-2 py-2.5">
          <Metric label="ATR" value={ind.atr_14?.toFixed(3)} color={atrOk ? "text-white" : "text-orange-400"} small />
        </div>
        <div className="px-2 py-2.5">
          <Metric label="Spread" value={ind.spread_pips != null ? `${ind.spread_pips}p` : "--"} small />
        </div>
      </div>

      {/* ── Live Conditions ───────────────────────────────────────────── */}
      {scanner.conditions?.length > 0 && (
        <div className="px-4 py-3 rounded-xl space-y-1"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[9px] uppercase tracking-widest text-white/25 font-heading mb-2">Live Conditions</p>
          {scanner.conditions.map((label, i) => {
            const ok = !label.includes("✗");
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? "bg-green-400" : "bg-red-400"}`} />
                <span className={`text-[10px] font-heading ${ok ? "text-white/70" : "text-red-400/80"}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SL/TP (derived from real ATR) ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <span className="text-[8px] uppercase tracking-widest text-red-400/60 font-heading">Smart SL (ATR×1.5)</span>
          <span className="font-heading font-bold text-sm text-red-400">{slDistance}</span>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
          style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
          <span className="text-[8px] uppercase tracking-widest text-green-400/60 font-heading">Smart TP (1:2 RR)</span>
          <span className="font-heading font-bold text-sm text-green-400">{tpDistance}</span>
        </div>
      </div>
    </div>
  );
}