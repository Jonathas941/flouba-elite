import React from "react";
import GlassCard from "@/components/GlassCard";
import { Clock } from "lucide-react";

const ENTRY_WINDOWS = [
  { window: "03:00 – 06:00 ET", label: "London Pre-Open" },
  { window: "08:00 – 13:00 ET", label: "NY Session" },
];

export default function TradingHoursCard() {
  return (
    <GlassCard className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-[#00FF41]" />
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider">
          XAUUSD Entry Windows
        </h2>
      </div>
      <div className="space-y-2">
        {ENTRY_WINDOWS.map(({ window, label }) => (
          <div key={window} className="flex items-center justify-between bg-black/30 rounded-lg p-2.5 border border-white/5">
            <span className="text-[11px] text-white/80 font-bold font-mono">{window}</span>
            <span className="text-[9px] text-white/30 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2.5">
        <Clock className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-yellow-400/80">
          Signals received outside these windows are rejected automatically.
        </p>
      </div>
    </GlassCard>
  );
}