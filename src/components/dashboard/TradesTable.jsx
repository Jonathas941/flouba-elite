import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, WifiOff } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { format } from "date-fns";

const fmtPrice = (pair, v) => {
  if (v === undefined || v === null) return "--";
  if (pair === "XAUUSD" || pair === "NAS100" || pair === "US30") return Number(v).toFixed(2);
  if (pair === "USDJPY") return Number(v).toFixed(3);
  return Number(v).toFixed(5);
};

export default function TradesTable({ trades, connected }) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Recent Trades</h3>
      </div>

      {!connected ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
          <WifiOff className="w-7 h-7 text-muted-foreground/40" />
          <p className="font-heading text-sm text-muted-foreground uppercase tracking-widest">No active trades</p>
          <p className="text-xs text-muted-foreground/60">Trade history will appear after connecting to MT5</p>
        </div>
      ) : trades.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">No active trades</p>
      ) : (
        <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <table className="w-full text-xs min-w-[580px]">
            <thead>
              <tr className="border-b border-white/5">
                {["Pair", "Type", "Entry", "SL", "TP", "Profit", "Status", "Time"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => {
                const buy = t.direction === "Buy";
                const profit = t.profit ?? null;
                const win = profit !== null && profit >= 0;
                return (
                  <motion.tr
                    key={t.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-3 py-2.5 font-heading font-bold text-white">{t.pair || "--"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`flex items-center gap-1 font-semibold ${buy ? "text-green-400" : "text-red-400"}`}>
                        {buy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {t.direction || "--"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-white/80">{fmtPrice(t.pair, t.entry)}</td>
                    <td className="px-3 py-2.5 text-red-400">{fmtPrice(t.pair, t.sl)}</td>
                    <td className="px-3 py-2.5 text-green-400">{fmtPrice(t.pair, t.tp)}</td>
                    <td className="px-3 py-2.5">
                      {profit !== null
                        ? <span className={`font-heading font-bold ${win ? "text-green-400" : "text-red-400"}`}>{win ? "+" : ""}${profit.toFixed(2)}</span>
                        : <span className="text-muted-foreground/40">--</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${t.status === "Open" ? "bg-green-500/15 text-green-400" : "bg-white/5 text-muted-foreground"}`}>
                        {t.status || "--"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {t.created_date ? format(new Date(t.created_date), "HH:mm MM/dd") : "--"}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}