import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import MobileHeader from "@/components/MobileHeader";
import StatusCards from "@/components/tradingview/StatusCards";
import StrategyLibrary from "@/components/tradingview/StrategyLibrary";
import AlertSetup from "@/components/tradingview/AlertSetup";
import SignalHistory from "@/components/tradingview/SignalHistory";
import RiskControl from "@/components/tradingview/RiskControl";
import LiveEventFeed from "@/components/tradingview/LiveEventFeed";
import { STRATEGY_LIBRARY } from "@/lib/tradingviewStrategies";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function TradingView() {
  const { toast } = useToast();
  const [bridge, setBridge] = useState(null);
  const [signals, setSignals] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [bridgeRes, sigRes, stratRes] = await Promise.all([
        base44.functions.invoke("tradingviewBridge", { action: "status" }),
        base44.entities.TradingViewSignal.list("-received_at", 100).catch(() => []),
        base44.entities.TradingViewStrategy.list().catch(() => []),
      ]);
      setBridge(bridgeRes?.data);
      setSignals(Array.isArray(sigRes) ? sigRes : []);
      setStrategies(Array.isArray(stratRes) ? stratRes : []);
    } catch (e) {
      setBridge(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Ensure a TradingViewStrategy record exists for every library strategy
  const ensureStrategyRecords = useCallback(async () => {
    const existingKeys = new Set(strategies.map(s => s.strategy_key));
    const missing = STRATEGY_LIBRARY.filter(s => !existingKeys.has(s.key));
    if (missing.length) {
      const created = await base44.entities.TradingViewStrategy.bulkCreate(
        missing.map(s => ({ strategy_key: s.key, strategy_name: s.name, symbol: s.symbol, active: false }))
      ).catch(() => []);
      if (created?.length) setStrategies(prev => [...prev, ...created]);
    }
  }, [strategies]);

  useEffect(() => { ensureStrategyRecords(); }, [ensureStrategyRecords]);

  const activeKeys = new Set(strategies.filter(s => s.active).map(s => s.strategy_key));

  const handleToggle = async (libStrategy) => {
    const record = strategies.find(s => s.strategy_key === libStrategy.key);
    if (!record) return;
    const willActivate = !record.active;

    if (willActivate) {
      // Enforce one active strategy per symbol — deactivate others with same symbol
      const conflicts = strategies.filter(s => s.symbol === libStrategy.symbol && s.active && s.id !== record.id);
      for (const c of conflicts) {
        await base44.entities.TradingViewStrategy.update(c.id, { active: false });
      }
      await base44.entities.TradingViewStrategy.update(record.id, { active: true });
      setStrategies(prev => prev.map(s => s.id === record.id ? { ...s, active: true } : (conflicts.some(c => c.id === s.id) ? { ...s, active: false } : s)));
      toast({ title: "Strategy Activated", description: `${libStrategy.name} is now active for ${libStrategy.symbol}.`, duration: 2500 });
    } else {
      await base44.entities.TradingViewStrategy.update(record.id, { active: false });
      setStrategies(prev => prev.map(s => s.id === record.id ? { ...s, active: false } : s));
      toast({ title: "Strategy Deactivated", description: `${libStrategy.name} deactivated.`, duration: 2000 });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke("tradingviewBridge", { action: "test" });
      const data = res?.data;
      setTestResult({ ok: data?.ok === true, data: data?.data, error: data?.ok === false ? (data?.error || data?.data?.error) : null });
      toast({
        title: data?.ok ? "Test Signal Sent" : "Test Failed",
        description: data?.ok ? "Replit received the test signal. No trade created." : (data?.error || "Replit backend not reachable."),
        variant: data?.ok ? "default" : "destructive",
        duration: 3500,
      });
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
      toast({ title: "Test Failed", description: e.message, variant: "destructive", duration: 3500 });
    }
    setTesting(false);
  };

  const connected = bridge?.connected;

  return (
    <div className="min-h-screen pb-32 max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto">
      <MobileHeader title="TradingView Signal Center" subtitle="Connect TradingView alerts to Flouba Elite and MT5 execution." />

      <div className="px-4 space-y-6">
        {/* Not connected banner */}
        {!loading && !connected && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-heading font-bold text-amber-300">Replit Backend Not Connected</p>
              <p className="text-[10px] text-white/50 mt-0.5 font-body">Connect Replit Backend to receive live TradingView activity.</p>
            </div>
          </div>
        )}

        {/* Refresh bar */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/30 font-body">{loading ? "Loading…" : connected ? "Live · syncing every 15s" : "Offline"}</span>
          <button onClick={fetchAll} className="flex items-center gap-1 text-[10px] text-cyan-400 font-heading font-bold uppercase tracking-wider hover:text-cyan-300">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <StatusCards data={bridge} />

        <StrategyLibrary activeKeys={activeKeys} onToggle={handleToggle} />

        <AlertSetup webhookUrl={bridge?.webhookUrl || ""} onTest={handleTest} testResult={testResult} testing={testing} />

        <RiskControl risk={bridge?.risk} />

        <LiveEventFeed feed={bridge?.feed} />

        <SignalHistory signals={signals} />
      </div>
    </div>
  );
}