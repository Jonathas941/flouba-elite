import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import GlassCard from "@/components/GlassCard";
import { WifiOff } from "lucide-react";

const TILES = [
  { label: "Net Profit",    key: "net_profit" },
  { label: "Win Rate",      key: "win_rate" },
  { label: "Total Trades",  key: "total_trades" },
  { label: "Wins / Losses", key: "wins_losses" },
];

export default function Statistics() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await base44.entities.BotSettings.list();
      setConnected(list[0]?.connection_status === "Connected");
    })();
  }, []);

  return (
    <div className="px-4 pt-8 space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-black text-white neon-text">Statistics</h1>
        <p className="text-sm text-muted-foreground">Performance data from your MT5 account.</p>
      </header>

      {!connected ? (
        <GlassCard className="py-14 flex flex-col items-center gap-4 text-center">
          <WifiOff className="w-10 h-10 text-muted-foreground/30" />
          <p className="font-heading text-sm uppercase tracking-widest text-muted-foreground">Not Connected</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            Statistics will populate here once the robot connects to your MT5 account.
          </p>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {TILES.map((t) => (
              <GlassCard key={t.label} className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.label}</p>
                <p className="font-heading text-xl font-bold text-muted-foreground/40 mt-1">--</p>
              </GlassCard>
            ))}
          </div>

          <GlassCard>
            <h3 className="font-heading text-sm uppercase tracking-widest text-white mb-3">Equity Curve</h3>
            <p className="text-sm text-muted-foreground py-10 text-center">No closed trades yet.</p>
          </GlassCard>
        </>
      )}
    </div>
  );
}