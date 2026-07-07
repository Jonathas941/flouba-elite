import React, { useState, useEffect } from "react";
import { Settings as Cog, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD"];

export default function LSR3RSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const load = async () => {
    try {
      const res = await base44.functions.invoke("lsr3rScanner", { action: "settings" });
      if (res?.data?.ok) {
        setSettings(res.data.settings);
        setForm(res.data.settings);
      }
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const set = (key) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: key.includes("pct") || key.includes("mult") || key.includes("offset") || key.includes("minutes") || key.includes("trades") || key.includes("losses") || key.includes("reward") || key.includes("spread") ? Number(val) : val }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("lsr3rScanner", { action: "update_settings", settings: form });
      if (res?.data?.ok) {
        setSettings(res.data.settings);
        toast({ title: "Settings Saved", duration: 2000 });
      }
    } catch (e) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#FFCC42]/30 border-t-[#FFCC42] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Cog className="w-4 h-4" style={{ color: "#FFCC42" }} />
        <h2 className="text-sm font-heading font-bold tracking-wider text-white uppercase">LSR-3R Settings</h2>
      </div>

      <Card title="Symbols & Markets">
        <Field label="Active Symbol">
          <select value={form.symbol || "XAUUSD"} onChange={set("symbol")}
            className="w-full bg-transparent text-white text-sm font-mono outline-none">
            {SYMBOLS.map((s) => <option key={s} value={s} className="bg-[#0d0d0d]">{s}</option>)}
          </select>
        </Field>
      </Card>

      <Card title="Risk Management">
        <NumField label="Risk per Trade (%)" value={form.risk_per_trade_pct} onChange={set("risk_per_trade_pct")} step={0.1} />
        <NumField label="Max Daily Loss (%)" value={form.max_daily_loss_pct} onChange={set("max_daily_loss_pct")} step={0.1} />
        <NumField label="Max Trades per Day" value={form.max_trades_per_day} onChange={set("max_trades_per_day")} />
        <NumField label="Max Consecutive Losses" value={form.max_consecutive_losses} onChange={set("max_consecutive_losses")} />
        <NumField label="Risk Reward (1:x)" value={form.risk_reward} onChange={set("risk_reward")} />
        <ToggleField label="One Trade per Anchor Session" value={form.one_trade_per_anchor} onChange={set("one_trade_per_anchor")} />
        <p className="text-[9px] text-white/30 mt-1">No martingale · No grid · No lot doubling after loss</p>
      </Card>

      <Card title="Anchor Times (GMT+8)">
        <Field label="Anchor Time 1">
          <input type="time" value={form.anchor_time_1 || "14:00"} onChange={set("anchor_time_1")}
            className="w-full bg-transparent text-white text-sm font-mono outline-none" />
        </Field>
        <Field label="Anchor Time 2">
          <input type="time" value={form.anchor_time_2 || "20:00"} onChange={set("anchor_time_2")}
            className="w-full bg-transparent text-white text-sm font-mono outline-none" />
        </Field>
        <NumField label="Anchor Timezone Offset (GMT)" value={form.anchor_timezone_offset} onChange={set("anchor_timezone_offset")} step={1} />
        <NumField label="Setup Expiry (minutes)" value={form.setup_expiry_minutes} onChange={set("setup_expiry_minutes")} />
        <NumField label="FVG Entry Expiry (minutes)" value={form.fvg_entry_expiry_minutes} onChange={set("fvg_entry_expiry_minutes")} />
      </Card>

      <Card title="Technical Filters">
        <ToggleField label="Spread Filter" value={form.spread_filter_enabled} onChange={set("spread_filter_enabled")} />
        <NumField label="Max Spread % of SL" value={form.max_spread_pct_of_sl} onChange={set("max_spread_pct_of_sl")} step={1} />
        <ToggleField label="News Filter" value={form.news_filter_enabled} onChange={set("news_filter_enabled")} />
        <NumField label="Sweep Buffer (×ATR)" value={form.sweep_buffer_atr_mult} onChange={set("sweep_buffer_atr_mult")} step={0.01} />
        <NumField label="SL Buffer (×ATR)" value={form.sl_buffer_atr_mult} onChange={set("sl_buffer_atr_mult")} step={0.01} />
        <NumField label="Min FVG Size (×ATR)" value={form.min_fvg_size_atr_mult} onChange={set("min_fvg_size_atr_mult")} step={0.01} />
        <NumField label="Min Break Body (×ATR)" value={form.min_break_body_atr_mult} onChange={set("min_break_body_atr_mult")} step={0.05} />
        <NumField label="Min SL Distance (×ATR M5)" value={form.min_sl_distance_atr_mult_m5} onChange={set("min_sl_distance_atr_mult_m5")} step={0.05} />
        <NumField label="Max SL Distance (×ATR M5)" value={form.max_sl_distance_atr_mult_m5} onChange={set("max_sl_distance_atr_mult_m5")} step={0.05} />
      </Card>

      <Card title="Mode & Notifications">
        <ToggleField label="Safe Mode" value={form.safe_mode} onChange={set("safe_mode")} />
        <ToggleField label="Notifications" value={form.notifications_enabled} onChange={set("notifications_enabled")} />
        <ToggleField label="Demo Mode" value={form.demo_mode} onChange={set("demo_mode")} />
        <p className="text-[9px] text-white/30 mt-1">
          {form.demo_mode ? "Demo: signals are for journaling only, no live trades." : "Live: secure MT5 API/webhook required for auto-trading."}
        </p>
      </Card>

      <button onClick={save} disabled={saving}
        className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-heading font-black text-sm tracking-widest disabled:opacity-50"
        style={{ background: "rgba(255,204,66,0.95)", color: "#0a0a0a" }}>
        {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? "SAVING..." : "SAVE SETTINGS"}
      </button>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-[10px] font-heading font-bold tracking-wider uppercase" style={{ color: "#FFCC42" }}>{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[9px] text-white/40 uppercase tracking-wider font-heading mb-1">{label}</p>
      <div className="rounded-lg px-3 py-2" style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.06)" }}>{children}</div>
    </div>
  );
}

function NumField({ label, value, onChange, step = 1 }) {
  return (
    <Field label={label}>
      <input type="number" value={value ?? 0} onChange={onChange} step={step}
        className="w-full bg-transparent text-white text-sm font-mono outline-none" />
    </Field>
  );
}

function ToggleField({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-white/70">{label}</span>
      <button onClick={() => onChange({ target: { type: "checkbox", checked: !value } })}
        className="w-11 h-6 rounded-full transition-all flex items-center"
        style={{ background: value ? "#FFCC42" : "rgba(255,255,255,0.10)" }}>
        <div className="w-5 h-5 rounded-full bg-white shadow transition-all" style={{ marginLeft: value ? "22px" : "2px" }} />
      </button>
    </div>
  );
}