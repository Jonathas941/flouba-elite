import React from "react";

export default function FloubaLogo({ size = 34, glow = true }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(145deg, rgba(0,255,65,0.18), rgba(0,0,0,0.9))",
        border: "1px solid rgba(0,255,65,0.45)",
        boxShadow: glow ? "0 0 14px rgba(0,255,65,0.5), inset 0 0 10px rgba(0,255,65,0.18)" : "none",
      }}
    >
      <span
        className="font-heading font-black"
        style={{ fontSize: size * 0.52, color: "#00FF41", textShadow: "0 0 8px rgba(0,255,65,0.8)" }}
      >
        F
      </span>
      <span
        className="absolute font-heading font-black"
        style={{
          fontSize: size * 0.52,
          color: "transparent",
          WebkitTextStroke: "1px rgba(0,255,65,0.9)",
          transform: "translate(0.5px, 0.5px)",
          opacity: 0.5,
        }}
      >
        F
      </span>
    </div>
  );
}