import React, { useState } from "react";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import { Zap, TrendingUp, TrendingDown, Clock, Target } from "lucide-react";

const SIGNALS = [
  { pair: "XAUUSD", direction: "Buy",  confidence: 87, pattern: "Bullish Engulfing",   entry: 3365.20, sl: 3355.00, tp: 3390.00, risk: "1.5R", time: "09:14", status: "Active" },
  { pair: "US30",   direction: "Buy",  confidence: 83, pattern: "Three White Soldiers", entry: 44150, sl: 43900, tp: 44600, risk: "2.0R", time: "10:02", status: "Active" },
  { pair: "GBPUSD", direction: "Buy",  confidence: 78, pattern: "Morning Star",          entry: 1.27050, sl: 1.26700, tp: 1.27900, risk: "1.8R", time: "11:30", status: "Pending" },
  { pair: "EURUSD", direction: "Sell", confidence: 62, pattern: "Shooting Star",          entry: 1.08540, sl: 1.08750, tp: 1.08100, risk: "1.2R", time: "12:45", status: "Pending" },
  { pair: "NAS100", direction: "Sell", confidence: 55, pattern: "Evening Star",           entry: 20210, sl: 20400, tp: 19900, risk: "1.0R", time: "13:18", status: "Expired" },
];

export default function AISignals() {
  const [filter, setFilter] = useState("All");
  const FILTERS = ["All", "Active", "Pending", "Expired"];
  const filtered = filter === "All" ? SIGNALS : SIGNALS.filter((s) => s.status === filter);

  return (
    <div className="px-4 pt-8 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-black text-white neon-text flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-500" /> AI Signals
          </h1>
          <p className="text-sm text-muted-foreground">Real-time AI-generated trade setups.</p>
        </div>
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
      </header>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold tracking-wide transition-all ${filter === f ? "bg-red-600 text-white neon-red" : "glass text-muted-foreground"}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((s, i) => {
          const buy = s.direction === "Buy";
          const statusColor = s.status === "Active" ? "bg-green-500/15 text-green-400" : s.status === "Pending" ? "bg-amber-500/15 text-amber-400" : "bg-white/5 text-muted-foreground";
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <GlassCard>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${buy ? "bg-green-500/15" : "bg-red-500/15"}`}>
                      {buy ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
                    </div>
                    <div>
                      <p className="font-heading font-bold text-white">{s.pair}</p>
                      <p className={`text-xs font-semibold ${buy ? "text-green-400" : "text-red-400"}`}>{s.direction}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${statusColor}`}>{s.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[["Entry", s.entry], ["Stop Loss", s.sl], ["Take Profit", s.tp]].map(([l, v]) => (
                    <div key={l}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</p>
                      <p className="text-sm font-semibold text-white">{typeof v === "number" && v > 100 ? v.toFixed(2) : v?.toFixed?.(5) ?? v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">{s.pattern}</p>
                    <span className="text-xs text-red-400 font-semibold">{s.risk}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{s.time}</div>
                    <div className="flex items-center gap-1 text-xs">
                      <Target className="w-3 h-3 text-red-500" />
                      <span className="font-bold text-red-400">{s.confidence}%</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}