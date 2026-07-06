import React from "react";
import { Switch } from "@/components/ui/switch";

const cardStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
};

const rowBorder = "border-b border-white/5 last:border-0";

export function SectionLabel({ children }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-heading mb-2 mt-1">
      {children}
    </p>
  );
}

export function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className={`flex items-center justify-between py-3.5 ${rowBorder}`}>
      <div className="pr-3">
        <p className="text-sm font-heading font-bold text-white tracking-wide">{label}</p>
        {desc && <p className="text-[11px] text-white/40 mt-0.5">{desc}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} className="data-[state=checked]:bg-red-600" />
    </div>
  );
}

export function SegmentRow({ label, desc, options, value, onChange }) {
  return (
    <div className={`py-3.5 ${rowBorder}`}>
      <p className="text-sm font-heading font-bold text-white tracking-wide">{label}</p>
      {desc && <p className="text-[11px] text-white/40 mt-0.5 mb-2">{desc}</p>}
      <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`py-2.5 rounded-xl text-xs font-heading tracking-wide transition-all ${
              value === o
                ? "bg-red-600 text-white"
                : "bg-white/5 text-white/40 hover:bg-white/10"
            }`}
            style={value === o ? { boxShadow: "0 0 14px rgba(239,68,68,0.4)" } : {}}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PairRow({ label, options, value, onChange }) {
  return (
    <div className={`py-3.5 ${rowBorder}`}>
      <p className="text-sm font-heading font-bold text-white tracking-wide mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`py-2.5 rounded-xl text-xs font-heading font-bold tracking-wide transition-all ${
              value === o ? "bg-red-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"
            }`}
            style={value === o ? { boxShadow: "0 0 14px rgba(239,68,68,0.4)" } : {}}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NumberRow({ label, suffix, value, onChange }) {
  return (
    <div className={`py-3.5 ${rowBorder}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-heading font-bold text-white tracking-wide">{label}</p>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-20 bg-white/5 border border-white/10 rounded-lg h-9 px-2 text-right text-sm font-heading font-bold text-white focus:outline-none focus:border-red-500/50"
          />
          {suffix && <span className="text-[11px] text-white/40 font-heading w-8">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

export function SettingsCard({ children, className = "" }) {
  return (
    <div className={`rounded-2xl px-4 ${className}`} style={cardStyle}>
      {children}
    </div>
  );
}