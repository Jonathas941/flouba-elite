import React from "react";
import GlassCard from "@/components/GlassCard";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";

export default function RecentTrades({ trades }) {
  return (
    <GlassCard>
      <h3 className="font-heading text-sm uppercase tracking-widest text-white mb-3">Recent Activity</h3>
      {(!trades || trades.length === 0) ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No trades yet. Start the robot to begin.</p>
      ) : (
        <div className="space-y-2">
          {trades.map((t) => {
            const buy = t.direction === "Buy";
            const win = (t.profit || 0) >= 0;
            return (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${buy ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                    {buy ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{t.pair} · {t.direction}</p>
                    <p className="text-xs text-muted-foreground">{t.pattern || "—"} · {t.lot || 0} lot</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-heading text-sm ${win ? "text-green-400" : "text-red-400"}`}>
                    {win ? "+" : ""}{(t.profit || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t.created_date ? format(new Date(t.created_date), "HH:mm") : ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}