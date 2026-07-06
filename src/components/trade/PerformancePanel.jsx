import React from "react";

const METRICS = [
  { label: "Win Rate",      key: "win_rate",       fmt: (v) => v != null ? `${v.toFixed(1)}%` : "--" },
  { label: "Profit Factor", key: "profit_factor",  fmt: (v) => v != null ? v.toFixed(2) : "--" },
  { label: "Today Profit",  key: "today_profit",   fmt: (v) => v != null ? `$${v.toFixed(2)}` : "--", color: (v) => v >= 0 ? "text-green-400" : "text-red-400" },
  { label: "Today Loss",    key: "today_loss",      fmt: (v) => v != null ? `$${Math.abs(v).toFixed(2)}` : "--", color: () => "text-red-400" },
  { label: "Open Trades",   key: "open_trades",    fmt: (v) => v ?? "--" },
  { label: "Closed Trades", key: "closed_trades",  fmt: (v) => v ?? "--" },
  { label: "Avg Win",       key: "avg_win",        fmt: (v) => v != null ? `$${v.toFixed(2)}` : "--", color: () => "text-green-400" },
  { label: "Avg Loss",      key: "avg_loss",       fmt: (v) => v != null ? `$${Math.abs(v).toFixed(2)}` : "--", color: () => "text-red-400" },
  { label: "Largest Win",   key: "largest_win",    fmt: (v) => v != null ? `$${v.toFixed(2)}` : "--", color: () => "text-green-400" },
  { label: "Largest Loss",  key: "largest_loss",   fmt: (v) => v != null ? `$${Math.abs(v).toFixed(2)}` : "--", color: () => "text-red-400" },
];

export default function PerformancePanel({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {METRICS.map(({ label, key, fmt, color }) => {
        const val = stats?.[key];
        const displayVal = fmt(val);
        const colorClass = color ? (val != null ? color(val) : "text-white/25") : (val != null ? "text-white" : "text-white/25");
        return (
          <div
            key={key}
            className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-[9px] uppercase tracking-widest text-white/30">{label}</span>
            <span className={`font-heading font-bold text-sm ${colorClass}`}>{displayVal}</span>
          </div>
        );
      })}
    </div>
  );
}