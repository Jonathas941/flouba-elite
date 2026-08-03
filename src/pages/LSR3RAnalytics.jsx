import React, { useState, useEffect } from "react";
import { BarChart3 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function LSR3RAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("lsr3rScanner", { action: "analytics" });
      if (res?.data?.ok) setData(res.data.analytics);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#FFCC42]/30 border-t-[#FFCC42] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.total_completed === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: "#FFCC42" }} />
          <h2 className="text-sm font-heading font-bold tracking-wider text-white uppercase">Trade Journal Analytics</h2>
        </div>
        <div className="rounded-2xl p-8 text-center" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs text-white/40 font-heading">No completed trades yet</p>
          <p className="text-[10px] text-white/25 mt-1">Analytics will appear after signals resolve</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4" style={{ color: "#FFCC42" }} />
        <h2 className="text-sm font-heading font-bold tracking-wider text-white uppercase">Trade Journal Analytics</h2>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Total Signals" value={data.total_signals} />
        <MetricCard label="Completed Trades" value={data.total_completed} />
        <MetricCard label="Win Rate" value={`${data.win_rate.toFixed(1)}%`} accent={data.win_rate >= 50 ? "#00FF41" : "#FF3131"} />
        <MetricCard label="Profit Factor" value={data.profit_factor >= 99 ? "∞" : data.profit_factor.toFixed(2)} accent={data.profit_factor >= 1 ? "#00FF41" : "#FF3131"} />
        <MetricCard label="Avg Win" value={`$${data.avg_win.toFixed(2)}`} accent="#00FF41" />
        <MetricCard label="Avg Loss" value={`$${data.avg_loss.toFixed(2)}`} accent="#FF3131" />
        <MetricCard label="Max Drawdown" value={`$${data.max_drawdown.toFixed(2)}`} accent="#FF3131" />
        <MetricCard label="Net Profit" value={`$${data.net_profit.toFixed(2)}`} accent={data.net_profit >= 0 ? "#00FF41" : "#FF3131"} />
      </div>

      {/* By pair */}
      {Object.keys(data.by_pair).length > 0 && (
        <Section title="Results by Pair">
          {Object.entries(data.by_pair).map(([pair, d]) => (
            <BreakdownRow key={pair} label={pair} wins={d.wins} losses={d.losses} pnl={d.pnl} />
          ))}
        </Section>
      )}

      {/* By session */}
      {Object.keys(data.by_session).length > 0 && (
        <Section title="Results by Session">
          {Object.entries(data.by_session).map(([sess, d]) => (
            <BreakdownRow key={sess} label={sess} wins={d.wins} losses={d.losses} pnl={d.pnl} />
          ))}
        </Section>
      )}

      {/* By direction */}
      {Object.keys(data.by_direction).length > 0 && (
        <Section title="BUY vs SELL">
          {Object.entries(data.by_direction).map(([dir, d]) => (
            <BreakdownRow key={dir} label={dir} wins={d.wins} losses={d.losses} pnl={d.pnl} accent={dir === "BUY" ? "#00FF41" : "#FF3131"} />
          ))}
        </Section>
      )}

      {/* By news filter */}
      {Object.keys(data.by_news).length > 0 && (
        <Section title="News Filter Impact">
          {Object.entries(data.by_news).map(([nk, d]) => (
            <BreakdownRow key={nk} label={nk} wins={d.wins} losses={d.losses} pnl={d.pnl} />
          ))}
        </Section>
      )}
    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading mb-1">{label}</p>
      <p className="text-lg font-mono font-bold" style={{ color: accent || "#ffffff" }}>{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid rgba(255,204,66,0.10)" }}>
      <p className="text-[10px] font-heading font-bold tracking-wider uppercase text-white/60 mb-3">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function BreakdownRow({ label, wins, losses, pnl, accent }) {
  const total = wins + losses;
  const wr = total > 0 ? (wins / total) * 100 : 0;
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <span className="text-[11px] font-heading font-bold" style={{ color: accent || "#ffffff" }}>{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-white/50">{wins}W / {losses}L</span>
        <span className="text-[10px] text-white/40">{wr.toFixed(0)}%</span>
        <span className="text-[11px] font-mono font-bold w-16 text-right" style={{ color: pnl >= 0 ? "#00FF41" : "#FF3131" }}>
          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
        </span>
      </div>
    </div>
  );
}