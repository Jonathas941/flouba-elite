import React from "react";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";

const tiles = (s) => [
  { label: "Balance",      value: `$${(s.balance || 10000).toLocaleString("en-US", {minimumFractionDigits:2})}`,  color: "text-white" },
  { label: "Equity",       value: `$${(s.equity || 10234.5).toLocaleString("en-US", {minimumFractionDigits:2})}`, color: "text-sky-300" },
  { label: "Margin",       value: `$${(s.margin || 1250).toLocaleString("en-US", {minimumFractionDigits:2})}`,    color: "text-amber-300" },
  { label: "Free Margin",  value: `$${(s.free_margin || 8984.5).toLocaleString("en-US", {minimumFractionDigits:2})}`, color: "text-white" },
  { label: "Today P&L",    value: `${(s.profit_today || 234.5) >= 0 ? "+" : ""}$${(s.profit_today || 234.5).toFixed(2)}`, color: (s.profit_today || 234.5) >= 0 ? "text-green-400" : "text-red-400" },
  { label: "Daily DD",     value: `-${(s.daily_drawdown || 2.1).toFixed(1)}%`, color: "text-red-400" },
  { label: "Win Rate",     value: `${s.win_rate || 72}%`, color: "text-green-400" },
  { label: "Total Trades", value: s.total_trades || 147, color: "text-purple-300" },
];

export default function AccountOverview({ settings }) {
  const data = tiles(settings || {});
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Account Overview</h3>
      </div>
      <div className="grid grid-cols-2">
        {data.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-4 ${i % 2 === 0 ? "border-r border-white/5" : ""} ${i < 6 ? "border-b border-white/5" : ""}`}
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.label}</p>
            <p className={`font-heading text-base font-bold mt-1 ${t.color}`}>{t.value}</p>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}