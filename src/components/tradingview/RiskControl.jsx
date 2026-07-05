import React from "react";
import { ShieldCheck, TrendingDown, Flame, Snowflake, Target, BarChart3 } from "lucide-react";
import GlassCard from "@/components/GlassCard";

function Metric({ icon: Icon, label, value, accent }) {
  const colorMap = { green: "text-green-400", red: "text-red-400", amber: "text-amber-400", cyan: "text-cyan-400", white: "text-white/80" };
  return (
    <div className="rounded-xl bg-black/20 border border-white/8 px-3 py-2.5 flex items-center gap-2.5">
      <Icon className={`w-4 h-4 ${colorMap[accent] || "text-white/60"} shrink-0`} />
      <div className="min-w-0">
        <p className="text-[8px] text-white/30 uppercase tracking-wider font-body truncate">{label}</p>
        <p className={`text-[12px] font-heading font-bold ${colorMap[accent] || "text-white/80"}`}>{value ?? "—"}</p>
      </div>
    </div>
  );
}

export default function RiskControl({ risk }) {
  const r = risk || {};
  const entriesAllowed = r.new_entries_allowed === true || r.new_entries_allowed === "Yes";
  const progressPct = r.daily_profit_target > 0 ? Math.min(100, Math.round((r.daily_profit_progress / r.daily_profit_target) * 100)) : 0;

  return (
    <div>
      <h2 className="font-heading font-black text-sm text-white uppercase tracking-widest mb-3">Risk Control</h2>
      <GlassCard className="space-y-3">
        {/* Profit target progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-white/40 font-body">Daily Profit Progress</span>
            <span className="text-[11px] font-heading font-bold text-cyan-300">${r.daily_profit_progress ?? 0} / ${r.daily_profit_target ?? 0}</span>
          </div>
          <div className="h-2 rounded-full bg-black/40 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-green-400 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Metric icon={Target} label="Daily Target" value={`$${r.daily_profit_target ?? 0}`} accent="cyan" />
          <Metric icon={TrendingDown} label="Daily Loss Limit" value={`$${r.daily_loss_limit ?? 0}`} accent="red" />
          <Metric icon={BarChart3} label="Current Drawdown" value={`$${r.current_drawdown ?? 0}`} accent="amber" />
          <Metric icon={Flame} label="Consec. Losses" value={r.consecutive_losses ?? 0} accent="red" />
          <Metric icon={Snowflake} label="Cooldown" value={r.cooldown_status || "None"} accent="cyan" />
          <Metric icon={ShieldCheck} label="Max Trades/Day" value={r.max_trades_per_day ?? "—"} accent="white" />
          <Metric icon={BarChart3} label="Trades Today" value={r.trades_taken_today ?? 0} accent="white" />
        </div>

        {/* Entries allowed */}
        <div className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${entriesAllowed ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
          <div>
            <p className="text-[9px] text-white/40 uppercase tracking-wider font-body">New Entries Allowed</p>
            <p className={`text-sm font-heading font-black ${entriesAllowed ? "text-green-400" : "text-red-400"}`}>{entriesAllowed ? "Yes" : "No"}</p>
          </div>
          {!entriesAllowed && r.block_reason && (
            <p className="text-[9px] text-red-300/70 text-right max-w-[55%] leading-snug">{r.block_reason}</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}