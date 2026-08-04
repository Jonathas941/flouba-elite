import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { Activity, Webhook, Copy, Trash2, Send, BookOpen, Wifi, WifiOff, Zap } from "lucide-react";
import { motion } from "framer-motion";

const TV_JSON_TEMPLATE = `{
  "secret": "{{WEBHOOK_SECRET}}",
  "alert_id": "{{strategy.order.id}}-{{time}}",
  "symbol": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "quantity": "{{strategy.order.contracts}}",
  "price": "{{close}}",
  "strategy_position": "{{strategy.position_size}}",
  "stop_loss": null,
  "take_profit": null,
  "timestamp": "{{timenow}}"
}`;

export default function TradingView() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [botSettings, setBotSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tvList, botList, alertList] = await Promise.all([
        base44.entities.TradingViewSettings.list(),
        base44.entities.BotSettings.list(),
        base44.entities.TradingViewAlert.list("-created_date", 10),
      ]);

      let tv = tvList?.[0];
      if (!tv) {
        tv = await base44.entities.TradingViewSettings.create({
          auto_trading_enabled: false,
          trading_mode: "test",
          lot_size_mode: "alert_quantity",
          fixed_lot_size: 0.01,
          allowed_symbols: "XAUUSD",
          max_lot_size: 0.1,
          max_open_trades: 3,
          stop_loss_required: false,
          take_profit_required: false,
        });
      }

      setSettings(tv);
      setBotSettings(botList?.[0] || null);
      setAlerts(alertList || []);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateField = async (field, value) => {
    if (!settings) return;
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await base44.entities.TradingViewSettings.update(settings.id, {
        auto_trading_enabled: settings.auto_trading_enabled,
        trading_mode: settings.trading_mode,
        lot_size_mode: settings.lot_size_mode,
        fixed_lot_size: Number(settings.fixed_lot_size),
        allowed_symbols: settings.allowed_symbols,
        max_lot_size: Number(settings.max_lot_size),
        max_open_trades: Number(settings.max_open_trades),
        stop_loss_required: settings.stop_loss_required,
        take_profit_required: settings.take_profit_required,
      });
      toast({ title: "Saved", description: "TradingView settings updated." });
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testWebhook = async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke("tradingViewWebhook", { __test: true });
      const data = res?.data || res;
      if (data?.success) {
        toast({ title: "Test Successful", description: data.message || "Webhook received successfully." });
      } else {
        toast({ title: "Test Failed", description: data?.message || data?.error || "Webhook failed.", variant: "destructive" });
      }
      await loadData();
    } catch (err) {
      toast({ title: "Test Failed", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const clearLogs = async () => {
    try {
      const all = await base44.entities.TradingViewAlert.list("-created_date", 100);
      for (const a of (all || [])) {
        await base44.entities.TradingViewAlert.delete(a.id);
      }
      setAlerts([]);
      toast({ title: "Cleared", description: "Alert logs cleared." });
    } catch (err) {
      toast({ title: "Clear failed", description: err.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    });
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF3131]/30 border-t-[#FF3131] rounded-full animate-spin" />
      </div>
    );
  }

  const webhookUrl = `${window.location.origin}/api/functions/tradingViewWebhook/${settings.created_by_id || settings.created_by}`;
  const mt5Connected = !!botSettings?.mt5_account;
  const connectionStatus = botSettings?.connection_status || "Disconnected";
  const lastAlert = alerts?.[0]?.created_date;

  return (
    <div className="min-h-screen px-4 pt-6 pb-28 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-white tracking-wider">TRADINGVIEW</h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Webhook Integration</p>
        </div>
        <Activity className="w-6 h-6 text-[#FF3131]" />
      </div>

      {/* A. Connection Status */}
      <GlassCard className="p-4 space-y-3">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider mb-2">Connection Status</h2>
        <div className="grid grid-cols-2 gap-2">
          <StatusChip
            label="Webhook"
            value={settings.auto_trading_enabled ? "Active" : "Inactive"}
            active={settings.auto_trading_enabled}
          />
          <StatusChip
            label="MT5"
            value={mt5Connected ? "Connected" : "Disconnected"}
            active={mt5Connected}
          />
          <StatusChip
            label="Mode"
            value={settings.trading_mode === "live" ? "Live Trading" : "Test Mode"}
            active={settings.trading_mode === "live"}
          />
          <StatusChip
            label="Last Alert"
            value={lastAlert ? new Date(lastAlert).toLocaleTimeString() : "—"}
            active={false}
            small
          />
        </div>
      </GlassCard>

      {/* B. Webhook URL */}
      <GlassCard className="p-4 space-y-3">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Webhook className="w-3.5 h-3.5" /> Webhook URL
        </h2>
        <div className="bg-black/40 rounded-lg p-3 border border-white/5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Your unique webhook URL</p>
          <p className="text-[11px] text-[#00FF41] font-mono break-all leading-relaxed">{webhookUrl}</p>
        </div>
        <Button
          onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
          className="w-full bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
          size="sm"
        >
          <Copy className="w-3.5 h-3.5 mr-2" /> Copy Webhook URL
        </Button>
      </GlassCard>

      {/* C. Trading Settings */}
      <GlassCard className="p-4 space-y-4">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider mb-2">Trading Settings</h2>

        {/* Auto Trading Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-white">Auto Trading</Label>
            <p className="text-[10px] text-white/30">Enable to execute alerts as trades</p>
          </div>
          <Switch
            checked={settings.auto_trading_enabled}
            onCheckedChange={(v) => updateField("auto_trading_enabled", v)}
          />
        </div>

        {/* Trading Mode */}
        <div>
          <Label className="text-sm text-white mb-2 block">Trading Mode</Label>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={settings.trading_mode === "test"}
              onClick={() => updateField("trading_mode", "test")}
              label="Test Mode"
              icon={WifiOff}
            />
            <ModeButton
              active={settings.trading_mode === "live"}
              onClick={() => updateField("trading_mode", "live")}
              label="Live Mode"
              icon={Zap}
            />
          </div>
        </div>

        {/* Lot Size Mode */}
        <div>
          <Label className="text-sm text-white mb-2 block">Lot Size</Label>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={settings.lot_size_mode === "alert_quantity"}
              onClick={() => updateField("lot_size_mode", "alert_quantity")}
              label="Alert Quantity"
            />
            <ModeButton
              active={settings.lot_size_mode === "fixed"}
              onClick={() => updateField("lot_size_mode", "fixed")}
              label="Fixed Lot"
            />
          </div>
        </div>

        {/* Fixed Lot Size */}
        {settings.lot_size_mode === "fixed" && (
          <div>
            <Label className="text-sm text-white mb-1 block">Fixed Lot Size</Label>
            <Input
              type="number"
              step="0.01"
              value={settings.fixed_lot_size ?? 0.01}
              onChange={(e) => updateField("fixed_lot_size", e.target.value)}
              className="bg-black/40 border-white/10 text-white"
            />
          </div>
        )}

        {/* Allowed Symbols */}
        <div>
          <Label className="text-sm text-white mb-1 block">Allowed Symbols</Label>
          <Input
            value={settings.allowed_symbols || "XAUUSD"}
            onChange={(e) => updateField("allowed_symbols", e.target.value)}
            className="bg-black/40 border-white/10 text-white"
            placeholder="XAUUSD, EURUSD"
          />
        </div>

        {/* Max Lot Size */}
        <div>
          <Label className="text-sm text-white mb-1 block">Maximum Lot Size</Label>
          <Input
            type="number"
            step="0.01"
            value={settings.max_lot_size ?? 0.1}
            onChange={(e) => updateField("max_lot_size", e.target.value)}
            className="bg-black/40 border-white/10 text-white"
          />
        </div>

        {/* Max Open Trades */}
        <div>
          <Label className="text-sm text-white mb-1 block">Maximum Open Trades</Label>
          <Input
            type="number"
            value={settings.max_open_trades ?? 3}
            onChange={(e) => updateField("max_open_trades", e.target.value)}
            className="bg-black/40 border-white/10 text-white"
          />
        </div>

        {/* SL/TP Required */}
        <div className="flex items-center justify-between">
          <Label className="text-sm text-white">Stop Loss Required</Label>
          <Switch
            checked={settings.stop_loss_required}
            onCheckedChange={(v) => updateField("stop_loss_required", v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-white">Take Profit Required</Label>
          <Switch
            checked={settings.take_profit_required}
            onCheckedChange={(v) => updateField("take_profit_required", v)}
          />
        </div>

        <Button
          onClick={saveSettings}
          disabled={saving}
          className="w-full bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </GlassCard>

      {/* Test Webhook */}
      <Button
        onClick={testWebhook}
        disabled={testing}
        variant="outline"
        className="w-full border-[#00FF41]/30 text-[#00FF41] hover:bg-[#00FF41]/10"
      >
        <Send className="w-4 h-4 mr-2" />
        {testing ? "Testing..." : "Test Webhook"}
      </Button>

      {/* D. Recent Alerts */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider">Recent Alerts</h2>
          {alerts.length > 0 && (
            <Button onClick={clearLogs} size="sm" variant="ghost" className="text-white/40 hover:text-[#FF3131] h-7 text-[10px]">
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        {alerts.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-6">No alerts received yet.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
            {alerts.map((a) => (
              <div key={a.id} className="bg-black/30 rounded-lg p-3 border border-white/5 text-[10px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white/80 font-bold">{a.symbol || "—"}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="flex items-center justify-between text-white/40">
                  <span>{a.action || "—"}</span>
                  <span>{a.requested_quantity ?? "—"} lots</span>
                </div>
                <div className="text-white/30">
                  {a.created_date ? new Date(a.created_date).toLocaleString() : "—"}
                </div>
                {a.message && <p className="text-white/40 italic truncate">{a.message}</p>}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Setup Instructions */}
      <GlassCard className="p-4 space-y-3">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5" /> TradingView Setup
        </h2>
        <ol className="text-[11px] text-white/50 space-y-1.5 list-decimal list-inside">
          <li>Open TradingView.</li>
          <li>Create or edit an alert.</li>
          <li>Enable Webhook URL.</li>
          <li>Paste your Flouba webhook URL.</li>
          <li>Paste the JSON alert message.</li>
          <li>Save the alert.</li>
        </ol>
        <Button
          onClick={() => copyToClipboard(TV_JSON_TEMPLATE, "JSON template")}
          variant="outline"
          size="sm"
          className="w-full border-[#00FF41]/20 text-[#00FF41]/80 hover:bg-[#00FF41]/5"
        >
          <Copy className="w-3.5 h-3.5 mr-2" /> Copy JSON Template
        </Button>
      </GlassCard>
    </div>
  );
}

function StatusChip({ label, value, active, small }) {
  return (
    <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
      <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
      <p className={`font-bold ${small ? "text-[10px]" : "text-xs"} ${active ? "text-[#00FF41] neon-text-green" : "text-white/60"}`}>
        {value}
      </p>
    </div>
  );
}

function ModeButton({ active, onClick, label, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all ${
        active
          ? "bg-[#FF3131]/15 text-[#FF3131] border border-[#FF3131]/40"
          : "bg-black/30 text-white/40 border border-white/5"
      }`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Received: "text-blue-400 bg-blue-400/10",
    Executed: "text-[#00FF41] bg-[#00FF41]/10",
    Rejected: "text-orange-400 bg-orange-400/10",
    Duplicate: "text-purple-400 bg-purple-400/10",
    Error: "text-[#FF3131] bg-[#FF3131]/10",
  };
  const cls = colors[status] || "text-white/40 bg-white/5";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${cls}`}>
      {status}
    </span>
  );
}