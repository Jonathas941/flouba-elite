import React from "react";
import { Switch } from "@/components/ui/switch";

export function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} className="data-[state=checked]:bg-red-600" />
    </div>
  );
}

export function SegmentRow({ label, options, value, onChange }) {
  return (
    <div className="py-3 border-b border-white/5 last:border-0">
      <p className="text-sm font-semibold text-white mb-2">{label}</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`py-2 rounded-xl text-sm font-heading tracking-wide transition-all ${value === o ? "bg-red-600 text-white neon-red" : "bg-white/5 text-muted-foreground"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}