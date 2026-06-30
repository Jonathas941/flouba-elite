import React from "react";
import GlassCard from "@/components/GlassCard";
import { WifiOff } from "lucide-react";

const STRATEGIES = [
  "Price Action",
  "Smart Money Concept",
  "Market Structure",
  "Supply & Demand Zones",
  "Order Blocks",
  "Liquidity Sweep",
  "Fibonacci 50% / 61.8%",
  "Trendline Confirmation",
  "Psychological Levels",
  "Candlestick Patterns",
];

export default function AIStrategyScore({ connected }) {
  return (
    <GlassCard>
      <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">AI Strategy Score</h3>

      {!connected ? (
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <WifiOff className="w-8 h-8 text-muted-foreground/40" />
          <p className="font-heading text-sm text-muted-foreground uppercase tracking-widest text-center">Waiting for MT5 connection</p>
          <p className="text-xs text-muted-foreground/60 text-center">AI analysis will begin after connecting to MT5</p>
        </div>
      ) : (
        <div className="space-y-3">
          {STRATEGIES.map((name) => (
            <div key={name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{name}</span>
                <span className="text-xs text-muted-foreground/40 font-heading">--</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}