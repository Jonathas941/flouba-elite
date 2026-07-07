import React from "react";
import { cn } from "@/lib/utils";

const RESULT_STYLES = {
  TP:          { bg: "rgba(0,255,65,0.12)",  border: "rgba(0,255,65,0.35)",  text: "#00FF41", label: "TP HIT" },
  SL:          { bg: "rgba(255,49,49,0.12)", border: "rgba(255,49,49,0.35)", text: "#FF3131", label: "SL HIT" },
  Pending:     { bg: "rgba(255,204,66,0.10)",border: "rgba(255,204,66,0.30)",text: "#FFCC42", label: "PENDING" },
  Expired:     { bg: "rgba(255,255,255,0.06)",border:"rgba(255,255,255,0.15)",text:"#999",   label: "EXPIRED" },
  Invalidated: { bg: "rgba(255,49,49,0.08)", border: "rgba(255,49,49,0.20)", text: "#FF6B6B",label: "INVALID" },
  Skipped:     { bg: "rgba(255,255,255,0.04)",border:"rgba(255,255,255,0.10)",text:"#777",  label: "SKIPPED" },
};

export default function SignalCard({ signal, onClick }) {
  const digits = signal.symbol === "XAUUSD" ? 2 : 5;
  const fmt = (v) => v != null ? Number(v).toFixed(digits) : "--";
  const rs = RESULT_STYLES[signal.result] || RESULT_STYLES.Pending;
  const isBuy = signal.direction === "BUY";
  const dirColor = isBuy ? "#00FF41" : "#FF3131";

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-2xl p-3.5 transition-all active:scale-[0.98]"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>

      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-heading font-black" style={{ color: dirColor }}>{signal.direction}</span>
          <span className="text-xs font-heading font-bold text-white">{signal.symbol}</span>
          <span className="text-[9px] text-white/30 font-heading">{signal.anchor_session}</span>
        </div>
        <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-full tracking-wider"
          style={{ background: rs.bg, border: `1px solid ${rs.border}`, color: rs.text }}>
          {rs.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading">Entry</p>
          <p className="text-xs font-mono text-white">{fmt(signal.entry_price)}</p>
        </div>
        <div>
          <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading">SL</p>
          <p className="text-xs font-mono" style={{ color: "#FF3131" }}>{fmt(signal.stop_loss)}</p>
        </div>
        <div>
          <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading">TP</p>
          <p className="text-xs font-mono" style={{ color: "#00FF41" }}>{fmt(signal.take_profit)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <span className="text-[9px] text-white/40">
          {signal.anchor_time ? new Date(signal.anchor_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "--"}
        </span>
        <div className="flex items-center gap-2">
          {signal.pnl != null && (
            <span className="text-[10px] font-mono font-bold" style={{ color: signal.pnl >= 0 ? "#00FF41" : "#FF3131" }}>
              {signal.pnl >= 0 ? "+" : ""}${signal.pnl.toFixed(2)}
            </span>
          )}
          {signal.is_demo && (
            <span className="text-[8px] px-1.5 py-0.5 rounded font-heading tracking-wider"
              style={{ background: "rgba(255,204,66,0.10)", color: "#FFCC42" }}>DEMO</span>
          )}
        </div>
      </div>
      {signal.reason && (
        <p className="text-[9px] text-white/35 mt-1.5 italic">{signal.reason}</p>
      )}
    </button>
  );
}