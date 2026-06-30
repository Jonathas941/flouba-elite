import React from "react";
import GlassCard from "@/components/GlassCard";
import { WifiOff } from "lucide-react";

const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30"];

export default function MarketWatch({ connected }) {
  return (
    <div>
      <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
        Market Watch
      </h3>

      {!connected ? (
        <GlassCard className="py-8 flex flex-col items-center justify-center gap-3 text-center">
          <WifiOff className="w-8 h-8 text-muted-foreground/40" />
          <p className="font-heading text-sm text-muted-foreground uppercase tracking-widest">Waiting for MT5 connection</p>
          <p className="text-xs text-muted-foreground/60">Live prices will appear here after connecting</p>
        </GlassCard>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
          {PAIRS.map((pair) => (
            <div key={pair} className="snap-start shrink-0 w-36 glass rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-heading text-xs font-bold text-white tracking-wide">{pair}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>
              <p className="font-heading text-sm font-black text-muted-foreground/40">--</p>
              <p className="text-xs text-muted-foreground/40">--</p>
              <div>
                <div className="h-1 bg-white/5 rounded-full" />
              </div>
              <p className="text-[10px] text-muted-foreground/40">Spread: --</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}