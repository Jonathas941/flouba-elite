import React from "react";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import {
  Layers, Boxes, CandlestickChart, GitBranch, TrendingUp, Gauge, ShieldCheck, Newspaper, ChevronRight,
} from "lucide-react";

const BLOCKS = [
  { icon: Layers, title: "Market Structure", desc: "Identifies HH/HL & LH/LL to read trend direction and break of structure." },
  { icon: Boxes, title: "Order Block / Supply & Demand", desc: "Maps institutional zones where price is likely to react." },
  { icon: CandlestickChart, title: "Candlestick Confirmation", desc: "Validates entries with 10 high-probability candle patterns." },
  { icon: GitBranch, title: "Fibonacci Filter", desc: "Confirms retracements within optimal 0.5–0.79 trade entry zone." },
  { icon: TrendingUp, title: "Trendline Confirmation", desc: "Checks dynamic trendline breaks and retests before execution." },
  { icon: Gauge, title: "Psychological Levels", desc: "Reacts to round numbers and key institutional price points." },
  { icon: ShieldCheck, title: "Risk Management", desc: "Enforces position sizing, SL/TP logic and daily limits." },
  { icon: Newspaper, title: "News Filter", desc: "Pauses trading around high-impact economic events." },
];

const PATTERNS = {
  Bullish: ["Bullish Engulfing", "Hammer", "Morning Star", "Three White Soldiers", "Tweezer Bottom", "Piercing Line"],
  Bearish: ["Evening Star", "Shooting Star", "Hanging Man", "Bearish Engulfing"],
};

export default function Strategy() {
  return (
    <div className="px-4 pt-8 space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-black text-white neon-text">Strategy Logic</h1>
        <p className="text-sm text-muted-foreground">The multi-layer confluence engine behind Flouba Elite.</p>
      </header>

      <div className="space-y-3">
        {BLOCKS.map((b, i) => (
          <motion.div key={b.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <GlassCard className="flex items-start gap-3">
              <div className="w-11 h-11 shrink-0 rounded-xl bg-red-500/15 flex items-center justify-center">
                <b.icon className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm uppercase tracking-wide text-white">{b.title}</h3>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{b.desc}</p>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard>
        <h3 className="font-heading text-sm uppercase tracking-widest text-white mb-3">Candlestick Patterns</h3>
        <p className="text-xs text-green-400 uppercase tracking-widest mb-2">Bullish</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {PATTERNS.Bullish.map((p) => (
            <span key={p} className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-xs">{p}</span>
          ))}
        </div>
        <p className="text-xs text-red-400 uppercase tracking-widest mb-2">Bearish</p>
        <div className="flex flex-wrap gap-2">
          {PATTERNS.Bearish.map((p) => (
            <span key={p} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{p}</span>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}