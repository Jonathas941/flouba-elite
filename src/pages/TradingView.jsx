import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import ExecutionConnectionPanel from "@/components/tradingview/ExecutionConnectionPanel";
import WebhookSetupCard from "@/components/tradingview/WebhookSetupCard";
import SetupChecklist from "@/components/tradingview/SetupChecklist";
import PipelineStatusCard from "@/components/tradingview/PipelineStatusCard";
import TestSignalButton from "@/components/tradingview/TestSignalButton";
import TradingHoursCard from "@/components/tradingview/TradingHoursCard";
import SignalDetailCard from "@/components/tradingview/SignalDetailCard";
import { Activity, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TradingView() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [signals, setSignals] = useState([]);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const creatingSettingsRef = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tvList, connList] = await Promise.all([
        base44.entities.TradingViewSettings.list("-created_date"),
        base44.entities.TradingExecutionConnection.list(),
      ]);

      let tv = tvList?.[0];
      if (!tv && !creatingSettingsRef.current) {
        creatingSettingsRef.current = true;
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
        }).finally(() => { creatingSettingsRef.current = false; });
      }

      // Disable any TradingViewSettings row created by a service account
      if (tv && String(tv.created_by_id || "").startsWith("service_") && tv.auto_trading_enabled) {
        await base44.entities.TradingViewSettings.update(tv.id, { auto_trading_enabled: false }).catch(() => {});
        tv.auto_trading_enabled = false;
      }
      setSettings(tv);
      setConnection(connList?.[0] || null);
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
        execution_target: settings.execution_target || "auto",
        use_alert_quantity: settings.use_alert_quantity,
        fixed_order_size: Number(settings.fixed_order_size ?? settings.fixed_lot_size ?? 0.01),
        allowed_symbols: settings.allowed_symbols,
        max_order_size: Number(settings.max_order_size ?? settings.max_lot_size ?? 0.1),
        max_open_positions: Number(settings.max_open_positions ?? settings.max_open_trades ?? 3),
        allow_buy: settings.allow_buy ?? true,
        allow_sell: settings.allow_sell ?? true,
        allow_close: settings.allow_close ?? true,
        tv_alert_expires_at: settings.tv_alert_expires_at || null,
      });
      toast({ title: "Saved", description: "TradingView settings updated." });
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const regenerateSecret = async () => {
    if (!settings) return;
    const newSecret = crypto.randomUUID().replace(/-/g, "");
    try {
      await base44.entities.TradingViewSettings.update(settings.id, {
        webhook_secret: newSecret,
      });
      setSettings(prev => ({ ...prev, webhook_secret: newSecret }));
      toast({
        title: "Secret Regenerated",
        description: "Update your Gold Scalper inputs and recreate the TradingView alert.",
      });
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
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

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF3131]/30 border-t-[#FF3131] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-28 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-white tracking-wider">TRADINGVIEW</h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Signal Pipeline</p>
        </div>
        <Activity className="w-6 h-6 text-[#FF3131]" />
      </div>

      {/* Alert Expiry Warning */}
      {settings.tv_alert_expires_at && (() => {
        const expiry = new Date(settings.tv_alert_expires_at);
        const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 5) return null;
        return (
          <GlassCard className="p-3" >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-400">Alert Expiry Soon</p>
                <p className="text-[10px] text-white/60">
                  {daysLeft <= 0 ? "Your TradingView alert has expired!" : `Expires in ${daysLeft} day(s) — renew it soon.`}
                </p>
              </div>
            </div>
          </GlassCard>
        );
      })()}

      {/* Alert Expiry Date Editor */}
      <GlassCard className="p-3">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Alert Expiry Date</Label>
        <Input
          type="date"
          value={settings.tv_alert_expires_at ? settings.tv_alert_expires_at.slice(0, 10) : ""}
          onChange={(e) => updateField("tv_alert_expires_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
          className="bg-white/5 border-red-500/20 rounded-xl h-11 mt-1"
        />
      </GlassCard>

      {/* 1. Webhook Setup */}
      <WebhookSetupCard
        settings={settings}
        onUpdateField={updateField}
        onSave={saveSettings}
        saving={saving}
        onRegenerateSecret={regenerateSecret}
      />

      {/* 2. Setup Checklist */}
      <SetupChecklist />

      {/* 3. Trading Hours */}
      <TradingHoursCard />

      {/* 4. Pipeline Status (auto-refreshes every 60s) */}
      <PipelineStatusCard onSignals={setSignals} />

      {/* 5. Test Signal */}
      <TestSignalButton settings={settings} />

      {/* Execution Connection */}
      <ExecutionConnectionPanel connection={connection} onSaved={loadData} />

      {/* Recent Signals */}
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
          <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
            {signals.map((s) => (
              <SignalDetailCard key={s.id} signal={s} />
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}