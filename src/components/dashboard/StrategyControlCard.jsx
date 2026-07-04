import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const STRATEGY_TAGS = ["Momentum Scalping", "Trend Continuation", "Asian Session", "London/NY Overlap", "Conservative Mode"];

export default function StrategyControlCard() {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-4 relative overflow-hidden"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,206,77,0.12)", border: "1px solid rgba(255,206,77,0.4)" }}
        >
          {/* chess knight glyph */}
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <path
              d="M5 20h14M7 20v-2c0-1 1-2 2-2h6c1 0 2 1 2 2v2M9 14c0-3 2-5 5-5l-1-2 3 1 1.5 3C18 13 17 16 14 16H9z"
              stroke="#ffce4d" strokeWidth="1.4" strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-sm text-white tracking-wider">STRATEGY CONTROL</h3>
          <p className="text-[10px] text-white/50 leading-tight">AI-Powered Strategies · Built, Backtested, Deployed</p>
        </div>
        <MiniSpark />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {STRATEGY_TAGS.map((t) => (
          <span key={t} className="px-2 py-1 rounded-full text-[9px] font-heading tracking-wider bg-cyan-500/8 text-cyan-200/80 border border-cyan-500/25">
            {t}
          </span>
        ))}
      </div>

      <button
        onClick={() => navigate("/strategy")}
        className="w-full mt-3 h-11 rounded-xl flex items-center justify-center gap-1.5 font-heading font-bold tracking-widest text-[11px] active:scale-[0.98] transition-transform"
        style={{ background: "linear-gradient(90deg, rgba(0,229,255,0.18), rgba(0,160,255,0.12))", border: "1px solid rgba(0,229,255,0.45)", color: "#5fe8ff", boxShadow: "0 0 14px rgba(0,229,255,0.25)" }}
      >
        MANAGE STRATEGIES
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

function MiniSpark() {
  const pts = [4, 7, 5, 9, 8, 12, 10, 14, 11, 16];
  const max = Math.max(...pts), min = Math.min(...pts);
  const w = 64, h = 28;
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${h - ((p - min) / (max - min)) * h}`).join(" ");
  return (
    <div className="shrink-0">
      <svg width={w} height={h} className="overflow-visible">
        <polyline points={d} fill="none" stroke="#5fe8ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(0,229,255,0.7))" }} />
      </svg>
    </div>
  );
}