import React, { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const POINTS = [
  "Market Volatility: Scalping can lose significant capital quickly during sharp, high-volatility moves against open positions.",
  "Lack of Human Judgment: The bot follows a fixed script and cannot pause for unexpected news, data releases, or technical issues.",
  "Compounding Losses: Aggressive scaling strategies can compound losses rapidly and risk the entire account balance.",
  "Security Risks: API access to your trading account carries inherent third-party security risk.",
  "No Guaranteed Returns: High potential returns always carry high risk — there is no risk-free automated trading.",
];

export default function RiskDisclaimer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[10px] uppercase tracking-widest font-heading font-bold text-amber-400">
            Risk Disclosure
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-amber-400/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <ul className="px-4 pb-4 space-y-2">
              {POINTS.map((p) => (
                <li key={p} className="text-[10px] text-white/50 leading-relaxed">
                  {p}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}