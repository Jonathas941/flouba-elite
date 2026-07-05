import React, { useState, useMemo } from "react";
import { CheckCircle2, XCircle, Clock, Zap, AlertCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";

const FILTERS = ["Today", "This Week", "Accepted", "Rejected", "Executed", "Failed"];

function execIcon(status) {
  if (status === "Executed") return <CheckCircle2 className="w-3 h-3 text-green-400" />;
  if (status === "Failed") return <XCircle className="w-3 h-3 text-red-400" />;
  if (status === "Queued") return <Clock className="w-3 h-3 text-amber-400" />;
  return <AlertCircle className="w-3 h-3 text-white/30" />;
}

export default function SignalHistory({ signals }) {
  const [filters, setFilters] = useState(new Set());
  const [strategy, setStrategy] = useState("");
  const [symbol, setSymbol] = useState("");

  const toggle = (f) => {
    const next = new Set(filters);
    next.has(f) ? next.delete(f) : next.add(f);
    setFilters(next);
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    return (signals || []).filter(s => {
      const t = s.received_at ? new Date(s.received_at) : null;
      if (filters.has("Today") && (!t || t < todayStart)) return false;
      if (filters.has("This Week") && (!t || t < weekStart)) return false;
      if (filters.has("Accepted") && !s.accepted) return false;
      if (filters.has("Rejected") && s.accepted) return false;
      if (filters.has("Executed") && s.mt5_status !== "Executed") return false;
      if (filters.has("Failed") && s.mt5_status !== "Failed") return false;
      if (strategy && s.strategy !== strategy) return false;
      if (symbol && s.symbol !== symbol) return false;
      return true;
    });
  }, [signals, filters, strategy, symbol]);

  const strategies = [...new Set((signals || []).map(s => s.strategy).filter(Boolean))];
  const symbols = [...new Set((signals || []).map(s => s.symbol).filter(Boolean))];

  return (
    <div>
      <h2 className="font-heading font-black text-sm text-white uppercase tracking-widest mb-3">Signal History</h2>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-2">
        {FILTERS.map(f => (
          <button key={f} onClick={() => toggle(f)} className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-heading font-bold uppercase tracking-wider transition-colors ${filters.has(f) ? "bg-cyan-500 text-black" : "bg-white/5 text-white/40 border border-white/10"}`}>{f}</button>
        ))}
        <select value={strategy} onChange={e => setStrategy(e.target.value)} className="shrink-0 px-2 py-1 rounded-full text-[9px] bg-white/5 text-white/60 border border-white/10 font-heading">
          <option value="">All Strategies</option>
          {strategies.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={symbol} onChange={e => setSymbol(e.target.value)} className="shrink-0 px-2 py-1 rounded-full text-[9px] bg-white/5 text-white/60 border border-white/10 font-heading">
          <option value="">All Symbols</option>
          {symbols.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                {["Time", "Strategy", "Symbol", "Action", "TF", "Score", "Result", "Reason", "Cmd ID", "MT5", "Ticket"].map(h => (
                  <th key={h} className="px-2 py-2 text-[8px] font-heading font-bold uppercase tracking-wider text-white/40 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="px-2 py-6 text-center text-[10px] text-white/30 font-body">No signals yet.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-2 py-2 text-[9px] text-white/50 font-mono whitespace-nowrap">{s.received_at ? new Date(s.received_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="px-2 py-2 text-[9px] text-white/70 font-heading whitespace-nowrap">{s.strategy}</td>
                  <td className="px-2 py-2 text-[9px] text-amber-300 font-heading whitespace-nowrap">{s.symbol}</td>
                  <td className="px-2 py-2 text-[9px] font-heading font-bold whitespace-nowrap">
                    <span className={s.action === "BUY" ? "text-green-400" : s.action === "SELL" ? "text-red-400" : "text-white/50"}>{s.action}</span>
                  </td>
                  <td className="px-2 py-2 text-[9px] text-cyan-300 font-heading whitespace-nowrap">{s.timeframe}</td>
                  <td className="px-2 py-2 text-[9px] text-white/50 font-mono whitespace-nowrap">{s.signal_score ?? "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{s.accepted ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}</td>
                  <td className="px-2 py-2 text-[8px] text-red-300/60 max-w-[80px] truncate">{s.rejection_reason || "—"}</td>
                  <td className="px-2 py-2 text-[8px] text-white/30 font-mono max-w-[60px] truncate">{s.command_id || "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap"><span className="flex items-center gap-1">{execIcon(s.mt5_status)}<span className="text-[8px] text-white/50">{s.mt5_status}</span></span></td>
                  <td className="px-2 py-2 text-[8px] text-white/40 font-mono whitespace-nowrap">{s.ticket || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}