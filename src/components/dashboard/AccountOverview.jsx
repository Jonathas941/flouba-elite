import React from "react";
import GlassCard from "@/components/GlassCard";
import { WifiOff } from "lucide-react";

const TILES = [
  { label: "Balance",      key: "balance",       fmt: (v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-white" },
  { label: "Equity",       key: "equity",        fmt: (v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-sky-300" },
  { label: "Margin",       key: "margin",        fmt: (v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-amber-300" },
  { label: "Free Margin",  key: "free_margin",   fmt: (v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-white" },
  { label: "Today P&L",   key: "profit_today",   fmt: (v) => `${v >= 0 ? "+" : ""}$${Number(v).toFixed(2)}`,                        color: (v) => v >= 0 ? "text-green-400" : "text-red-400" },
  { label: "Daily DD",    key: "daily_drawdown", fmt: (v) => `-${Number(v).toFixed(1)}%`,                                           color: "text-red-400" },
  { label: "Win Rate",    key: "win_rate",       fmt: (v) => `${v}%`,                                                               color: "text-green-400" },
  { label: "Total Trades",key: "total_trades",   fmt: (v) => v,                                                                     color: "text-purple-300" },
];

export default function AccountOverview({ settings, connected }) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Account Overview</h3>
        {!connected && (
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Not Connected</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2">
        {TILES.map((tile, i) => {
          const raw = settings?.[tile.key];
          const hasValue = connected && raw !== undefined && raw !== null && raw !== "";
          const displayColor = typeof tile.color === "function" ? tile.color(raw) : tile.color;
          return (
            <div
              key={tile.label}
              className={`p-4 ${i % 2 === 0 ? "border-r border-white/5" : ""} ${i < 6 ? "border-b border-white/5" : ""}`}
            >
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{tile.label}</p>
              <p className={`font-heading text-base font-bold mt-1 ${hasValue ? displayColor : "text-muted-foreground/40"}`}>
                {hasValue ? tile.fmt(raw) : "--"}
              </p>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}