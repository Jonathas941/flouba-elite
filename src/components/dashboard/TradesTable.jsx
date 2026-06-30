import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { format } from "date-fns";

// Compute demo entry/SL/TP based on pair and direction
const enrich = (trade) => {
  const map = {
    XAUUSD: { pip: 1.0,   buy: { entry: 3358.20, sl: 3345.00, tp: 3390.00 }, sell: { entry: 3371.10, sl: 3382.00, tp: 3340.00 } },
    EURUSD: { pip: 0.0001, buy: { entry: 1.08190, sl: 1.07950, tp: 1.08650 }, sell: { entry: 1.08540, sl: 1.08750, tp: 1.08100 } },
    GBPUSD: { pip: 0.0001, buy: { entry: 1.27050, sl: 1.26700, tp: 1.27900 }, sell: { entry: 1.27420, sl: 1.27700, tp: 1.26800 } },
    NAS100: { pip: 1.0,   buy: { entry: 20080, sl: 19950, tp: 20350 }, sell: { entry: 20210, sl: 20400, tp: 19900 } },
    US30:   { pip: 1.0,   buy: { entry: 44150, sl: 43900, tp: 44600 }, sell: { entry: 44320, sl: 44550, tp: 43950 } },
  };
  const ref = map[trade.pair];
  const dir = ref?.[trade.direction?.toLowerCase()] || { entry: 0, sl: 0, tp: 0 };
  return { ...trade, ...dir };
};

export default function TradesTable({ trades }) {
  const rich = trades.map(enrich);

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Recent Trades</h3>
      </div>
      {rich.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No trades yet. Start the robot.</p>
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
              {rich.map((t, i) => {
                const buy = t.direction === "Buy";
                const win = (t.profit || 0) >= 0;
                return (
                  <motion.tr
                    key={t.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-3 py-2.5 font-heading font-bold text-white">{t.pair}</td>
                    <td className="px-3 py-2.5">
                      <span className={`flex items-center gap-1 font-semibold ${buy ? "text-green-400" : "text-red-400"}`}>
                        {buy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-white/80">{typeof t.entry === "number" ? t.entry.toFixed(t.pair?.includes("JPY") ? 3 : t.pair?.includes("XAU") || t.pair?.includes("NAS") || t.pair?.includes("US") ? 2 : 5) : "—"}</td>
                    <td className="px-3 py-2.5 text-red-400">{typeof t.sl === "number" ? t.sl.toFixed(t.pair?.includes("JPY") ? 3 : t.pair?.includes("XAU") || t.pair?.includes("NAS") || t.pair?.includes("US") ? 2 : 5) : "—"}</td>
                    <td className="px-3 py-2.5 text-green-400">{typeof t.tp === "number" ? t.tp.toFixed(t.pair?.includes("JPY") ? 3 : t.pair?.includes("XAU") || t.pair?.includes("NAS") || t.pair?.includes("US") ? 2 : 5) : "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`font-heading font-bold ${win ? "text-green-400" : "text-red-400"}`}>
                        {win ? "+" : ""}${(t.profit || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${t.status === "Open" ? "bg-green-500/15 text-green-400" : "bg-white/5 text-muted-foreground"}`}>
                        {t.status || "Closed"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {t.created_date ? format(new Date(t.created_date), "HH:mm MM/dd") : "—"}
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