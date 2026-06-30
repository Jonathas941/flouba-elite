import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";
import { mt5Api } from "@/lib/mt5Api";

function fmtDate(ts) {
  if (!ts) return "--";
  const d = new Date(ts);
  return isNaN(d) ? "--" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function TradeHistoryTable() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await mt5Api.history(50);
        if (res?.ok && res?.data) {
          // Handle both array and object with trades key
          const list = Array.isArray(res.data) ? res.data : (res.data.trades || res.data.history || []);
          setHistory(list);
        } else {
          setError(res?.error || res?.data?.message || "Failed to load history");
        }
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="py-8 text-center rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="font-heading text-xs text-red-400">History Unavailable</p>
      <p className="text-[10px] text-white/30 mt-1">{error}</p>
    </div>
  );

  if (!history.length) return (
    <div className="py-10 text-center rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <Clock className="w-7 h-7 text-white/15 mx-auto mb-2" />
      <p className="font-heading text-xs uppercase tracking-widest text-white/25">No Trade History</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading">Trade History ({history.length})</p>
      {history.map((t, i) => {
        const pair = t.symbol || t.pair || "--";
        const isBuy = t.type === 0 || t.type === "buy" || t.direction === "Buy";
        const profit = t.profit ?? t.realized_pnl ?? 0;
        const isWin = profit >= 0;
        const closeTime = t.closeTime ?? t.close_time ?? t.closed_at;
        const openTime  = t.openTime  ?? t.open_time  ?? t.opened_at;
        return (
          <motion.div
            key={t.ticket ?? t.id ?? i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="rounded-xl px-3 py-2.5 flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isBuy ? "bg-green-500/10" : "bg-red-500/10"}`}>
              {isBuy
                ? <TrendingUp className="w-3 h-3 text-green-400" />
                : <TrendingDown className="w-3 h-3 text-red-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-bold text-[11px] text-white/80">{pair}</span>
                <span className={`text-[9px] font-bold font-heading ${isBuy ? "text-green-400/70" : "text-red-400/70"}`}>
                  {isBuy ? "BUY" : "SELL"}
                </span>
                {t.volume != null && <span className="text-[9px] text-white/25">{t.volume} lot</span>}
              </div>
              <p className="text-[9px] text-white/25 mt-0.5">{fmtDate(closeTime || openTime)}</p>
            </div>
            <span className={`font-heading font-bold text-sm shrink-0 ${isWin ? "text-green-400" : "text-red-400"}`}>
              {isWin ? "+" : ""}{Number(profit).toFixed(2)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}