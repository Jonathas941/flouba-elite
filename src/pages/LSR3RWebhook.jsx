import React, { useState, useEffect } from "react";
import { Webhook, Link2, TestTube, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function LSR3RWebhook() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({});

  const load = async () => {
    try {
      const res = await base44.functions.invoke("lsr3rScanner", { action: "settings" });
      if (res?.data?.ok) { setSettings(res.data.settings); setForm(res.data.settings); }
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const set = (key) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("lsr3rScanner", { action: "update_settings", settings: form });
      if (res?.data?.ok) { setSettings(res.data.settings); toast({ title: "Webhook Config Saved", duration: 2000 }); }
    } catch (e) { toast({ title: "Save Failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke("mt5Bridge", { action: "account" });
      if (res?.data?.ok) {
        toast({ title: "Connection OK", description: "MT5 bridge reachable — account data received.", duration: 3000 });
      } else {
        toast({ title: "Connection Failed", description: res?.data?.error || "Bridge not reachable", variant: "destructive", duration: 4000 });
      }
    } catch (e) {
      toast({ title: "Connection Failed", description: e.message, variant: "destructive" });
    }
    setTesting(false);
  };

  const webhookUrl = form.webhook_enabled
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/base44/functions/lsr3rWebhook`
    : "";

  const lastUpdate = form.last_webhook_update ? new Date(form.last_webhook_update).toLocaleString() : null;

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
        <Webhook className="w-4 h-4" style={{ color: "#FFCC42" }} />
        <h2 className="text-sm font-heading font-bold tracking-wider text-white uppercase">MT5 Webhook Integration</h2>
      </div>

      {/* Status card */}
      <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: `1px solid ${form.webhook_enabled && form.last_webhook_update ? "rgba(0,255,65,0.20)" : "rgba(255,49,49,0.20)"}` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-heading font-bold tracking-wider uppercase text-white/60">Connection Status</span>
          <span className="text-[10px] font-heading font-bold px-2.5 py-1 rounded-full tracking-wider"
            style={{
              background: form.webhook_enabled && form.last_webhook_update ? "rgba(0,255,65,0.12)" : "rgba(255,49,49,0.12)",
              color: form.webhook_enabled && form.last_webhook_update ? "#00FF41" : "#FF3131",
            }}>
            {form.webhook_enabled && form.last_webhook_update ? "● CONNECTED" : "● DISCONNECTED"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Last Update" value={lastUpdate || "Never"} />
          <Stat label="Broker Server" value={form.broker_server || "--"} />
          <Stat label="Server Time" value={form.broker_server_time ? new Date(form.broker_server_time).toLocaleString() : "--"} />
          <Stat label="Account Mode" value={form.account_mode || "Demo"} accent={form.account_mode === "Live" ? "#FF3131" : "#FFCC42"} />
          <Stat label="Equity" value={form.account_equity ? `$${form.account_equity.toFixed(2)}` : "--"} />
          <Stat label="Balance" value={form.account_balance ? `$${form.account_balance.toFixed(2)}` : "--"} />
          <Stat label="Tick Value" value={form.tick_value?.toFixed(4) || "--"} />
          <Stat label="Tick Size" value={form.tick_size?.toFixed(5) || "--"} />
          <Stat label="Min Lot" value={form.min_lot?.toFixed(2) || "--"} />
          <Stat label="Lot Step" value={form.lot_step?.toFixed(2) || "--"} />
        </div>
      </div>

      {/* Webhook config */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "#0d0d0d", border: "1px solid rgba(255,204,66,0.10)" }}>
        <p className="text-[10px] font-heading font-bold tracking-wider uppercase" style={{ color: "#FFCC42" }}>Webhook Configuration</p>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/70">Enable Connection</span>
          <button onClick={() => set("webhook_enabled")({ target: { type: "checkbox", checked: !form.webhook_enabled } })}
            className="w-11 h-6 rounded-full transition-all flex items-center"
            style={{ background: form.webhook_enabled ? "#FFCC42" : "rgba(255,255,255,0.10)" }}>
            <div className="w-5 h-5 rounded-full bg-white shadow transition-all" style={{ marginLeft: form.webhook_enabled ? "22px" : "2px" }} />
          </button>
        </div>

        <Field label="Webhook URL (EA → App)">
          <input type="text" value={webhookUrl} readOnly
            className="w-full bg-transparent text-white text-[11px] font-mono outline-none" placeholder="Enable to generate URL" />
        </Field>

        <Field label="Webhook Secret">
          <input type="text" value={form.webhook_secret || ""} onChange={set("webhook_secret")}
            className="w-full bg-transparent text-white text-sm font-mono outline-none" placeholder="Enter a secret key" />
        </Field>

        <Field label="Account ID">
          <input type="text" value={form.account_id || ""} onChange={set("account_id")}
            className="w-full bg-transparent text-white text-sm font-mono outline-none" placeholder="MT5 account number" />
        </Field>

        <Field label="Broker Server">
          <input type="text" value={form.broker_server || ""} onChange={set("broker_server")}
            className="w-full bg-transparent text-white text-sm font-mono outline-none" placeholder="e.g. ICMarkets-Demo" />
        </Field>
      </div>

      {/* Buttons */}
      <div className="flex gap-2.5">
        <button onClick={testConnection} disabled={testing}
          className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 font-heading font-bold text-xs tracking-wider disabled:opacity-50"
          style={{ background: "#0d0d0d", border: "1px solid rgba(0,229,255,0.25)", color: "#00E5FF" }}>
          {testing ? <div className="w-4 h-4 border-2 border-[#00E5FF]/30 border-t-[#00E5FF] rounded-full animate-spin" /> : <TestTube className="w-4 h-4" />}
          TEST
        </button>
        <button onClick={save} disabled={saving}
          className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 font-heading font-black text-xs tracking-widest disabled:opacity-50"
          style={{ background: "rgba(255,204,66,0.95)", color: "#0a0a0a" }}>
          {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Link2 className="w-4 h-4" />}
          SAVE
        </button>
      </div>

      {/* Expected data format */}
      <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5" style={{ color: "#FFCC42" }} />
          <p className="text-[10px] font-heading font-bold tracking-wider uppercase" style={{ color: "#FFCC42" }}>Expected MT5 Data</p>
        </div>
        <p className="text-[10px] text-white/40 leading-relaxed mb-2">The EA should POST JSON with these fields to the Webhook URL:</p>
        <div className="rounded-lg p-2.5 font-mono text-[10px] text-white/60" style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.04)" }}>
          {"{ symbol, bid, ask, spread,\n  server_time, open_positions,\n  account_equity, balance,\n  tick_value, tick_size,\n  minimum_lot, lot_step,\n  account_id, webhook_secret }"}
        </div>
      </div>

      <div className="rounded-2xl p-3.5 flex items-start gap-2" style={{ background: "rgba(255,204,66,0.05)", border: "1px solid rgba(255,204,66,0.15)" }}>
        <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#FFCC42" }} />
        <p className="text-[10px] text-white/50 leading-relaxed">
          The app does not place automatic trades unless a secure MT5 API/webhook connection is configured. In Demo mode, signals are journal-only.
        </p>
      </div>
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

function Stat({ label, value, accent }) {
  return (
    <div>
      <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading mb-0.5">{label}</p>
      <p className="text-xs font-mono font-bold" style={{ color: accent || "#ffffff" }}>{value}</p>
    </div>
  );
}