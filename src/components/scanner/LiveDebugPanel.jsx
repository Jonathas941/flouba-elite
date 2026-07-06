import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Zap, Brain } from "lucide-react";

const STRATEGY_COLORS = {
  "Momentum Scalping": "text-green-400",
  "Range Breakout":    "text-sky-400",
  "Volatility Spike":  "text-amber-400",
  "Hybrid Manual":     "text-purple-400",
};

/**
 * Live Debug Panel — shows exactly why the robot did or did not enter a trade.
 * Props:
 *   debugLog: array of { pair, tf, score, direction, decision, reasons[] } — most recent first
 */
export default function LiveDebugPanel({ debugLog = [] }) {
  if (debugLog.length === 0) {
    return (
      <div className="px-4 py-3 rounded-2xl flex items-center gap-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
        <p className="font-heading text-[10px] uppercase tracking-widest text-white/25">Waiting for first scan tick…</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading px-1">Live Debug Log</p>
      {debugLog.slice(0, 6).map((entry, i) => {
        const entered = entry.decision === "ENTERED";
        const pending = entry.decision === "PENDING";
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`px-3 py-3 rounded-2xl border ${
              entered ? "bg-green-500/8 border-green-500/25"
              : pending ? "bg-amber-500/8 border-amber-500/20"
              : "bg-white/3 border-white/6"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {entered
                  ? <Zap className="w-3.5 h-3.5 text-green-400" />
                  : pending
                  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  : <XCircle className="w-3.5 h-3.5 text-red-400/60" />}
                <span className="font-heading font-black text-xs text-white">{entry.pair}</span>
                <span className="text-[9px] text-white/30">{entry.tf}</span>
                {entry.strategy && (
                  <span className={`text-[9px] font-heading font-bold ${STRATEGY_COLORS[entry.strategy] || "text-white/30"}`}>· {entry.strategy}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-heading font-black text-xs ${
                  entry.direction === "BUY" ? "text-green-400" : "text-red-400"
                }`}>{entry.direction}</span>
                <span className={`font-heading font-bold text-[10px] px-2 py-0.5 rounded-lg ${
                  entered ? "bg-green-500/20 text-green-400"
                  : pending ? "bg-amber-500/20 text-amber-400"
                  : "bg-white/8 text-white/40"
                }`}>{entered ? "TRADE SENT" : pending ? "PENDING" : "BLOCKED"}</span>
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[9px] text-white/30 font-heading">Score</span>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${entry.score >= 80 ? "bg-green-500" : entry.score >= 65 ? "bg-amber-500" : "bg-red-500/60"}`}
                  style={{ width: `${entry.score}%` }}
                />
              </div>
              <span className={`font-heading font-bold text-xs ${entry.score >= 80 ? "text-green-400" : entry.score >= 65 ? "text-amber-400" : "text-white/40"}`}>
                {entry.score}/100
              </span>
            </div>

            {/* Reasons */}
            <div className="space-y-0.5">
              {(entry.reasons || []).map((r, ri) => (
                <div key={ri} className="flex items-center gap-1.5">
                  {r.ok
                    ? <CheckCircle className="w-2.5 h-2.5 text-green-400 shrink-0" />
                    : <XCircle    className="w-2.5 h-2.5 text-red-400/70 shrink-0" />}
                  <span className={`text-[9px] font-heading ${r.ok ? "text-white/40" : "text-red-300/80"}`}>{r.label}</span>
                </div>
              ))}
            </div>

            {entry.time && (
              <p className="text-[8px] text-white/15 mt-1.5 font-heading">{entry.time}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}