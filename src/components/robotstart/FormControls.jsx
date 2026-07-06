import React from "react";
import { motion } from "framer-motion";

export function Field({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-white/50 font-heading uppercase tracking-wider shrink-0 w-40">{label}</span>
      {children}
    </div>
  );
}

export function NumberInput({ value, onChange, min, step = 1 }) {
  return (
    <input
      type="number"
      value={value}
      min={min ?? 0}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-24 text-right px-2 py-1.5 rounded-lg font-heading font-bold text-xs text-white bg-white/5 border border-white/10 focus:border-[#00FF41]/40 focus:outline-none"
    />
  );
}

export function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1.5 rounded-lg font-heading font-bold text-xs text-white bg-white/5 border border-white/10 focus:border-[#00FF41]/40 focus:outline-none appearance-none text-right"
      style={{ background: "rgba(255,255,255,0.06)", minWidth: 96 }}
    >
      {options.map((o) => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
    </select>
  );
}

export function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full flex items-center transition-colors shrink-0 ${value ? "bg-[#00FF41]" : "bg-white/10"}`}
    >
      <motion.div
        layout
        className="w-5 h-5 rounded-full bg-white shadow mx-0.5"
        animate={{ x: value ? 18 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    </button>
  );
}