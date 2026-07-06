import React from "react";

function StatBox({ label, stats }) {
  const net = stats.netProfit;
  const isPositive = net >= 0;
  return (
    <div
      className="rounded-xl px-3 py-3"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] uppercase tracking-widest text-white/40 font-heading">{label}</span>
        <span className="text-[8px] text-white/25 font-heading">{stats.trades} trades</span>
      </div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[8px] text-white/30 uppercase tracking-wider">Net P&amp;L</span>
        <span className={`font-heading font-black text-base ${isPositive ? "text-green-400" : "text-red-400"}`}>
          {isPositive ? "+" : "-"}${Math.abs(net).toFixed(2)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="rounded-lg py-1.5" style={{ background: "rgba(34,197,94,0.06)" }}>
          <p className="text-[8px] text-green-400/50 uppercase tracking-wider">Wins</p>
          <p className="font-heading font-bold text-sm text-green-400">{stats.wins}</p>
        </div>
        <div className="rounded-lg py-1.5" style={{ background: "rgba(239,68,68,0.06)" }}>
          <p className="text-[8px] text-red-400/50 uppercase tracking-wider">Losses</p>
          <p className="font-heading font-bold text-sm text-red-400">{stats.losses}</p>
        </div>
        <div className="rounded-lg py-1.5" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-[8px] text-white/30 uppercase tracking-wider">Win %</p>
          <p className="font-heading font-bold text-sm text-white">
            {stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : "--"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PeriodStats({ trades }) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const closed = trades.filter((t) => t.status === "Closed");

  const compute = (start) => {
    const periodTrades = closed.filter((t) => t.closed_at && new Date(t.closed_at) >= start);
    const wins = periodTrades.filter((t) => (t.profit ?? 0) > 0);
    const losses = periodTrades.filter((t) => (t.profit ?? 0) < 0);
    const netProfit = periodTrades.reduce((s, t) => s + (t.profit ?? 0), 0);
    return {
      trades: periodTrades.length,
      wins: wins.length,
      losses: losses.length,
      netProfit,
      winRate: periodTrades.length > 0 ? (wins.length / periodTrades.length) * 100 : null,
    };
  };

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading">Win / Loss Summary</p>
      <StatBox label="Today" stats={compute(todayStart)} />
      <StatBox label="This Month" stats={compute(monthStart)} />
      <StatBox label="This Year" stats={compute(yearStart)} />
    </div>
  );
}