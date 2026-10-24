import React from "react";
import GlassCard from "@/components/GlassCard";
import { Shield, Layers, TrendingUp, Crosshair } from "lucide-react";

export default function TradeManagerCard() {
  const phases = [
    { icon: Crosshair, label: "TP1 — 1R", desc: "Close 40% + move SL to break-even", color: "#00FF41" },
    { icon: Layers, label: "TP2 — 2R", desc: "Close 30% + lock TP1 as new floor", color: "#FFCC42" },
    { icon: TrendingUp, label: "Trail", desc: "ATR(14, M5) × 1.5 trailing on the rest", color: "#3B82F6" },
    { icon: Shield, label: "TP3", desc: "Final target = signal TP (full exit)", color: "#A855F7" },
  ];

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-[#00FF41]" />
        <p className="text-sm font-heading font-bold text-white">Trade Manager</p>
        <span className="ml-auto text-[8px] font-heading tracking-widest text-white/30 px-1.5 py-0.5 rounded bg-white/5">
          EA ON VPS · READ-ONLY
        </span>
      </div>
      <p className="text-[10px] text-white/40 leading-relaxed mb-3">
        Partial closes, break-even, and trailing stop run inside the FloubaTradeManager EA on your VPS — not in the dashboard.
      </p>
      <div className="space-y-2">
        {phases.map((p, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/3 border border-white/5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${p.color}12`, border: `1px solid ${p.color}30` }}>
              <p.icon className="w-3.5 h-3.5" style={{ color: p.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-heading font-bold text-white/80">{p.label}</p>
              <p className="text-[9px] text-white/40 leading-tight">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}