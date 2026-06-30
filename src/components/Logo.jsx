import React from "react";
import { Bot } from "lucide-react";

export default function Logo({ size = 64, withText = false }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative flex items-center justify-center rounded-2xl glass neon-red"
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-0 rounded-2xl grid-lines opacity-40" />
        <Bot
          className="relative text-red-500 neon-text"
          style={{ width: size * 0.55, height: size * 0.55 }}
          strokeWidth={1.8}
        />
      </div>
      {withText && (
        <div className="text-center">
          <h1 className="font-heading text-2xl font-black tracking-widest text-white neon-text">
            FLOUBA <span className="text-red-500">ELITE</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.35em] text-red-400/70">AI Trading Robot</p>
        </div>
      )}
    </div>
  );
}