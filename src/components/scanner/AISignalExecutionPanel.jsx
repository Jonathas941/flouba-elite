import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Zap, Check, X, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const STATUS_COLORS = {
  WAITING_FOR_ENTRY: "text-amber-400",
  CONFIRMED: "text-blue-400",
  EXECUTED: "text-[#00FF41]",
  EXPIRED: "text-white/40",
  CANCELLED: "text-red-400",
};

export default function AISignalExecutionPanel() {
  const { toast } = useToast();
  const [signals, setSignals] = useState([]);
  const [saSettings, setSaSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sigRes, saRes] = await Promise.all([
        base44.entities.FloubaSignal.filter(
          { status: { $in: ["WAITING_FOR_ENTRY", "CONFIRMED"] } },
          "-created_date", 20
        ),
        base44.entities.SignalAssistantSettings.filter({}, "-created_date", 1),
      ]);
      setSignals(sigRes || []);
      setSaSettings(saRes?.[0] || null);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 10000);
    return () => clearInterval(poll);
  }, [load]);

  const handleExecute = async (signalId) => {
    setActing(true);
    try {
      const res = await base44.functions.invoke("floubaSignalExecute", {
        signal_id: signalId,
        action: "execute",
      });
      const r = res?.data;
      if (r?.ok) {
        toast({ title: "Trade Executed", description: `Ticket: ${r.ticket}`, duration: 4000 });
      } else {
        toast({ title: "Execution Failed", description: r?.error || "MT5 rejected the order.", variant: "destructive", duration: 5000 });
      }
      await load();
    } catch (e) {
      toast({ title: "Execute failed", description: e.message, variant: "destructive" });
    }
    setActing(false);
  };

  const handleCancel = async (signalId) => {
    setActing(true);
    try {
      await base44.functions.invoke("floubaSignalExecute", {
        signal_id: signalId,
        action: "cancel",
      });
      toast({ title: "Signal Cancelled", duration: 2000 });
      await load();
    } catch (e) {
      toast({ title: "Cancel failed", description: e.message, variant: "destructive" });
    }
    setActing(false);
  };

  const handleToggleAuto = async () => {
    if (!saSettings) return;
    const newAuto = !saSettings.auto_trading_enabled;
    const newMode = newAuto ? "full_auto" : "signal_only";
    try {
      const updated = await base44.entities.SignalAssistantSettings.update(saSettings.id, {
        auto_trading_enabled: newAuto,
        execution_mode: newMode,
      });
      setSaSettings(updated);
      toast({
        title: newAuto ? "Auto Mode Enabled" : "Manual Mode Enabled",
        description: newAuto ? "AI signals will auto-execute when score meets threshold." : "You approve each trade before it's sent.",
        duration: 3000,
      });
    } catch (e) {
      toast({ title: "Toggle failed", description: e.message, variant: "destructive" });
    }
  };

  const autoEnabled = saSettings?.auto_trading_enabled;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header + Auto toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-red-400" />
          <h2 className="text-xs font-heading font-bold tracking-wider text-white uppercase">AI Trade Execution</h2>
        </div>
        <button
          onClick={handleToggleAuto}
          className="px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-wider transition-all"
          style={{
            background: autoEnabled ? "rgba(255,49,49,0.10)" : "rgba(255,204,66,0.06)",
            color: autoEnabled ? "#FF3131" : "#FFCC42",
            border: `1.5px solid ${autoEnabled ? "rgba(255,49,49,0.5)" : "rgba(255,204,66,0.4)"}`,
          }}
        >
          <Zap className={`w-3 h-3 inline mr-1 ${autoEnabled ? "fill-current" : ""}`} />
          {autoEnabled ? "AUTO" : "MANUAL"}
        </button>
      </div>

      {/* Status bar */}
      <div className="rounded-xl p-2.5 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${autoEnabled ? "bg-[#FF3131] animate-pulse" : "bg-amber-400"}`} />
          <span className="text-[10px] font-mono text-white/50">
            {autoEnabled ? "Auto-execute ON — signals trade automatically" : "Manual — approve each trade"}
          </span>
        </div>
        <button onClick={load} className="p-1">
          <RefreshCw className="w-3 h-3 text-white/30" />
        </button>
      </div>

      {/* Signal list */}
      {signals.length === 0 ? (
        <div className="rounded-xl p-6 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs text-white/40 font-heading">No active AI signals</p>
          <p className="text-[10px] text-white/25 mt-1">AI signals will appear here for execution</p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((s, i) => {
            const isBuy = s.direction === "BUY";
            const color = isBuy ? "#00FF41" : "#FF3131";
            return (
              <motion.div key={s.id || i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
                className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}25` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                      {isBuy ? <TrendingUp className="w-3.5 h-3.5" style={{ color }} /> : <TrendingDown className="w-3.5 h-3.5" style={{ color }} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-heading font-bold text-white">{s.symbol}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-heading tracking-wider"
                          style={{ background: `${color}12`, color }}>{s.direction}</span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold ${STATUS_COLORS[s.status] || "text-white/40"}`}>{s.status}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-mono text-white/40">Score</p>
                    <p className="text-sm font-mono font-bold text-amber-400">{s.confidence_score}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 text-[9px] font-mono mb-2">
                  <div><span className="text-white/30">Entry:</span> <span className="text-white/80">{s.entry_price?.toFixed(2)}</span></div>
                  <div><span className="text-white/30">SL:</span> <span className="text-[#FF3131]/80">{s.stop_loss?.toFixed(2)}</span></div>
                  <div><span className="text-white/30">TP:</span> <span className="text-[#00FF41]/80">{s.take_profit?.toFixed(2)}</span></div>
                  <div><span className="text-white/30">Lot:</span> <span className="text-white/80">{s.lot_size}</span></div>
                </div>

                {s.strategy_name && (
                  <p className="text-[9px] font-mono text-white/30 mb-2">Strategy: {s.strategy_name}</p>
                )}

                {s.status === "WAITING_FOR_ENTRY" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExecute(s.id)}
                      disabled={acting}
                      className="flex-1 py-1.5 rounded-md text-[9px] font-mono font-bold bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 hover:bg-[#00FF41]/20 transition-all flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" /> EXECUTE TRADE
                    </button>
                    <button
                      onClick={() => handleCancel(s.id)}
                      disabled={acting}
                      className="flex-1 py-1.5 rounded-md text-[9px] font-mono font-bold bg-[#FF3131]/10 text-[#FF3131] border border-[#FF3131]/30 hover:bg-[#FF3131]/20 transition-all flex items-center justify-center gap-1"
                    >
                      <X className="w-3 h-3" /> CANCEL
                    </button>
                  </div>
                )}

                {s.status === "CONFIRMED" && s.ticket_id && (
                  <div className="flex items-center justify-between text-[9px] font-mono">
                    <span className="text-blue-400">Ticket: {s.ticket_id}</span>
                    <button
                      onClick={() => handleCancel(s.id)}
                      disabled={acting}
                      className="px-2 py-1 rounded-md text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/30"
                    >
                      CANCEL
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Safety notice */}
      <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <p className="text-[9px] font-mono text-amber-400/70 leading-relaxed">
          ⚠ LIVE MODE — Real orders sent to MT5 on execution. Manual mode requires your approval before each trade.
        </p>
      </div>
    </div>
  );
}