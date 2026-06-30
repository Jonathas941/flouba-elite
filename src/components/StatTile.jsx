import React from "react";
import GlassCard from "./GlassCard";

export default function StatTile({ label, value, icon: Icon, accent = "text-white", sub }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-red-500/70" />}
      </div>
      <p className={`mt-2 font-heading text-xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </GlassCard>
  );
}