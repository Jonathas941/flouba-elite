import React, { useState, useEffect } from "react";
import { History as HistoryIcon, Filter } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SignalCard from "@/components/lsr3r/SignalCard";

const FILTERS = ["All", "Pending", "TP", "SL", "Expired", "Invalidated", "Skipped"];

export default function LSR3RHistory() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("lsr3rScanner", { action: "history" });
      if (res?.data?.ok) setSignals(res.data.signals || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "All" ? signals : signals.filter(s => s.result === filter);

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <HistoryIcon className="w-4 h-4" style={{ color: "#FFCC42" }} />
        <h2 className="text-sm font-heading font-bold tracking-wider text-white uppercase">Signal History</h2>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-heading font-bold tracking-wider whitespace-nowrap transition-all"
            style={{
              background: filter === f ? "rgba(255,204,66,0.12)" : "#0d0d0d",
              color: filter === f ? "#FFCC42" : "rgba(255,255,255,0.35)",
              border: filter === f ? "1px solid rgba(255,204,66,0.30)" : "1px solid rgba(255,255,255,0.06)",
            }}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#FFCC42]/30 border-t-[#FFCC42] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Filter className="w-6 h-6 mx-auto mb-2 text-white/20" />
          <p className="text-xs text-white/40 font-heading">No signals found</p>
          <p className="text-[10px] text-white/25 mt-1">Confirmed setups will appear here</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((s) => (
            <SignalCard key={s.id} signal={s} onClick={() => setSelected(s)} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="w-full max-w-md rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto" style={{ background: "#0a0a0a", border: "1px solid rgba(255,204,66,0.15)", borderBottom: "none" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-heading font-bold text-white">Signal Details</h3>
              <button onClick={() => setSelected(null)} className="text-white/40 text-xs">CLOSE</button>
            </div>
            <DetailGrid signal={selected} />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailGrid({ signal }) {
  const digits = signal.symbol === "XAUUSD" ? 2 : 5;
  const fmt = (v) => v != null ? Number(v).toFixed(digits) : "--";
  const rows = [
    ["Symbol", signal.symbol],
    ["Direction", signal.direction],
    ["Anchor Session", signal.anchor_session],
    ["Anchor Time", signal.anchor_time ? new Date(signal.anchor_time).toLocaleString() : "--"],
    ["Anchor High", fmt(signal.anchor_high)],
    ["Anchor Low", fmt(signal.anchor_low)],
    ["Sweep High", fmt(signal.sweep_high)],
    ["Sweep Low", fmt(signal.sweep_low)],
    ["CHOCH Level", fmt(signal.choch_level)],
    ["FVG High", fmt(signal.fvg_high)],
    ["FVG Low", fmt(signal.fvg_low)],
    ["Entry", fmt(signal.entry_price)],
    ["Stop Loss", fmt(signal.stop_loss)],
    ["Take Profit", fmt(signal.take_profit)],
    ["Risk/Reward", `1:${signal.risk_reward}`],
    ["Risk Amount", signal.risk_amount ? `$${signal.risk_amount.toFixed(2)}` : "--"],
    ["Lot Size", signal.lot_size?.toFixed(2) || "--"],
    ["Result", signal.result],
    ["P&L", signal.pnl != null ? `$${signal.pnl.toFixed(2)}` : "--"],
    ["Spread", signal.spread_at_signal?.toFixed(digits) || "--"],
    ["ATR (M1)", signal.atr_at_signal?.toFixed(digits) || "--"],
    ["News Filtered", signal.news_filtered ? "Yes" : "No"],
    ["Demo", signal.is_demo ? "Yes" : "No"],
    ["Reason", signal.reason || "--"],
  ];

  return (
    <div className="space-y-0">
      {rows.map(([label, value], i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-heading">{label}</span>
          <span className="text-[11px] font-mono text-white text-right max-w-[60%]">{value}</span>
        </div>
      ))}
    </div>
  );
}