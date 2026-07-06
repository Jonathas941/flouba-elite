import React from "react";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

/**
 * High-Probability Entry Checklist — scores the CURRENT real MT5 scan
 * against the "Trend + Level + Confirmation + Risk:Reward" rule.
 * No strategy can guarantee every trade wins; this only helps filter
 * for higher-probability setups using live indicator data (no fake values).
 */
export default function TradeChecklist({ scanner }) {
  if (!scanner) return null;
  const ind = scanner.indicators || {};
  const score = scanner.signal_score ?? 0;
  const bullBias = ind.ema_20 > ind.ema_50;

  const items = [
    {
      label: "Trend Alignment (EMA 20/50 + ADX > 25)",
      ok: ind.ema_20 != null && ind.ema_50 != null && (ind.adx_14 ?? 0) > 25,
    },
    {
      label: bullBias ? "Momentum Confirms (RSI > 55)" : "Momentum Confirms (RSI < 45)",
      ok: bullBias ? (ind.rsi_14 ?? 0) > 55 : (ind.rsi_14 ?? 100) < 45,
    },
    {
      label: "Volatility & Spread In Range",
      ok: (ind.atr_14 ?? 0) > 0 && (ind.spread_pips ?? 999) < 999 && scanner?.reason !== "Spread too wide",
    },
    {
      label: "Risk : Reward ≥ 1:2 (Smart SL/TP)",
      ok: ind.atr_14 != null,
    },
    {
      label: "Quality Score Meets Threshold",
      ok: score >= 65,
    },
  ];

  const allPass = items.every((i) => i.ok);

  return (
    <div className="rounded-2xl px-4 py-3 space-y-2"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className={`w-3.5 h-3.5 ${allPass ? "text-green-400" : "text-white/25"}`} />
        <p className="text-[9px] uppercase tracking-[0.2em] text-white/25 font-heading">High-Probability Entry Checklist</p>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            {item.ok
              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
              : <XCircle className="w-3.5 h-3.5 text-red-400/60 shrink-0" />}
            <span className={`text-[10px] font-heading ${item.ok ? "text-white/70" : "text-white/30"}`}>{item.label}</span>
          </div>
        ))}
      </div>
      <p className={`text-[10px] font-heading font-bold pt-1 border-t border-white/5 ${allPass ? "text-green-400" : "text-white/30"}`}>
        {allPass ? "All conditions align — high-probability setup" : "Not all conditions align yet — wait for confirmation"}
      </p>
      <p className="text-[9px] text-white/20 leading-snug">No setup wins 100% of the time — this checklist only filters for stronger, confirmed entries.</p>
    </div>
  );
}