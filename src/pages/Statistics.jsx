import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import GlassCard from "@/components/GlassCard";
import StatTile from "@/components/StatTile";
import { Target, TrendingUp, Hash, Percent } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from "recharts";

export default function Statistics() {
  const [trades, setTrades] = useState([]);

  useEffect(() => { (async () => setTrades(await base44.entities.Trade.list("-created_date", 100)))(); }, []);

  const closed = trades.filter((t) => t.status === "Closed");
  const wins = closed.filter((t) => (t.profit || 0) >= 0);
  const total = closed.reduce((a, t) => a + (t.profit || 0), 0);
  const winRate = closed.length ? Math.round((wins.length / closed.length) * 100) : 0;

  let cum = 0;
  const chart = [...closed].reverse().map((t, i) => { cum += t.profit || 0; return { name: `#${i + 1}`, pnl: parseFloat(cum.toFixed(2)) }; });

  return (
    <div className="px-4 pt-8 space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-black text-white neon-text">Statistics</h1>
        <p className="text-sm text-muted-foreground">Performance overview of your robot.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Net Profit" value={`${total >= 0 ? "+" : ""}$${total.toFixed(2)}`} icon={TrendingUp} accent={total >= 0 ? "text-green-400" : "text-red-400"} />
        <StatTile label="Win Rate" value={`${winRate}%`} icon={Percent} accent="text-red-400" />
        <StatTile label="Total Trades" value={closed.length} icon={Hash} />
        <StatTile label="Wins / Losses" value={`${wins.length} / ${closed.length - wins.length}`} icon={Target} />
      </div>

      <GlassCard>
        <h3 className="font-heading text-sm uppercase tracking-widest text-white mb-3">Equity Curve</h3>
        {chart.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No closed trades yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="pnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" hide />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12 }} />
              <Area type="monotone" dataKey="pnl" stroke="#ef4444" strokeWidth={2} fill="url(#pnl)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </GlassCard>
    </div>
  );
}