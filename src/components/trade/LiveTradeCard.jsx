import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";

function formatDuration(openedAt) {
  if (!openedAt) return "--";
  const diff = Math.floor((Date.now() - new Date(openedAt).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LiveTradeCard({ trade, onClose }) {
  const isBuy = trade.direction === "Buy";
  const profit = trade.profit ?? 0;
  const isProfit = profit >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isBuy ? "bg-green-500/20 border border-green-500/40" : "bg-red-500/20 border border-red-500/40"}`}>
            {isBuy ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          </div>
          <div>
            <span className="font-heading font-bold text-white text-sm">{trade.pair}</span>
            <span className={`ml-2 text-[10px] font-bold uppercase tracking-widest ${isBuy ? "text-green-400" : "text-red-400"}`}>{trade.direction}</span>
          </div>
        </div>
        <div className={`font-heading font-bold text-sm ${isProfit ? "text-green-400" : "text-red-400"}`}>
          {isProfit ? "+" : ""}{profit.toFixed(2)}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-4 divide-x divide-white/5 px-0">
        {[
          { label: "LOT",     value: trade.lot?.toFixed(2) ?? "--" },
          { label: "ENTRY",   value: trade.entry_price?.toFixed(5) ?? "--" },
          { label: "CURRENT", value: trade.current_price?.toFixed(5) ?? "--" },
          { label: "SPREAD",  value: trade.spread != null ? `${trade.spread}` : "--" },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center py-2 px-1">
            <span className="text-[8px] uppercase tracking-widest text-white/30">{label}</span>
            <span className="font-heading text-[11px] font-bold text-white/80 mt-0.5">{value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
        <div className="flex items-center gap-1 text-white/30">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-heading">{formatDuration(trade.opened_at)}</span>
        </div>
        <span className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded-full ${
          trade.status === "Open" ? "text-green-400 bg-green-500/10 border border-green-500/20" : "text-white/30 bg-white/5"
        }`}>
          {trade.status?.toUpperCase() ?? "OPEN"}
        </span>
      </div>
    </motion.div>
  );
}