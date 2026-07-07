import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw, TrendingUp, TrendingDown, Calendar, Clock, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function TradeJournal() {
  const { toast } = useToast();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("All");

  const load = useCallback(async () => {
    try {
      const records = await base44.entities.Trade.filter({ status: "Closed" }, "-closed_at", 200);
      setTrades(records || []);
    } catch {}
    setLoading(false);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("syncTradeHistory", {});
      if (res?.data?.success !== false) {
        toast({ title: "Trades Synced", description: `${res?.data?.synced ?? 0} trades from MT5`, duration: 2500 });
        await load();
      }
    } catch (e) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  }, [load, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "All" ? trades :
    filter === "Wins" ? trades.filter((t) => (t.profit ?? 0) > 0) :
    filter === "Losses" ? trades.filter((t) => (t.profit ?? 0) < 0) : trades;

  const wins = trades.filter((t) => (t.profit ?? 0) > 0).length;
  const losses = trades.filter((t) => (t.profit ?? 0) < 0).length;
  const netPnl = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: "#FF3131" }} />
          <h2 className="text-sm font-heading font-bold tracking-wider text-white uppercase">Trade Journal</h2>
        </div>
        <button onClick={sync} disabled={syncing}
          className="p-2 rounded-lg" style={{ background: "rgba(255,49,49,0.08)", border: "1px solid rgba(255,49,49,0.20)" }}>
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} style={{ color: "#FF3131" }} />
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2">
        <SummaryCard label="Total" value={trades.length} />
        <SummaryCard label="Wins" value={wins} accent="#00FF41" />
        <SummaryCard label="Losses" value={losses} accent="#FF3131" />
        <SummaryCard label="Net P&L" value={`${netPnl >= 0 ? "+" : ""}$${netPnl.toFixed(2)}`} accent={netPnl >= 0 ? "#00FF41" : "#FF3131"} />
      </div>

      {/* Win rate bar */}
      <div className="rounded-2xl p-3" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-heading font-bold tracking-wider uppercase text-white/40">Win Rate</span>
          <span className="text-sm font-mono font-bold" style={{ color: winRate >= 50 ? "#00FF41" : "#FF3131" }}>{winRate.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div style={{ width: `${winRate}%`, background: "#00FF41" }} />
          <div style={{ width: `${100 - winRate}%`, background: "#FF3131" }} />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5">
        {["All", "Wins", "Losses"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-heading font-bold tracking-wider transition-all"
            style={{
              background: filter === f ? "rgba(255,49,49,0.10)" : "#0d0d0d",
              color: filter === f ? "#FF3131" : "rgba(255,255,255,0.35)",
              border: filter === f ? "1px solid rgba(255,49,49,0.25)" : "1px solid rgba(255,255,255,0.06)",
            }}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Trade list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#FF3131]/30 border-t-[#FF3131] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Calendar className="w-6 h-6 mx-auto mb-2 text-white/20" />
          <p className="text-xs text-white/40 font-heading">No closed trades yet</p>
          <p className="text-[10px] text-white/25 mt-1">Trade closes will appear here with date &amp; time</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t, i) => {
            const profit = t.profit ?? 0;
            const isWin = profit > 0;
            const isLoss = profit < 0;
            const color = isWin ? "#00FF41" : isLoss ? "#FF3131" : "#999";
            const closedAt = t.closed_at ? new Date(t.closed_at) : null;
            const dateStr = closedAt ? closedAt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "--";
            const timeStr = closedAt ? closedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--";

            return (
              <motion.div key={t.id || i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "#0d0d0d", border: `1px solid ${color}25` }}>
                {/* Direction badge */}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                  {t.direction === "Buy"
                    ? <TrendingUp className="w-4 h-4" style={{ color: "#00FF41" }} />
                    : <TrendingDown className="w-4 h-4" style={{ color: "#FF3131" }} />}
                </div>

                {/* Trade details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-heading font-bold text-white">{t.pair || "--"}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-heading tracking-wider"
                      style={{ background: `${color}12`, color }}>
                      {t.direction?.toUpperCase() || "--"}
                    </span>
                    <span className="text-[9px] text-white/30">{t.lot ? `${t.lot} lot` : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-white/40">
                    <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{dateStr}</span>
                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{timeStr}</span>
                    {t.close_reason && <span className="text-white/30">· {t.close_reason}</span>}
                  </div>
                </div>

                {/* P&L */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold" style={{ color }}>
                    {isWin ? "+" : isLoss ? "-" : ""}${Math.abs(profit).toFixed(2)}
                  </p>
                  <p className="text-[8px] font-heading tracking-wider uppercase" style={{ color }}>
                    {isWin ? "WIN" : isLoss ? "LOSS" : "BREAKEVEN"}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading mb-0.5">{label}</p>
      <p className="text-sm font-mono font-bold" style={{ color: accent || "#fff" }}>{value}</p>
    </div>
  );
}