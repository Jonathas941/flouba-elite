import React from "react";
import GlassCard from "@/components/GlassCard";
import { mapStatus, statusColor } from "@/lib/tradingViewStatus";

function LegRow({ leg, label, fallbackTp }) {
  const status = leg?.status || "pending";
  const isOpen = status === "opened" || status === "open";
  const isFailed = status === "failed";
  const isSimulated = status === "simulated";
  const isPending = status === "pending" || !leg;

  const color = isOpen ? "#00FF41" : isFailed ? "#FF3131" : isSimulated ? "#FFCC42" : "#888";
  const Icon = isOpen ? "✓" : isFailed ? "✗" : isSimulated ? "◇" : "○";

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded text-[9px]"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}
    >
      <span className="font-bold text-white/60 w-6">{label}</span>
      <span className="text-white/80 font-mono w-12">{leg?.lot != null ? Number(leg.lot).toFixed(2) : "—"}</span>
      <span className="text-white/40 font-mono flex-1 truncate">TP: {leg?.tp ?? fallbackTp ?? "—"}</span>
      <span className="text-white/40 font-mono w-20 truncate" title={leg?.order_id}>
        {leg?.order_id ? `#${leg.order_id}` : "—"}
      </span>
      <span className="flex items-center gap-1 w-20" style={{ color }}>
        <span>{Icon}</span>
        <span className="truncate">{isPending ? "Pending" : status}</span>
      </span>
      {isFailed && leg?.error && (
        <span className="text-[8px] text-[#FF3131]/70 truncate flex-1" title={leg.error}>
          {leg.error}
        </span>
      )}
    </div>
  );
}

export default function SignalDetailCard({ signal }) {
  if (!signal) return null;

  const mappedStatus = mapStatus(signal.status);
  const cls = statusColor(signal.status);
  const legs = Array.isArray(signal.legs) ? signal.legs : [];
  const legByLabel = (label) => legs.find((l) => l.label === label);

  return (
    <div className="bg-black/30 rounded-lg p-3 border border-white/5 text-[10px] space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white/80 font-bold">{signal.symbol || "—"}</span>
          <span className="text-white/40">{signal.action || "—"}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${cls}`}>{mappedStatus}</span>
      </div>

      {/* Entry / SL / Total Lot */}
      <div className="flex items-center gap-3 text-white/40">
        <span>Entry: <span className="text-white/70 font-semibold">{signal.price ?? "—"}</span></span>
        <span>SL: <span className="text-white/70 font-semibold">{signal.sl ?? "—"}</span></span>
        {signal.total_lot != null && (
          <span>Total: <span className="text-white/70 font-semibold">{Number(signal.total_lot).toFixed(2)}</span></span>
        )}
      </div>

      {/* Per-leg details: 3 rows (TP1, TP2, TP3) */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[8px] text-white/30 uppercase tracking-wider px-2">
          <span className="w-6">Leg</span>
          <span className="w-12">Lot</span>
          <span className="flex-1">Target</span>
          <span className="w-20">MT5 Ticket</span>
          <span className="w-20">Status</span>
        </div>
        <LegRow label="TP1" leg={legByLabel("TP1")} fallbackTp={signal.tp1} />
        <LegRow label="TP2" leg={legByLabel("TP2")} fallbackTp={signal.tp2} />
        <LegRow label="TP3" leg={legByLabel("TP3")} fallbackTp={signal.tp3} />
      </div>

      {/* Rejection reason */}
      {(signal.rejection_reason || signal.message) && (
        <p className={`text-[9px] italic truncate ${mappedStatus === "Rejected" ? "text-orange-400/80" : "text-white/30"}`}>
          {signal.rejection_reason || signal.message}
        </p>
      )}

      {/* Timestamp */}
      <div className="text-white/30">
        {signal.received_at ? new Date(signal.received_at).toLocaleString() : "—"}
      </div>
    </div>
  );
}