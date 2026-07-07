import React from "react";

export default function HudPanel({ label, accent = "#00FF41", children, className = "", bodyClassName = "" }) {
  return (
    <div className={`hud-clip ${className}`}
      style={{
        background: "rgba(11,18,22,0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${accent}28`,
        boxShadow: `0 0 14px ${accent}08, inset 0 1px 0 rgba(255,255,255,0.025)`,
      }}>
      {label && (
        <div className="px-4 pt-2.5 pb-2 flex items-center gap-2">
          <div className="w-1 h-3" style={{ background: accent, boxShadow: `0 0 5px ${accent}80` }} />
          <span className="text-[8px] font-mono font-bold uppercase tracking-[0.28em]" style={{ color: `${accent}CC` }}>{label}</span>
          <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${accent}30, transparent)` }} />
        </div>
      )}
      <div className={label ? `px-4 pb-3 ${bodyClassName}` : `p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}