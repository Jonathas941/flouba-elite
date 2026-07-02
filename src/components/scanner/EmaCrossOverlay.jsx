import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * EmaCrossOverlay — quick-glance visual of where EMA 20/50/200 sit
 * relative to live price, plus their cross state.
 * Uses ONLY real MT5 indicator values (no simulated data).
 *
 * Props: scanner — raw scanner object { indicators: { ema_20, ema_50, ema_200, bid, ask } }
 */
const EMA_META = [
  { key: "ema_200", label: "EMA 200", color: "#a855f7", hint: "Dynamic S/R" },
  { key: "ema_50",  label: "EMA 50",  color: "#38bdf8", hint: "Mid-trend"   },
  { key: "ema_20",  label: "EMA 20",  color: "#fbbf24", hint: "Fast trend"  },
];

function crossState(a, b) {
  if (a == null || b == null) return null;
  if (a > b) return "bull";
  if (a < b) return "bear";
  return "flat";
}

export default function EmaCrossOverlay({ scanner }) {
  const ind = scanner?.indicators || {};
  const bid = ind.bid ?? ind.ask ?? null;

  const values = [
    { key: "ema_20",  val: ind.ema_20,  color: "#fbbf24", label: "EMA 20"  },
    { key: "ema_50",  val: ind.ema_50,  color: "#38bdf8", label: "EMA 50"  },
    { key: "ema_200", val: ind.ema_200, color: "#a855f7", label: "EMA 200" },
    { key: "price",   val: bid,         color: "#ffffff", label: "Price"   },
  ].filter((v) => v.val != null);

  if (values.length < 2) {
    return (
      <div className="rounded-2xl px-4 py-6 flex flex-col items-center gap-2 text-center"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading">EMA Cross Overlay</p>
        <p className="text-[10px] text-white/30">Waiting for live EMA data from MT5…</p>
      </div>
    );
  }

  // Map values onto a horizontal price axis
  const nums = values.map((v) => v.val);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const pad = range * 0.15;
  const lo = min - pad;
  const hi = max + pad;
  const span = hi - lo;

  const pct = (v) => ((v - lo) / span) * 100;

  // Cross pairs
  const c2050  = crossState(ind.ema_20, ind.ema_50);
  const c50200 = crossState(ind.ema_50, ind.ema_200);
  const c20200 = crossState(ind.ema_20, ind.ema_200);

  // Alignment
  const bullStack = ind.ema_20 > ind.ema_50 && ind.ema_50 > ind.ema_200;
  const bearStack = ind.ema_20 < ind.ema_50 && ind.ema_50 < ind.ema_200;
  const align = bullStack
    ? { label: "Bullish Stack", color: "text-green-400", icon: TrendingUp, desc: "20 > 50 > 200 — strong uptrend confirmed" }
    : bearStack
    ? { label: "Bearish Stack", color: "text-red-400", icon: TrendingDown, desc: "20 < 50 < 200 — strong downtrend confirmed" }
    : { label: "Mixed / Transition", color: "text-amber-400", icon: Minus, desc: "EMAs not aligned — trend unclear, wait for cross" };
  const AlignIcon = align.icon;

  const crossRow = (label, state, leftColor, rightColor) => (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: leftColor }} />
        <span className="text-[9px] text-white/30">×</span>
        <span className="w-2 h-2 rounded-full" style={{ background: rightColor }} />
        <span className="text-[10px] text-white/50 font-heading ml-1">{label}</span>
      </div>
      {state == null ? (
        <span className="text-[9px] text-white/25 font-heading">--</span>
      ) : state === "bull" ? (
        <span className="flex items-center gap-1 text-[9px] font-heading font-bold text-green-400">
          <TrendingUp className="w-3 h-3" /> BULL CROSS
        </span>
      ) : state === "bear" ? (
        <span className="flex items-center gap-1 text-[9px] font-heading font-bold text-red-400">
          <TrendingDown className="w-3 h-3" /> BEAR CROSS
        </span>
      ) : (
        <span className="text-[9px] font-heading font-bold text-white/40">FLAT</span>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl px-4 py-4 space-y-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>

      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading">EMA Cross Overlay</p>
        <span className="text-[9px] text-white/30 font-heading">{scanner?.symbol ?? "--"}</span>
      </div>

      {/* ── Horizontal price ribbon with EMA + price markers ── */}
      <div className="relative h-20">
        {/* axis baseline */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/8" />

        {/* low / high labels */}
        <span className="absolute -bottom-1 left-0 text-[8px] text-white/25 font-heading">{lo.toFixed(2)}</span>
        <span className="absolute -bottom-1 right-0 text-[8px] text-white/25 font-heading">{hi.toFixed(2)}</span>

        {values.map((v) => {
          const left = pct(v.val);
          const isPrice = v.key === "price";
          return (
            <div key={v.key} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${left}%` }}>
              {/* vertical tick line */}
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: isPrice ? 64 : 48, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: isPrice ? 2 : 1.5,
                  background: v.color,
                  boxShadow: isPrice ? `0 0 8px ${v.color}` : "none",
                }}
              />
              {/* dot */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-7 w-2 h-2 rounded-full"
                style={{ background: v.color, boxShadow: `0 0 6px ${v.color}` }} />
              {/* label chip */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-5 whitespace-nowrap"
                style={{ transform: "translate(-50%, 0)" }}>
                <span className="text-[8px] font-heading font-bold" style={{ color: v.color }}>
                  {isPrice ? "PRICE" : v.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Alignment summary ── */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <AlignIcon className={`w-4 h-4 ${align.color} shrink-0`} />
        <div>
          <p className={`font-heading font-bold text-xs ${align.color}`}>{align.label}</p>
          <p className="text-[9px] text-white/35 leading-tight">{align.desc}</p>
        </div>
      </div>

      {/* ── Cross states ── */}
      <div className="space-y-1.5">
        {crossRow("EMA 20 × 50",  c2050,  "#fbbf24", "#38bdf8")}
        {crossRow("EMA 50 × 200", c50200, "#38bdf8", "#a855f7")}
        {crossRow("EMA 20 × 200", c20200, "#fbbf24", "#a855f7")}
      </div>

      <p className="text-[9px] text-white/20 leading-snug">
        Markers show live EMA positions vs price on a shared scale. Bull cross = faster EMA above slower EMA (uptrend). All values from real MT5 data.
      </p>
    </div>
  );
}