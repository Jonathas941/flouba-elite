import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { mt5Api } from "@/lib/mt5Api";
import { useToast } from "@/components/ui/use-toast";

function normPos(p) {
  return {
    ticket: p.ticket ?? p.id,
    pair: p.symbol || p.pair || "--",
    direction: p.type === 0 || p.type === "buy" ? "Buy" : "Sell",
    lot: p.volume ?? p.lot ?? "--",
    entry: p.openPrice ?? p.open_price ?? p.entry_price ?? null,
    current: p.currentPrice ?? p.current_price ?? null,
    sl: p.sl ?? p.stop_loss ?? p.stopLoss ?? null,
    tp: p.tp ?? p.take_profit ?? p.takeProfit ?? null,
    profit: p.profit ?? p.unrealized_pnl ?? 0,
    openedAt: p.openTime ?? p.open_time ?? p.opened_at ?? null,
  };
}

function SlBadge({ pos, breakevenOffset = 0.1 }) {
  const { sl, entry, direction } = pos;
  if (sl == null || entry == null) return null;
  const isBuy = direction === "Buy";
  const offset = Math.abs(breakevenOffset);

  // Break-even: SL is within offset of entry price
  const distFromEntry = Math.abs(sl - entry);
  const isBreakeven = distFromEntry <= offset;

  // Trailing: SL is beyond break-even in the profit direction
  const isTrailing = isBuy ? sl > entry + offset : sl < entry - offset;

  let label = "Initial SL";
  let color = "#8c8c8c";
  if (isTrailing) { label = "Trailing"; color = "#00FF41"; }
  else if (isBreakeven) { label = "Break-even"; color = "#FFCC42"; }

  return (
    <span className="px-1 py-0.5 rounded text-[8px] font-heading font-bold tracking-wide whitespace-nowrap"
      style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}>
      {label}
    </span>
  );
}

export default function PositionsTable({ positions = [], onClose }) {
  const { toast } = useToast();
  const [closing, setClosing] = useState(null);

  const handleClose = async (ticket) => {
    setClosing(ticket);
    try {
      const res = await mt5Api.close(ticket);
      if (res?.ok && res?.data?.success === true) {
        toast({ title: "Position Closed", description: `Ticket #${ticket} closed.` });
        onClose?.();
      } else {
        const msg = res?.error || res?.data?.message || res?.data?.detail || "Close failed";
        toast({ title: "Close Failed", description: msg, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setClosing(null);
  };

  if (!positions.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading">Open Positions</p>
      {positions.map((raw, i) => {
        const p = normPos(raw);
        const isWin = p.profit >= 0;
        const isBuy = p.direction === "Buy";
        return (
          <motion.div
            key={p.ticket ?? i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl px-3 py-2.5 flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* Direction icon */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isBuy ? "bg-green-500/15" : "bg-red-500/15"}`}>
              {isBuy
                ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-bold text-xs text-white">{p.pair}</span>
                <span className={`text-[9px] font-bold font-heading ${isBuy ? "text-green-400" : "text-red-400"}`}>
                  {p.direction.toUpperCase()}
                </span>
                <span className="text-[9px] text-white/30">#{p.ticket}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-white/40">{p.lot} lot</span>
                {p.entry != null && (
                  <span className="text-[9px] text-white/30">@ {p.entry}</span>
                )}
                {p.current != null && (
                  <span className="text-[9px] text-white/30">→ {p.current}</span>
                )}
              </div>
              {(p.sl != null || p.tp != null) && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {p.sl != null && (
                    <span className="text-[9px] text-red-400/60">SL: <span className="text-red-400/90 font-semibold">{Number(p.sl).toFixed(2)}</span></span>
                  )}
                  {p.tp != null && (
                    <span className="text-[9px] text-green-400/60">TP: <span className="text-green-400/90 font-semibold">{Number(p.tp).toFixed(2)}</span></span>
                  )}
                  <SlBadge pos={p} breakevenOffset={0.1} />
                </div>
              )}
            </div>

            {/* P&L */}
            <span className={`font-heading font-bold text-sm shrink-0 ${isWin ? "text-green-400" : "text-red-400"}`}>
              {isWin ? "+" : ""}{Number(p.profit).toFixed(2)}
            </span>

            {/* Close button */}
            <button
              onClick={() => handleClose(p.ticket)}
              disabled={closing === p.ticket}
              className="w-7 h-7 rounded-full flex items-center justify-center border border-red-500/30 bg-red-500/10 shrink-0 disabled:opacity-40 transition-opacity"
            >
              {closing === p.ticket
                ? <div className="w-3 h-3 border border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                : <X className="w-3 h-3 text-red-400" />}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}