import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { Activity, Webhook, Copy, Trash2, Send, BookOpen, Wifi, WifiOff, Zap, AlertTriangle } from "lucide-react";

const TV_JSON_TEMPLATE = `{
  "secret": "{{WEBHOOK_SECRET}}",
  "alert_id": "{{strategy.order.id}}-{{time}}",
  "symbol": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "quantity": "{{strategy.order.contracts}}",
  "price": "{{close}}",
  "position_size": "{{strategy.position_size}}",
  "timestamp": "{{timenow}}"
}`;

export default function TradingView() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [signals, setSignals] = useState([]);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConn, setSavingConn] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showLiveWarning, setShowLiveWarning] = useState(false);
  const [showConnForm, setShowConnForm] = useState(false);
  const [connForm, setConnForm] = useState({
    provider_name: "",
    api_base_url: "",
    account_id: "",
    encrypted_api_key: "",
    encrypted_api_secret: "",
    environment: "test",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tvList, sigList, connList] = await Promise.all([
        base44.entities.TradingViewSettings.list(),
        base44.entities.TradingViewSignal.list("-created_date", 10),
        base44.entities.TradingExecutionConnection.list(),
      ]);

      let tv = tvList?.[0];
      if (!tv) {
        tv = await base44.entities.TradingViewSettings.create({
          auto_trading_enabled: false,
          trading_mode: "test",
          use_alert_quantity: true,
          fixed_order_size: 0.01,
          allowed_symbols: "XAUUSD",
          max_order_size: 0.1,
          max_open_positions: 3,
          allow_buy: true,
          allow_sell: true,
          allow_close: true,
        });
      }

      setSettings(tv);
      setSignals(sigList || []);
      const conn = connList?.[0] || null;
      setConnection(conn);
      if (conn) {
        setConnForm({
          provider_name: conn.provider_name || "",
          api_base_url: conn.api_base_url || "",
          account_id: conn.account_id || "",
          encrypted_api_key: "",
          encrypted_api_secret: "",
          environment: conn.environment || "test",
        });
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await base44.entities.TradingViewSettings.update(settings.id, {
        auto_trading_enabled: settings.auto_trading_enabled,
        trading_mode: settings.trading_mode,
        use_alert_quantity: settings.use_alert_quantity,
        fixed_order_size: Number(settings.fixed_order_size),
        allowed_symbols: settings.allowed_symbols,
        max_order_size: Number(settings.max_order_size),
        max_open_positions: Number(settings.max_open_positions),
        allow_buy: settings.allow_buy,
        allow_sell: settings.allow_sell,
        allow_close: settings.allow_close,
      });
      toast({ title: "Saved", description: "TradingView settings updated." });
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testSignal = async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke("tradingViewWebhook", { __test: true });
      const data = res?.data || res;
      if (data?.success) {
        toast({ title: "Test Successful", description: data.message || "Signal simulated." });
      } else {
        toast({ title: "Test Failed", description: data?.message || data?.error || "Test failed.", variant: "destructive" });
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
      const all = await base44.entities.TradingViewSignal.list("-created_date", 100);
      for (const s of (all || [])) {
        await base44.entities.TradingViewSignal.delete(s.id);
      }
      setSignals([]);
      toast({ title: "Cleared", description: "Signal logs cleared." });
    } catch (err) {
      toast({ title: "Clear failed", description: err.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    });
  };

  const saveConnection = async () => {
    setSavingConn(true);
    try {
      const payload = {
        provider_name: connForm.provider_name,
        api_base_url: connForm.api_base_url,
        account_id: connForm.account_id,
        environment: connForm.environment,
        connection_status: "Connected",
      };
      if (connForm.encrypted_api_key) payload.encrypted_api_key = connForm.encrypted_api_key;
      if (connForm.encrypted_api_secret) payload.encrypted_api_secret = connForm.encrypted_api_secret;

      if (connection?.id) {
        await base44.entities.TradingExecutionConnection.update(connection.id, payload);
      } else {
        await base44.entities.TradingExecutionConnection.create(payload);
      }
      toast({ title: "Saved", description: "Broker connection updated." });
      setShowConnForm(false);
      await loadData();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingConn(false);
    }
  };

  const disconnectBroker = async () => {
    if (!connection?.id) return;
    try {
      await base44.entities.TradingExecutionConnection.update(connection.id, {
        connection_status: "Disconnected",
      });
      toast({ title: "Disconnected", description: "Broker connection disconnected." });
      await loadData();
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleLiveModeClick = () => {
    if (settings.trading_mode === "live") {
      updateField("trading_mode", "test");
    } else {
      setShowLiveWarning(true);
    }
  };

  const confirmLiveMode = () => {
    updateField("trading_mode", "live");
    setShowLiveWarning(false);
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF3131]/30 border-t-[#FF3131] rounded-full animate-spin" />
      </div>
    );
  }

  const webhookUrl = `${window.location.origin}/api/functions/tradingViewWebhook/${settings.created_by_id || settings.created_by}`;
  const execConnected = connection?.connection_status === "Connected";
  const lastSignal = signals?.[0]?.received_at || signals?.[0]?.created_date;

  return (
    <div className="min-h-screen px-4 pt-6 pb-28 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-white tracking-wider">TRADINGVIEW</h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Auto-Trading System</p>
        </div>
        <Activity className="w-6 h-6 text-[#FF3131]" />
      </div>

      {/* A. Status */}
      <GlassCard className="p-4 space-y-3">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider mb-2">Status</h2>
        <div className="grid grid-cols-2 gap-2">
          <StatusChip label="System" value="Active" active={true} />
          <StatusChip
            label="Webhook"
            value={settings.auto_trading_enabled ? "Active" : "Inactive"}
            active={settings.auto_trading_enabled}
          />
          <StatusChip
            label="Execution API"
            value={execConnected ? "Connected" : "Disconnected"}
            active={execConnected}
          />
          <StatusChip
            label="Auto Trading"
            value={settings.auto_trading_enabled ? "ON" : "OFF"}
            active={settings.auto_trading_enabled}
          />
          <StatusChip
            label="Mode"
            value={settings.trading_mode === "live" ? "Live Mode" : "Test Mode"}
            active={settings.trading_mode === "live"}
          />
          <StatusChip
            label="Last Signal"
            value={lastSignal ? new Date(lastSignal).toLocaleTimeString() : "—"}
            active={false}
            small
          />
        </div>
      </GlassCard>

      {/* B. Execution API / Broker Connection */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider">Execution API</h2>
          <StatusBadge status={execConnected ? "Connected" : "Disconnected"} />
        </div>

        {execConnected ? (
          <div className="bg-black/30 rounded-lg p-3 border border-white/5 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-white/30">Broker</span>
              <span className="text-white/80 font-bold">{connection?.provider_name || "—"}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-white/30">Account</span>
              <span className="text-white/60">{connection?.account_id || "—"}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-white/30">Environment</span>
              <span className="text-white/60">{connection?.environment || "—"}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => setShowConnForm(true)}
                variant="outline"
                size="sm"
                className="flex-1 border-white/10 text-white/60"
              >
                Edit
              </Button>
              <Button
                onClick={disconnectBroker}
                variant="outline"
                size="sm"
                className="flex-1 border-[#FF3131]/20 text-[#FF3131]/80"
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-white/40">
              Connect any broker API to execute TradingView signals. Works with OANDA, Alpaca, Tradovate, Interactive Brokers, and more.
            </p>
            <Button
              onClick={() => setShowConnForm(true)}
              variant="outline"
              size="sm"
              className="w-full border-[#00FF41]/30 text-[#00FF41] hover:bg-[#00FF41]/10"
            >
              <Wifi className="w-3.5 h-3.5 mr-2" /> Connect Broker
            </Button>
          </div>
        )}

        {showConnForm && (
          <div className="bg-black/40 rounded-lg p-3 border border-white/5 space-y-3">
            <div>
              <Label className="text-[11px] text-white/60 mb-1 block">Broker Name</Label>
              <Input
                value={connForm.provider_name}
                onChange={(e) => setConnForm(prev => ({ ...prev, provider_name: e.target.value }))}
                placeholder="OANDA, Alpaca, Tradovate..."
                className="bg-black/40 border-white/10 text-white text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-[11px] text-white/60 mb-1 block">API Base URL</Label>
              <Input
                value={connForm.api_base_url}
                onChange={(e) => setConnForm(prev => ({ ...prev, api_base_url: e.target.value }))}
                placeholder="https://api-fxtrade.oanda.com"
                className="bg-black/40 border-white/10 text-white text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-[11px] text-white/60 mb-1 block">Account ID</Label>
              <Input
                value={connForm.account_id}
                onChange={(e) => setConnForm(prev => ({ ...prev, account_id: e.target.value }))}
                placeholder="001-001-1234567-001"
                className="bg-black/40 border-white/10 text-white text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-[11px] text-white/60 mb-1 block">API Key</Label>
              <Input
                type="password"
                value={connForm.encrypted_api_key}
                onChange={(e) => setConnForm(prev => ({ ...prev, encrypted_api_key: e.target.value }))}
                placeholder={connection?.encrypted_api_key ? "•••••••• (saved)" : "Enter API key"}
                className="bg-black/40 border-white/10 text-white text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-[11px] text-white/60 mb-1 block">API Secret</Label>
              <Input
                type="password"
                value={connForm.encrypted_api_secret}
                onChange={(e) => setConnForm(prev => ({ ...prev, encrypted_api_secret: e.target.value }))}
                placeholder={connection?.encrypted_api_secret ? "•••••••• (saved)" : "Enter API secret"}
                className="bg-black/40 border-white/10 text-white text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-[11px] text-white/60 mb-2 block">Environment</Label>
              <div className="grid grid-cols-2 gap-2">
                <ModeButton
                  active={connForm.environment === "test"}
                  onClick={() => setConnForm(prev => ({ ...prev, environment: "test" }))}
                  label="Test"
                />
                <ModeButton
                  active={connForm.environment === "live"}
                  onClick={() => setConnForm(prev => ({ ...prev, environment: "live" }))}
                  label="Live"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => setShowConnForm(false)}
                variant="outline"
                size="sm"
                className="flex-1 border-white/10 text-white/60"
              >
                Cancel
              </Button>
              <Button
                onClick={saveConnection}
                disabled={savingConn || !connForm.provider_name || !connForm.api_base_url}
                size="sm"
                className="flex-1 bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
              >
                {savingConn ? "Saving..." : "Save Connection"}
              </Button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* C. Webhook URL */}
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

      {/* D. Settings */}
      <GlassCard className="p-4 space-y-4">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider mb-2">Settings</h2>

        {/* Auto Trading */}
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
              onClick={handleLiveModeClick}
              label="Live Mode"
              icon={Zap}
            />
          </div>
        </div>

        {/* Live Mode Warning */}
        {showLiveWarning && (
          <div className="bg-[#FF3131]/10 border border-[#FF3131]/30 rounded-lg p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF3131] mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-white/80">
                Live Mode will execute real orders received from TradingView.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowLiveWarning(false)}
                variant="outline"
                size="sm"
                className="flex-1 border-white/10 text-white/60"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmLiveMode}
                size="sm"
                className="flex-1 bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
              >
                Activate Live
              </Button>
            </div>
          </div>
        )}

        {/* Use Alert Quantity */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-white">Use Alert Quantity</Label>
            <p className="text-[10px] text-white/30">Use quantity from TradingView alert</p>
          </div>
          <Switch
            checked={settings.use_alert_quantity}
            onCheckedChange={(v) => updateField("use_alert_quantity", v)}
          />
        </div>

        {/* Fixed Order Size */}
        {!settings.use_alert_quantity && (
          <div>
            <Label className="text-sm text-white mb-1 block">Fixed Order Size</Label>
            <Input
              type="number"
              step="0.01"
              value={settings.fixed_order_size ?? 0.01}
              onChange={(e) => updateField("fixed_order_size", e.target.value)}
              className="bg-black/40 border-white/10 text-white"
            />
          </div>
        )}

        {/* Maximum Order Size */}
        <div>
          <Label className="text-sm text-white mb-1 block">Maximum Order Size</Label>
          <Input
            type="number"
            step="0.01"
            value={settings.max_order_size ?? 0.1}
            onChange={(e) => updateField("max_order_size", e.target.value)}
            className="bg-black/40 border-white/10 text-white"
          />
        </div>

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

        {/* Max Open Positions */}
        <div>
          <Label className="text-sm text-white mb-1 block">Maximum Open Positions</Label>
          <Input
            type="number"
            value={settings.max_open_positions ?? 3}
            onChange={(e) => updateField("max_open_positions", e.target.value)}
            className="bg-black/40 border-white/10 text-white"
          />
        </div>

        {/* Action Permissions */}
        <div className="grid grid-cols-3 gap-2">
          <PermissionToggle label="BUY" checked={settings.allow_buy} onChange={(v) => updateField("allow_buy", v)} />
          <PermissionToggle label="SELL" checked={settings.allow_sell} onChange={(v) => updateField("allow_sell", v)} />
          <PermissionToggle label="CLOSE" checked={settings.allow_close} onChange={(v) => updateField("allow_close", v)} />
        </div>

        <Button
          onClick={saveSettings}
          disabled={saving}
          className="w-full bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </GlassCard>

      {/* Test Signal */}
      <Button
        onClick={testSignal}
        disabled={testing}
        variant="outline"
        className="w-full border-[#00FF41]/30 text-[#00FF41] hover:bg-[#00FF41]/10"
      >
        <Send className="w-4 h-4 mr-2" />
        {testing ? "Testing..." : "Test Signal"}
      </Button>

      {/* E. Recent Signals */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider">Recent Signals</h2>
          {signals.length > 0 && (
            <Button onClick={clearLogs} size="sm" variant="ghost" className="text-white/40 hover:text-[#FF3131] h-7 text-[10px]">
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        {signals.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-6">No signals received yet.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
            {signals.map((s) => (
              <div key={s.id} className="bg-black/30 rounded-lg p-3 border border-white/5 text-[10px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white/80 font-bold">{s.symbol || "—"}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div className="flex items-center justify-between text-white/40">
                  <span>{s.action || "—"}</span>
                  <span>{s.quantity ?? "—"}</span>
                </div>
                {s.price != null && (
                  <div className="text-white/30">Price: {s.price}</div>
                )}
                <div className="text-white/30">
                  {s.received_at ? new Date(s.received_at).toLocaleString() : "—"}
                </div>
                {s.message && <p className="text-white/40 italic truncate">{s.message}</p>}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Setup Instructions */}
      <GlassCard className="p-4 space-y-3">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5" /> Setup Instructions
        </h2>
        <ol className="text-[11px] text-white/50 space-y-1.5 list-decimal list-inside">
          <li>Create an alert in TradingView.</li>
          <li>Enable Webhook URL.</li>
          <li>Paste your Flouba webhook URL.</li>
          <li>Paste the JSON message.</li>
          <li>Save the alert.</li>
          <li>Enable Auto Trading after completing a Test Mode test.</li>
        </ol>
        <Button
          onClick={() => copyToClipboard(TV_JSON_TEMPLATE, "JSON template")}
          variant="outline"
          size="sm"
          className="w-full border-[#00FF41]/20 text-[#00FF41]/80 hover:bg-[#00FF41]/5"
        >
          <Copy className="w-3.5 h-3.5 mr-2" /> Copy JSON Message
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

function PermissionToggle({ label, checked, onChange }) {
  return (
    <div className="bg-black/30 rounded-lg p-2.5 border border-white/5 flex flex-col items-center gap-1.5">
      <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Received: "text-blue-400 bg-blue-400/10",
    Validated: "text-cyan-400 bg-cyan-400/10",
    Executed: "text-[#00FF41] bg-[#00FF41]/10",
    Simulated: "text-purple-400 bg-purple-400/10",
    Rejected: "text-orange-400 bg-orange-400/10",
    Duplicate: "text-yellow-400 bg-yellow-400/10",
    Error: "text-[#FF3131] bg-[#FF3131]/10",
  };
  const cls = colors[status] || "text-white/40 bg-white/5";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${cls}`}>
      {status}
    </span>
  );
}