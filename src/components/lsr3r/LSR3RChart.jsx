import React from "react";

// Visual chart panel showing key LSR-3R levels as horizontal lines with labels.
// Uses relative positioning within a price range to place each level.
export default function LSR3RChart({ status }) {
  if (!status) return null;

  const levels = [];
  const digits = status.symbol === "XAUUSD" ? 2 : 5;
  const fmt = (v) => v != null ? Number(v).toFixed(digits) : null;

  // Collect all price levels to compute range
  const prices = [];
  const add = (price, label, color, side) => {
    if (price == null || isNaN(price)) return;
    prices.push(price);
    levels.push({ price: Number(price), label, color, side });
  };

  add(status.current_price, "PRICE", "#ffffff", "right");
  add(status.anchor_high, "Anchor High", "#FFCC42", "left");
  add(status.anchor_low, "Anchor Low", "#FFCC42", "left");
  add(status.sweep_high, "Sweep", "#00E5FF", "left");
  add(status.sweep_low, "Sweep", "#00E5FF", "left");
  add(status.choch_level, "CHOCH", "#A855F7", "left");
  add(status.fvg_high, "FVG Top", "rgba(168,85,247,0.5)", "left");
  add(status.fvg_low, "FVG Bot", "rgba(168,85,247,0.5)", "left");
  add(status.entry, "Entry", status.direction === "SELL" ? "#FF3131" : "#00FF41", "right");
  add(status.stop_loss, "SL", "#FF3131", "right");
  add(status.take_profit, "TP", "#00FF41", "right");

  if (prices.length < 2) {
    return (
      <div className="rounded-2xl p-8 flex items-center justify-center"
        style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", minHeight: "200px" }}>
        <p className="text-white/30 text-xs font-heading tracking-wider">WAITING FOR DATA</p>
      </div>
    );
  }

  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const pad = range * 0.15;
  const lo = minP - pad, hi = maxP + pad;
  const totalRange = hi - lo;

  const yPos = (p) => ((hi - p) / totalRange) * 100;

  // FVG zone
  const fvgZone = (status.fvg_high != null && status.fvg_low != null) ? {
    top: yPos(Number(status.fvg_high)),
    bottom: yPos(Number(status.fvg_low)),
  } : null;

  const connected = status.connected !== false;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0a", border: "1px solid rgba(255,204,66,0.12)" }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span className="text-[10px] font-heading font-bold tracking-wider text-white/60 uppercase">{status.symbol} · M1</span>
        <span className="text-[10px] font-heading tracking-wider" style={{ color: connected ? "#00FF41" : "#FF3131" }}>
          {connected ? "● LIVE" : "● DISCONNECTED"}
        </span>
      </div>

      <div className="relative" style={{ height: "280px", background: "linear-gradient(180deg, #080808, #0c0c0c)" }}>
        {/* Grid lines */}
        {[20, 40, 60, 80].map((p) => (
          <div key={p} className="absolute left-0 right-0" style={{ top: `${p}%`, height: "1px", background: "rgba(255,255,255,0.03)" }} />
        ))}

        {/* FVG zone */}
        {fvgZone && (
          <div className="absolute left-0 right-0"
            style={{
              top: `${fvgZone.top}%`, height: `${fvgZone.bottom - fvgZone.top}%`,
              background: "rgba(168,85,247,0.12)", borderTop: "1px dashed rgba(168,85,247,0.4)", borderBottom: "1px dashed rgba(168,85,247,0.4)",
            }}>
            <span className="absolute left-2 top-1 text-[8px] font-heading tracking-wider" style={{ color: "#A855F7" }}>FVG</span>
          </div>
        )}

        {/* Level lines */}
        {levels.map((lvl, i) => {
          const y = yPos(lvl.price);
          return (
            <div key={i} className="absolute left-0 right-0 flex items-center" style={{ top: `${y}%`, transform: "translateY(-50%)" }}>
              <div className="flex-1" style={{ height: "1px", background: lvl.color, opacity: lvl.label === "PRICE" ? 0.9 : 0.5 }} />
              <span className="text-[8px] font-heading font-bold tracking-wider px-1.5 py-0.5 rounded ml-1"
                style={{
                  color: lvl.color,
                  background: "rgba(0,0,0,0.6)",
                  border: `1px solid ${lvl.color}40`,
                }}>
                {lvl.label} {lvl.label !== "FVG Top" && lvl.label !== "FVG Bot" && fmt(lvl.price)}
              </span>
            </div>
          );
        })}

        {/* Invalidated overlay */}
        {status.setup_status === "Setup invalidated" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,49,49,0.05)" }}>
            <span className="text-sm font-heading font-black tracking-widest" style={{ color: "rgba(255,49,49,0.4)" }}>INVALIDATED</span>
          </div>
        )}
      </div>
    </div>
  );
}