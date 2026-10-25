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
import { Activity, Trash2 } from "lucide-react";

export default function TradingView() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [signals, setSignals] = useState([]);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botSettings, setBotSettings] = useState(null);
  const creatingSettingsRef = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tvList, sigList, connList, botList] = await Promise.all([
        base44.entities.TradingViewSettings.list("-created_date"),
        base44.entities.TradingViewSignal.list("-created_date", 10),
        base44.entities.TradingExecutionConnection.list(),
        base44.entities.BotSettings.list(),
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

      setSettings(tv);
      setSignals(sigList || []);
      setConnection(connList?.[0] || null);
      setBotSettings(botList?.[0] || null);
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

      {/* 3. Pipeline Status (auto-refreshes every 60s) */}
      <PipelineStatusCard />

      {/* 4. Test Signal */}
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
          <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
            {signals.map((s) => {
              const colors = {
                Received: "text-blue-400 bg-blue-400/10",
                Validated: "text-cyan-400 bg-cyan-400/10",
                Executed: "text-[#00FF41] bg-[#00FF41]/10",
                Simulated: "text-purple-400 bg-purple-400/10",
                Rejected: "text-orange-400 bg-orange-400/10",
                Duplicate: "text-yellow-400 bg-yellow-400/10",
                Error: "text-[#FF3131] bg-[#FF3131]/10",
                Partial: "text-amber-400 bg-amber-400/10",
              };
              const cls = colors[s.status] || "text-white/40 bg-white/5";
              return (
                <div key={s.id} className="bg-black/30 rounded-lg p-3 border border-white/5 text-[10px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/80 font-bold">{s.symbol || "—"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${cls}`}>{s.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-white/40">
                    <span>{s.action || "—"}</span>
                    <span>{s.quantity ?? "—"}</span>
                  </div>
                  {s.price != null && <div className="text-white/30">Price: {s.price}</div>}
                  <div className="text-white/30">
                    {s.received_at ? new Date(s.received_at).toLocaleString() : "—"}
                  </div>
                  {s.message && <p className="text-white/40 italic truncate">{s.message}</p>}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}