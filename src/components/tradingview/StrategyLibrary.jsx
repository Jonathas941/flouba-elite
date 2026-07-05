import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, X } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { STRATEGY_LIBRARY } from "@/lib/tradingviewStrategies";

function Toggle({ active, onClick }) {
  return (
    <button onClick={onClick} className={`w-11 h-6 rounded-full flex items-center transition-colors shrink-0 ${active ? "bg-cyan-500 neon-cyan" : "bg-white/10"}`}>
      <motion.div layout className="w-5 h-5 rounded-full bg-white shadow mx-0.5" animate={{ x: active ? 18 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
    </button>
  );
}

function StrategyCard({ s, active, conflict, onToggle }) {
  const [showRules, setShowRules] = useState(false);
  return (
    <GlassCard className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-heading font-bold text-white leading-tight">{s.name}</p>
          <p className="text-[10px] text-white/40 font-body mt-0.5">{s.symbol} · {s.timeframe} · {s.rr}</p>
        </div>
        <Toggle active={active} onClick={() => onToggle(s)} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[8px] text-white/30 uppercase">Entry</p>
          <p className="text-[10px] text-cyan-300 font-heading">{s.entry}</p>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[8px] text-white/30 uppercase">Symbol</p>
          <p className="text-[10px] text-amber-300 font-heading">{s.symbol}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-heading font-bold uppercase tracking-wider ${active ? "text-green-400" : "text-white/30"}`}>
          {active ? "● Active" : "○ Inactive"}
        </span>
        <button onClick={() => setShowRules(true)} className="flex items-center gap-1 text-[9px] text-cyan-400 font-heading font-bold uppercase tracking-wider hover:text-cyan-300">
          <Eye className="w-3 h-3" /> View Rules
        </button>
      </div>
      {conflict && !active && (
        <p className="text-[8px] text-amber-300/60">Another {s.symbol} strategy is active — deactivate it first.</p>
      )}
      <AnimatePresence>
        {showRules && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.8)" }} onClick={() => setShowRules(false)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} className="w-full max-w-md glass rounded-2xl p-5 m-3 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="font-heading font-bold text-sm text-white">{s.name}</p>
                <button onClick={() => setShowRules(false)}><X className="w-4 h-4 text-white/40" /></button>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed font-body">{s.rules}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

export default function StrategyLibrary({ activeKeys, onToggle }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-black text-sm text-white uppercase tracking-widest">Strategy Library</h2>
        <p className="text-[9px] text-white/30">One active per symbol</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STRATEGY_LIBRARY.map(s => (
          <StrategyCard key={s.key} s={s} active={activeKeys.has(s.key)} conflict={activeKeys.has(s.symbol)} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}