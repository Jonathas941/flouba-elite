import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Shield, Lock, Edit3, Check, Power, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const TIER_META = {
  pre_target:    { label: "PRE-TARGET",   color: "#00FF41", desc: "Normal risk — trade freely" },
  tier_1:        { label: "TIER 1",       color: "#FFCC42", desc: "Risk reduced 50% — A+ only" },
  tier_2:        { label: "TIER 2",       color: "#FF8C42", desc: "Score ≥85 required — cautious" },
  final_reached: { label: "TARGET HIT",   color: "#00FF41", desc: "Locked — next NY day" },
  loss_stopped:  { label: "LOSS STOP",    color: "#FF3131", desc: "Capital protection active" },
};

const fmtMoney = (val) => {
  if (val == null) return "--";
  const n = Number(val);
  return (n >= 0 ? "+" : "-") + `$${Math.abs(n).toFixed(2)}`;
};

function TierBar({ label, target, current, color, isLoss }) {
  const pct = isLoss
    ? Math.min(100, Math.abs(Math.min(current, 0)) / target * 100)
    : Math.min(100, Math.max(0, current) / target * 100);
  const reached = isLoss ? current <= -target : current >= target;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-mono text-white/40 w-8 shrink-0">{label}</span>
      <div className="flex-1 h-4 relative overflow-hidden hud-clip-sm"
        style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${color}30` }}>
        <motion.div className="h-full"
          style={{ background: reached ? color : `${color}40`, boxShadow: reached ? `0 0 8px ${color}80` : "none" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }} />
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-bold text-white/90">
          {isLoss ? `-$${target}` : `$${target}`}
        </span>
      </div>
      <span className="text-[8px] font-mono w-12 shrink-0 text-right"
        style={{ color: reached ? color : "rgba(255,255,255,0.5)" }}>
        {reached ? "✓" : `${pct.toFixed(0)}%`}
      </span>
    </div>
  );
}

function EditableField({ label, value, onChange, step, min, prefix }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-[10px] font-mono text-white/50">{prefix}</span>}
        <input type="number" value={value} step={step} min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-black/50 border border-[#00FF41]/20 rounded px-2 py-1 text-[12px] font-mono font-bold text-white focus:outline-none focus:border-[#00FF41]/50" />
      </div>
    </div>
  );
}

export default function DynamicDailyTargetPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("dynamicDailyTargetEngine", {});
      if (res?.data?.ok) setStatus(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleToggle = async () => {
    try {
      const res = await base44.functions.invoke("dynamicDailyTargetEngine", {
        action: "toggle",
        enabled: !status?.enabled,
      });
      if (res?.data?.ok) {
        setStatus(res.data);
        toast({
          title: res.data.enabled ? "DDT Enabled" : "DDT Disabled",
          description: res.data.enabled ? "Dynamic Daily Target strategy is now active." : "Dynamic Daily Target strategy is off.",
          duration: 3000,
        });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 3000 });
    }
  };

  const startEdit = () => {
    if (!status?.targets) return;
    setEditForm({
      target_1: status.targets.target_1,
      target_2: status.targets.target_2,
      target_final: status.targets.target_final,
      hard_loss_stop: status.targets.hard_loss_stop,
      max_trades: status.limits.max_trades,
      max_open_positions: status.limits.max_open_positions,
      stop_after_losses: status.limits.stop_after_losses,
      risk_reduction_pct: status.limits.risk_reduction_pct,
      min_strategy_score_tier2: status.limits.min_strategy_score_tier2,
      account_mode: status.account_mode || "Aggressive Scalping",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("dynamicDailyTargetEngine", {
        action: "update_settings",
        settings: editForm,
      });
      if (res?.data?.ok) {
        setStatus(res.data);
        setEditing(false);
        toast({ title: "Targets Updated", description: "Daily target settings saved.", duration: 3000 });
      }
    } catch (e) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive", duration: 3000 });
    }
    setSaving(false);
  };

  const set = (key) => (val) => setEditForm((f) => ({ ...f, [key]: val }));

  const handleReset = async () => {
    try {
      const res = await base44.functions.invoke("dynamicDailyTargetEngine", { action: "reset" });
      if (res?.data?.ok) {
        setStatus(res.data);
        toast({ title: "Daily Limits Reset", description: "Realized P&L, trades, and losses cleared.", duration: 3000 });
      }
    } catch (e) {
      toast({ title: "Reset Failed", description: e.message, variant: "destructive", duration: 3000 });
    }
  };

  if (loading) {
    return (
      <div className="hud-clip p-4 flex items-center justify-center"
        style={{ background: "rgba(11,18,22,0.55)", border: "1px solid rgba(0,255,65,0.15)" }}>
        <div className="w-5 h-5 border-2 border-[#00FF41]/30 border-t-[#00FF41] rounded-full animate-spin" />
      </div>
    );
  }

  const enabled = status?.enabled;
  const tier = status?.tier || "pre_target";
  const tierMeta = TIER_META[tier];
  const locked = status?.lock_message;
  const realized = status?.realized_today ?? 0;
  const tradesToday = status?.trades_today ?? 0;
  const consecLosses = status?.consecutive_losses ?? 0;

  return (
    <div className="hud-clip"
      style={{
        background: "rgba(11,18,22,0.6)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${enabled ? `${tierMeta.color}30` : "rgba(255,255,255,0.08)"}`,
        boxShadow: enabled ? `0 0 16px ${tierMeta.color}10` : "none",
      }}>

      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3" style={{ background: tierMeta.color, boxShadow: `0 0 5px ${tierMeta.color}80` }} />
          <span className="text-[9px] font-mono font-bold uppercase tracking-[0.22em]" style={{ color: `${tierMeta.color}CC` }}>
            Dynamic Daily Target
          </span>
        </div>
        <button onClick={handleToggle}
          className="flex items-center gap-1 px-2 py-1 hud-clip-sm transition-all"
          style={{
            background: enabled ? "rgba(0,255,65,0.1)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${enabled ? "rgba(0,255,65,0.3)" : "rgba(255,255,255,0.1)"}`,
          }}>
          <Power className="w-3 h-3" style={{ color: enabled ? "#00FF41" : "rgba(255,255,255,0.4)" }} />
          <span className="text-[8px] font-mono font-bold" style={{ color: enabled ? "#00FF41" : "rgba(255,255,255,0.4)" }}>
            {enabled ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      <div className="h-px mx-4" style={{ background: `linear-gradient(to right, ${tierMeta.color}30, transparent)` }} />

      {enabled ? (
        <div className="px-4 py-3 space-y-3">

          {/* Realized P&L + stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[8px] font-mono text-white/35 uppercase tracking-wider">Realized</p>
              <p className="font-mono font-bold text-sm"
                style={{ color: realized >= 0 ? "#00FF41" : "#FF3131", textShadow: `0 0 6px ${realized >= 0 ? "rgba(0,255,65,0.4)" : "rgba(255,49,49,0.4)"}` }}>
                {fmtMoney(realized)}
              </p>
            </div>
            <div className="text-center border-x border-white/5">
              <p className="text-[8px] font-mono text-white/35 uppercase tracking-wider">Trades</p>
              <p className="font-mono font-bold text-sm text-white">
                {tradesToday}<span className="text-white/30 text-[10px]">/{status?.limits?.max_trades ?? 3}</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-mono text-white/35 uppercase tracking-wider">Losses</p>
              <p className="font-mono font-bold text-sm"
                style={{ color: consecLosses >= (status?.limits?.stop_after_losses ?? 2) ? "#FF3131" : "rgba(255,255,255,0.8)" }}>
                {consecLosses}<span className="text-white/30 text-[10px]">/{status?.limits?.stop_after_losses ?? 2}</span>
              </p>
            </div>
          </div>

          {/* Tier progress bars */}
          <div className="space-y-1.5 pt-1">
            <TierBar label="T1" target={status?.targets?.target_1 ?? 75} current={realized} color="#FFCC42" />
            <TierBar label="T2" target={status?.targets?.target_2 ?? 120} current={realized} color="#FF8C42" />
            <TierBar label="FIN" target={status?.targets?.target_final ?? 200} current={realized} color="#00FF41" />
            <TierBar label="LOSS" target={status?.targets?.hard_loss_stop ?? 60} current={realized} color="#FF3131" isLoss />
          </div>

          {/* Current tier badge */}
          <div className="flex items-center gap-2 px-3 py-2 hud-clip-sm"
            style={{ background: `${tierMeta.color}10`, border: `1px solid ${tierMeta.color}30` }}>
            <div className="w-6 h-6 flex items-center justify-center shrink-0"
              style={{ background: `${tierMeta.color}15` }}>
              {tier === "final_reached" || tier === "loss_stopped"
                ? <Lock className="w-3 h-3" style={{ color: tierMeta.color }} />
                : <Target className="w-3 h-3" style={{ color: tierMeta.color }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono font-bold tracking-wider" style={{ color: tierMeta.color }}>{tierMeta.label}</p>
              <p className="text-[8px] font-mono text-white/40 truncate">{status?.tier_note || tierMeta.desc}</p>
            </div>
            {status?.risk_multiplier < 1 && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,204,66,0.15)", color: "#FFCC42" }}>
                RISK ×{status.risk_multiplier.toFixed(1)}
              </span>
            )}
          </div>

          {/* Lock message */}
          <AnimatePresence>
            {locked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 hud-clip-sm"
                  style={{
                    background: tier === "loss_stopped" ? "rgba(255,49,49,0.1)" : "rgba(0,255,65,0.08)",
                    border: tier === "loss_stopped" ? "1px solid rgba(255,49,49,0.35)" : "1px solid rgba(0,255,65,0.3)",
                  }}>
                  <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: tier === "loss_stopped" ? "#FF3131" : "#00FF41" }} />
                  <p className="text-[9px] font-mono font-bold" style={{ color: tier === "loss_stopped" ? "#FF3131" : "#00FF41" }}>
                    {locked}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Editable targets */}
          <AnimatePresence>
            {editing ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <EditableField label="Target 1 ($)" value={editForm.target_1} onChange={set("target_1")} step={5} min={1} />
                  <EditableField label="Target 2 ($)" value={editForm.target_2} onChange={set("target_2")} step={5} min={1} />
                  <EditableField label="Final Target ($)" value={editForm.target_final} onChange={set("target_final")} step={10} min={1} />
                  <EditableField label="Hard Loss Stop ($)" value={editForm.hard_loss_stop} onChange={set("hard_loss_stop")} step={5} min={1} />
                  <EditableField label="Max Trades" value={editForm.max_trades} onChange={set("max_trades")} step={1} min={1} />
                  <EditableField label="Max Positions" value={editForm.max_open_positions} onChange={set("max_open_positions")} step={1} min={1} />
                  <EditableField label="Stop After Losses" value={editForm.stop_after_losses} onChange={set("stop_after_losses")} step={1} min={1} />
                  <EditableField label="Risk Reduction %" value={editForm.risk_reduction_pct} onChange={set("risk_reduction_pct")} step={5} min={0} max={100} />
                  <EditableField label="Min Score (T2)" value={editForm.min_strategy_score_tier2} onChange={set("min_strategy_score_tier2")} step={5} min={0} max={100} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving}
                    className="flex-1 h-8 hud-clip-sm flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold tracking-wider disabled:opacity-50"
                    style={{ background: "rgba(0,255,65,0.1)", border: "1px solid rgba(0,255,65,0.35)", color: "#00FF41" }}>
                    {saving ? <div className="w-3 h-3 border-2 border-[#00FF41]/40 border-t-[#00FF41] rounded-full animate-spin" /> : <><Check className="w-3 h-3" /> SAVE</>}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="h-8 px-4 hud-clip-sm text-[10px] font-mono font-bold tracking-wider"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                    CANCEL
                  </button>
                </div>
              </motion.div>
            ) : (
              <button onClick={startEdit}
                className="w-full h-8 hud-clip-sm flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold tracking-wider transition-all"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                <Edit3 className="w-3 h-3" /> EDIT TARGETS
              </button>
            )}
          </AnimatePresence>

          {/* Reset info */}
          <div className="flex items-center justify-between text-[8px] font-mono text-white/25">
            <span>RESET: NY 08:00 ET</span>
            <span>NY DATE: {status?.ny_date || "--"}</span>
          </div>
          <button onClick={handleReset}
            className="w-full h-8 hud-clip-sm flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold tracking-wider transition-all active:scale-[0.98]"
            style={{ background: "rgba(255,49,49,0.06)", border: "1px solid rgba(255,49,49,0.25)", color: "#FF3131" }}>
            <RotateCcw className="w-3 h-3" /> RESET DAILY LIMITS
          </button>
        </div>
      ) : (
        <div className="px-4 py-4 text-center">
          <p className="text-[10px] font-mono text-white/35 leading-relaxed">
            Tiered daily target strategy with progressive risk reduction and capital protection.
          </p>
          <p className="text-[9px] font-mono text-white/25 mt-1">
            $75 → $120 → $200 targets · -$60 hard stop · 3 trades max
          </p>
        </div>
      )}
    </div>
  );
}