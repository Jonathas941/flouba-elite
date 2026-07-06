import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import {
  Activity, TrendingUp, Waves, Layers, Target, Clock, Pause,
  ShieldAlert, ChevronDown, ChevronUp, Zap,
} from "lucide-react";

const REGIME_TONE = {
  Trending: { color: "#5fe8ff", icon: TrendingUp, label: "Trending" },
  "Liquidity Sweep": { color: "#b388ff", icon: Waves, label: "Liquidity Sweep" },
  Range: { color: "#9aa7b5", icon: Activity, label: "Range" },
  "High Spread": { color: "#ff6b6b", icon: ShieldAlert, label: "High Spread" },
  "Session Closed": { color: "#ff6b6b", icon: Pause, label: "Session Closed" },
};

const STRATS = [
  { key: "swing", label: "Swing Trend Pullback", accent: "#5fe8ff", name: "Swing Trend Pullback Continuation 2026" },
  { key: "smc", label: "SMC Liquidity Sweep", accent: "#b388ff", name: "Liquidity Sweep Scalping" },
  { key: "tpr", label: "EMA Trend Recovery", accent: "#ffce4d", name: "EMA Trend Progressive Recovery" },
  { key: "gdb", label: "Gold Daily Breakout", accent: "#ffb347", name: "Gold Daily Breakout" },
];

function fmtET(d) {
  if (!d) return "--";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: true,
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}
function countdown(iso) {
  if (!iso) return "--";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function AdaptiveStrategyPanel({ connected }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [metrics, setMetrics] = useState({ swing: null, smc: null, tpr: null, gdb: null });
  const [lastSwitch, setLastSwitch] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showSwitchLog, setShowSwitchLog] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [stg, mtr, sw] = await Promise.all([
        base44.entities.BotSettings.list("-created_date", 1).catch(() => []),
        base44.entities.StrategyMetrics.list("-created_date", 50).catch(() => []),
        base44.entities.StrategySwitchLog.list("-created_date", 1).catch(() => []),
      ]);
      setSettings(stg?.[0] || null);
      const map = { swing: null, smc: null, tpr: null, gdb: null };
      for (const m of mtr || []) {
        if (map[m.strategy_key] !== undefined) map[m.strategy_key] = m;
      }
      setMetrics(map);
      setLastSwitch(sw?.[0] || null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  const s = settings || {};
  const regime = s.adaptive_market_regime || (connected ? "Range" : "Session Closed");
  const rt = REGIME_TONE[regime] || REGIME_TONE.Range;
  const RegimeIcon = rt.icon;
  const active = s.adaptive_active_strategy || "Swing Trend Pullback Continuation 2026";
  const activeShort = STRATS.find((x) => x.name === active)?.label || "Swing Pullback";
  const reason = s.adaptive_reason || "Adaptive manager idle.";
  const targetReached = s.adaptive_daily_target_reached === true;
  const pendStrategy = s.adaptive_pending_strategy;
  const pendBars = s.adaptive_pending_bars || 0;

  const realizedToday = STRATS.reduce((sum, st) => sum + (metrics[st.key]?.profit_today || 0), 0);
  const targetAmount = s.daily_profit_target_amount ?? 100;
  const targetPct = s.daily_profit_target_percent ?? 0;
  const balance = s.balance || 0;
  const effectiveTarget = targetPct > 0 && balance > 0 ? (targetPct / 100) * balance : targetAmount;
  const targetPctVal = effectiveTarget > 0 ? Math.min(100, Math.max(0, (realizedToday / effectiveTarget) * 100)) : 0;

  const updateField = async (patch, msg) => {
    setSaving(true);
    try {
      if (s.id) await base44.entities.BotSettings.update(s.id, patch);
      else { const c = await base44.entities.BotSettings.create(patch); setSettings({ ...s, id: c.id, ...patch }); }
      if (msg) toast({ title: msg, duration: 2000 });
      await load();
    } catch { toast({ title: "Update failed", variant: "destructive", duration: 2000 }); }
    setSaving(false);
  };

  const runNow = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("adaptiveStrategyManager", {});
      if (res?.data?.ok) {
        toast({ title: "Adaptive engine evaluated", description: res.data.results?.[0]?.reason || "Cycle complete.", duration: 3000 });
        await load();
      } else {
        toast({ title: "Engine unavailable", description: res?.data?.error || "Try again later.", variant: "destructive", duration: 3000 });
      }
    } catch { toast({ title: "Engine unavailable", variant: "destructive", duration: 2000 }); }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(95,232,255,0.12)", border: "1px solid rgba(95,232,255,0.3)" }}>
              <Layers className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-black text-white tracking-wide leading-tight">ADAPTIVE STRATEGY MANAGER</h3>
              <p className="text-[10px] text-white/40">SMC Liquidity Sweep ⇄ Swing Trend Pullback</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${s.adaptive_enabled ? "bg-[#00ff9d] animate-pulse" : "bg-white/30"}`} />
            <span className="text-[9px] font-heading tracking-widest text-white/50">{s.adaptive_enabled ? "ACTIVE" : "OFF"}</span>
          </div>
        </div>

        {/* Live reason banner */}
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-start gap-2"
          style={{ background: targetReached ? "rgba(255,206,77,0.08)" : "rgba(95,232,255,0.07)",
                   border: `1px solid ${targetReached ? "rgba(255,206,77,0.25)" : "rgba(95,232,255,0.25)"}` }}>
          {targetReached ? <Target className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> : <Activity className="w-4 h-4 text-cyan-300 mt-0.5 shrink-0" />}
          <p className="text-[11px] font-heading tracking-wide text-white/85 leading-snug">{reason}</p>
        </div>

        {/* Regime + active strategy */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <div className="rounded-xl px-3 py-2.5" style={{ background: `${rt.color}12`, border: `1px solid ${rt.color}44` }}>
            <p className="text-[8px] uppercase tracking-[0.2em] text-white/45 font-heading">Market Regime</p>
            <div className="flex items-center gap-1.5 mt-1">
              <RegimeIcon className="w-3.5 h-3.5" style={{ color: rt.color }} />
              <p className="font-heading font-bold text-[12px]" style={{ color: rt.color }}>{rt.label}</p>
            </div>
          </div>
          <div className="rounded-xl px-3 py-2.5 bg-white/5 border border-white/10">
            <p className="text-[8px] uppercase tracking-[0.2em] text-white/45 font-heading">Active Strategy</p>
            <p className="font-heading font-bold text-[11px] text-white mt-1 leading-tight">{activeShort}</p>
          </div>
        </div>

        {/* Strategy score cards */}
        <div className="px-4 pt-3 space-y-2">
          {STRATS.map((st) => (
            <ScoreRow key={st.key} label={st.label} short={st.short} metric={metrics[st.key]} accent={st.accent} active={active === st.name} pend={pendStrategy === st.name} pendBars={pendBars} barsConfirm={s.adaptive_bars_confirm ?? 3} />
          ))}
        </div>

        {/* Daily profit target progress */}
        <div className="px-4 pt-3">
          <div className="rounded-xl px-3 py-2.5 bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-[10px] font-heading tracking-wider text-white/70">DAILY PROFIT TARGET</p>
              </div>
              <p className="text-[10px] font-heading font-bold text-white/80">
                ${realizedToday.toFixed(2)} / ${effectiveTarget.toFixed(0)}
              </p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/8 overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: targetReached ? "#ffce4d" : "linear-gradient(90deg,#5fe8ff,#00b4ff)" }}
                animate={{ width: `${targetPctVal}%` }} transition={{ duration: 0.5 }} />
            </div>
            {targetReached && (
              <p className="text-[10px] text-amber-300 mt-1.5 font-heading">Daily Profit Target Reached — Trading Paused Until Next Trading Day.</p>
            )}
          </div>
        </div>

        {/* Cooldown chips */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <CooldownChip label="Swing Cooldown" until={metrics.swing?.cooldown_until} />
          <CooldownChip label="SMC Cooldown" until={metrics.smc?.cooldown_until} />
          <CooldownChip label="TPR Cooldown" until={metrics.tpr?.cooldown_until} />
          <CooldownChip label="Global Cooldown" until={s.adaptive_global_cooldown_until} wide />
        </div>

        {/* Last switch log */}
        <button onClick={() => setShowSwitchLog((v) => !v)} className="w-full flex items-center justify-between px-4 pt-3 text-left">
          <span className="text-[10px] font-heading tracking-wider text-white/50">LAST STRATEGY SWITCH</span>
          {showSwitchLog ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
        </button>
        {showSwitchLog && (
          <div className="mx-4 mt-2 rounded-xl px-3 py-2.5 bg-white/5 border border-white/10 text-[10px] space-y-1">
            {lastSwitch ? (
              <>
                <div className="flex justify-between"><span className="text-white/40">Time (ET)</span><span className="text-white/80 font-heading">{fmtET(lastSwitch.created_date)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">From</span><span className="text-white/80">{lastSwitch.from_strategy}</span></div>
                <div className="flex justify-between"><span className="text-white/40">To</span><span className="text-white/80">{lastSwitch.to_strategy}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Regime</span><span className="text-white/80">{lastSwitch.regime}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Score</span><span className="text-white/80">{lastSwitch.from_score} → {lastSwitch.to_score}</span></div>
                <p className="text-white/55 pt-1 leading-snug">{lastSwitch.reason}</p>
              </>
            ) : <p className="text-white/40">No strategy switches recorded yet.</p>}
          </div>
        )}

        {/* Config */}
        <button onClick={() => setShowConfig((v) => !v)} className="w-full flex items-center justify-between px-4 pt-3 text-left">
          <span className="text-[10px] font-heading tracking-wider text-white/50">CONFIGURATION</span>
          {showConfig ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
        </button>
        {showConfig && (
          <div className="mx-4 mt-2 mb-4 space-y-3">
            <ToggleRow label="Adaptive Engine" value={s.adaptive_enabled} onChange={(v) => updateField({ adaptive_enabled: v }, v ? "Adaptive engine enabled" : "Adaptive engine disabled")} saving={saving} />
            <ToggleRow label="Daily Profit Target" value={s.daily_profit_target_enabled !== false} onChange={(v) => updateField({ daily_profit_target_enabled: v })} saving={saving} />
            <NumRow label="Target Amount ($)" value={s.daily_profit_target_amount ?? 100} onChange={(v) => updateField({ daily_profit_target_amount: v })} saving={saving} />
            <NumRow label="Target Percent (%)" value={s.daily_profit_target_percent ?? 0} onChange={(v) => updateField({ daily_profit_target_percent: v })} saving={saving} />
            <NumRow label="Min Score (0-100)" value={s.adaptive_min_score ?? 70} onChange={(v) => updateField({ adaptive_min_score: v })} saving={saving} />
            <NumRow label="Switch Threshold (pts)" value={s.adaptive_switch_threshold ?? 15} onChange={(v) => updateField({ adaptive_switch_threshold: v })} saving={saving} />
            <NumRow label="Confirm Bars" value={s.adaptive_bars_confirm ?? 3} onChange={(v) => updateField({ adaptive_bars_confirm: v })} saving={saving} />
          </div>
        )}

        {/* Run now */}
        <div className="px-4 pt-1 pb-4">
          <button onClick={runNow} disabled={saving}
            className="w-full h-10 rounded-xl font-heading font-bold tracking-widest text-[10px] text-cyan-300 active:scale-[0.98] transition-transform"
            style={{ background: "rgba(95,232,255,0.08)", border: "1px solid rgba(95,232,255,0.35)" }}>
            <span className="flex items-center justify-center gap-2"><Zap className="w-3.5 h-3.5" /> EVALUATE NOW</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ScoreRow({ label, short, metric, accent, active, pend, pendBars, barsConfirm }) {
  const score = metric?.score ?? 0;
  const enabled = metric?.enabled !== false;
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: active ? `${accent}10` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? `${accent}55` : "rgba(255,255,255,0.08)"}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {active && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />}
          <span className="text-[11px] font-heading font-bold text-white tracking-wide">{label}</span>
        </div>
        <span className="font-heading font-black text-[16px]" style={{ color: accent }}>{score}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: accent }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[9px] text-white/50">
        <span>WR {metric?.win_rate != null ? `${metric.win_rate}%` : "--"}</span>
        <span>P&L today {metric?.profit_today != null ? `${metric.profit_today >= 0 ? "+" : ""}$${metric.profit_today.toFixed(2)}` : "--"}</span>
        <span>Consec {metric?.consecutive_losses ?? 0}</span>
      </div>
      <div className="flex items-center justify-between mt-0.5 text-[9px]">
        {enabled ? <span className="text-[#00ff9d]">Eligible</span> : <span className="text-[#ff6b6b]">{metric?.status_message || "Blocked"}</span>}
        {pend && <span className="text-amber-400 font-heading">confirming {pendBars}/{barsConfirm}</span>}
      </div>
    </div>
  );
}

function CooldownChip({ label, until, wide }) {
  const active = until && new Date(until).getTime() > Date.now();
  return (
    <div className={`rounded-xl px-3 py-2 ${wide ? "col-span-2" : ""}`} style={{ background: active ? "rgba(255,206,77,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(255,206,77,0.25)" : "rgba(255,255,255,0.08)"}` }}>
      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3" style={{ color: active ? "#ffce4d" : "rgba(255,255,255,0.3)" }} />
        <p className="text-[8px] uppercase tracking-[0.18em] text-white/45 font-heading">{label}</p>
      </div>
      <p className="text-[11px] font-heading font-bold mt-0.5" style={{ color: active ? "#ffce4d" : "rgba(255,255,255,0.4)" }}>
        {active ? countdown(until) : "None"}
      </p>
    </div>
  );
}

function ToggleRow({ label, value, onChange, saving }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-white/70 font-heading tracking-wide">{label}</span>
      <button onClick={() => onChange(!value)} disabled={saving}
        className={`w-10 rounded-full flex items-center transition-colors relative ${value ? "bg-cyan-500" : "bg-white/10"}`}
        style={{ height: 22 }}>
        <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${value ? "ml-5" : "ml-0.5"}`} />
      </button>
    </div>
  );
}

function NumRow({ label, value, onChange, saving }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-white/70 font-heading tracking-wide shrink-0">{label}</span>
      <input type="number" value={value} disabled={saving}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 h-8 px-2 glass rounded-lg text-[11px] text-white text-right focus:outline-none focus:ring-1 focus:ring-cyan-500/40 bg-transparent" />
    </div>
  );
}