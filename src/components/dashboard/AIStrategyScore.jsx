import React from "react";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";

const STRATEGIES = [
  { name: "Market Structure",        score: 82 },
  { name: "Order Block",             score: 71 },
  { name: "Supply & Demand",         score: 68 },
  { name: "Liquidity Sweep",         score: 75 },
  { name: "Candlestick Confirmation",score: 89 },
  { name: "Fibonacci",               score: 63 },
  { name: "Trendline",               score: 77 },
  { name: "Psychological Level",     score: 85 },
  { name: "Volume",                  score: 72 },
  { name: "News Filter",             score: 90 },
];

const overall = Math.round(STRATEGIES.reduce((a, s) => a + s.score, 0) / STRATEGIES.length);
const CIRC = 2 * Math.PI * 44;

const scoreColor = (s) => s >= 80 ? "#4ade80" : s >= 60 ? "#f59e0b" : "#ef4444";

export default function AIStrategyScore() {
  return (
    <GlassCard>
      <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">AI Strategy Score</h3>

      {/* Overall circle */}
      <div className="flex items-center gap-5 mb-5 pb-4 border-b border-white/5">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(239,68,68,0.1)" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="44" fill="none" stroke="#ef4444" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: CIRC * (1 - overall / 100) }}
              transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-heading text-lg font-black text-white">{overall}%</span>
          </div>
        </div>
        <div>
          <p className="font-heading text-base font-bold text-white">Overall Confidence</p>
          <p className="text-xs text-muted-foreground mt-1">Based on 10-factor analysis</p>
          <p className={`text-sm font-semibold mt-2 ${overall >= 75 ? "text-green-400" : overall >= 60 ? "text-amber-400" : "text-red-400"}`}>
            {overall >= 75 ? "Strong Signal" : overall >= 60 ? "Moderate Signal" : "Weak Signal"}
          </p>
        </div>
      </div>

      {/* Individual bars */}
      <div className="space-y-3">
        {STRATEGIES.map((s, i) => (
          <div key={s.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{s.name}</span>
              <span className="text-xs font-bold font-heading" style={{ color: scoreColor(s.score) }}>{s.score}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: scoreColor(s.score) }}
                initial={{ width: 0 }}
                animate={{ width: `${s.score}%` }}
                transition={{ duration: 1, delay: 0.1 + i * 0.06, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}