import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock, X } from "lucide-react";
import { mt5Api } from "@/lib/mt5Api";
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();

  // Normalize field names from MT5 API (may differ from local entity field names)
  const pair      = trade.symbol || trade.pair || "--";
  const direction = trade.type === 0 || trade.type === "buy" || trade.direction === "Buy" ? "Buy" : "Sell";
  const isBuy     = direction === "Buy";
  const profit    = trade.profit ?? trade.unrealized_pnl ?? 0;
  const isProfit  = profit >= 0;
  const lot       = trade.volume ?? trade.lot ?? "--";
  const entry     = trade.openPrice ?? trade.open_price ?? trade.entry_price;
  const current   = trade.currentPrice ?? trade.current_price;
  const spread    = trade.spread;
  const openTime  = trade.openTime ?? trade.open_time ?? trade.opened_at;
  const ticket    = trade.ticket ?? trade.id;

  const handleClose = async () => {
    try {
      const res = await mt5Api.close(ticket);
      if (res?.ok) {
        toast({ title: "Position Closed", description: `${pair} closed successfully.` });
        onClose?.();
      } else {
        toast({ title: "Close Failed", description: res?.data?.message || "Could not close position.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

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
            <span className="font-heading font-bold text-white text-sm">{pair}</span>
            <span className={`ml-2 text-[10px] font-bold uppercase tracking-widest ${isBuy ? "text-green-400" : "text-red-400"}`}>{direction}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`font-heading font-bold text-sm ${isProfit ? "text-green-400" : "text-red-400"}`}>
            {isProfit ? "+" : ""}{Number(profit).toFixed(2)}
          </div>
          {ticket && (
            <button onClick={handleClose}
              className="w-6 h-6 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <X className="w-3 h-3 text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-4 divide-x divide-white/5 px-0">
        {[
          { label: "LOT",     value: typeof lot === "number" ? lot.toFixed(2) : lot },
          { label: "ENTRY",   value: entry != null ? Number(entry).toFixed(5) : "--" },
          { label: "CURRENT", value: current != null ? Number(current).toFixed(5) : "--" },
          { label: "SPREAD",  value: spread != null ? String(spread) : "--" },
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
          <span className="text-[10px] font-heading">{formatDuration(openTime)}</span>
        </div>
        {ticket && (
          <span className="text-[9px] font-heading text-white/20">#{ticket}</span>
        )}
      </div>
    </motion.div>
  );
}