import React, { useState, useEffect } from "react";
import { Shield, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const LIMITS = [
  { key: "max_daily_drawdown",   label: "Max Daily Drawdown",   period: "Daily",   placeholder: "e.g. 100" },
  { key: "max_weekly_drawdown",  label: "Max Weekly Drawdown",  period: "Weekly",  placeholder: "e.g. 250" },
  { key: "max_monthly_drawdown", label: "Max Monthly Drawdown", period: "Monthly", placeholder: "e.g. 500" },
];

export default function DrawdownProtection() {
  const [limits, setLimits]     = useState({});
  const [settingsId, setId]     = useState(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    (async () => {
      const list = await base44.entities.BotSettings.list();
      if (list[0]) {
        setId(list[0].id);
        setLimits({
          max_daily_drawdown:   list[0].max_daily_drawdown   ?? "",
          max_weekly_drawdown:  list[0].max_weekly_drawdown  ?? "",
          max_monthly_drawdown: list[0].max_monthly_drawdown ?? "",
        });
      }
    })();
  }, []);

  const save = async () => {
    if (!settingsId) return;
    setSaving(true);
    await base44.entities.BotSettings.update(settingsId, {
      max_daily_drawdown:   parseFloat(limits.max_daily_drawdown)   || null,
      max_weekly_drawdown:  parseFloat(limits.max_weekly_drawdown)  || null,
      max_monthly_drawdown: parseFloat(limits.max_monthly_drawdown) || null,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-red-400" />
        <p className="font-heading font-bold text-sm text-white/80 uppercase tracking-wide">Account Protection</p>
      </div>
      <p className="text-[10px] text-white/30">Robot stops automatically when any drawdown limit is hit.</p>

      {LIMITS.map(({ key, label, placeholder }) => (
        <div key={key} className="rounded-xl px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[9px] uppercase tracking-widest text-white/30 font-heading mb-1.5">{label} ($)</p>
          <input
            type="number"
            inputMode="decimal"
            value={limits[key] ?? ""}
            onChange={(e) => setLimits((p) => ({ ...p, [key]: e.target.value }))}
            placeholder={placeholder}
            className="w-full bg-transparent font-heading font-bold text-sm text-white outline-none placeholder:text-white/15"
          />
        </div>
      ))}

      <button
        onClick={save}
        disabled={saving}
        className="w-full h-11 rounded-xl font-heading font-black text-xs tracking-widest text-white disabled:opacity-50"
        style={{ background: "rgba(220,38,38,0.8)", boxShadow: "0 0 20px rgba(220,38,38,0.2)" }}
      >
        {saving ? "SAVING…" : "SAVE PROTECTION LIMITS"}
      </button>

      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/6">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[9px] text-white/30 leading-relaxed">
          When a limit is reached the robot status is set to <span className="text-amber-400">Locked</span> and all trading stops until manually reset.
        </p>
      </div>
    </div>
  );
}