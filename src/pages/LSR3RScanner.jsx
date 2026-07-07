import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Activity, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import SetupStatusBadge from "@/components/lsr3r/SetupStatusBadge";
import LSR3RChart from "@/components/lsr3r/LSR3RChart";

const SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD"];

export default function LSR3RScanner() {
  const { toast } = useToast();
  const [symbol, setSymbol] = useState("XAUUSD");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const scan = useCallback(async (silent = false) => {
    if (!silent) setScanning(true);
    try {
      const res = await base44.functions.invoke("lsr3rScanner", { action: "scan", symbol });
      if (res?.data?.ok) {
        setStatus(res.data.status);
        if (!silent && res.data.status?.setup_status === "Entry signal ready") {
          toast({ title: `${res.data.status.direction} Signal Ready`, description: `${symbol} — Entry: ${res.data.status.entry}`, duration: 5000 });
        }
      }
    } catch (e) {
      if (!silent) toast({ title: "Scan Failed", description: e.message, variant: "destructive" });
    }
    if (!silent) setScanning(false);
    setLoading(false);
  }, [symbol, toast]);

  // Poll every 15 seconds
  useEffect(() => {
    scan(true);
    const interval = setInterval(() => scan(true), 15000);
    return () => clearInterval(interval);
  }, [symbol, scan]);

  // Countdown timer for signal expiry
  useEffect(() => {
    if (!status?.expiry_time) { setCountdown(0); return; }
    const update = () => {
      const ms = new Date(status.expiry_time).getTime() - Date.now();
      setCountdown(Math.max(0, Math.floor(ms / 1000)));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [status?.expiry_time]);

  const fmt = (v) => {
    if (v == null) return "--";
    const d = symbol === "XAUUSD" ? 2 : 5;
    return Number(v).toFixed(d);
  };

  const connected = status?.connected !== false;
  const hasSignal = status?.setup_status === "Entry signal ready" && status?.entry != null;
  const dirColor = status?.direction === "BUY" ? "#00FF41" : "#FF3131";

  return (
    <div className="space-y-4 pb-4">
      {/* Symbol + Timeframe selector */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1 rounded-xl p-1" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
          {SYMBOLS.map((s) => (
            <button key={s} onClick={() => setSymbol(s)}
              className="flex-1 py-2 rounded-lg text-[11px] font-heading font-bold tracking-wider transition-all"
              style={{
                background: symbol === s ? "rgba(255,204,66,0.12)" : "transparent",
                color: symbol === s ? "#FFCC42" : "rgba(255,255,255,0.35)",
                border: symbol === s ? "1px solid rgba(255,204,66,0.30)" : "1px solid transparent",
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1 rounded-xl p-1" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
          {["M1", "M5"].map((tf) => (
            <div key={tf} className="flex-1 py-2 rounded-lg text-[11px] font-heading font-bold tracking-wider text-center"
              style={{
                background: tf === "M1" ? "rgba(255,204,66,0.10)" : "transparent",
                color: tf === "M1" ? "#FFCC42" : "rgba(255,255,255,0.25)",
                border: tf === "M1" ? "1px solid rgba(255,204,66,0.25)" : "1px solid transparent",
              }}>
              {tf === "M1" ? "M1 · Entry" : "M5 · Structure"}
            </div>
          ))}
        </div>
        <button onClick={() => scan(false)} disabled={scanning}
          className="p-2.5 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(255,204,66,0.10)", border: "1px solid rgba(255,204,66,0.25)" }}>
          <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} style={{ color: "#FFCC42" }} />
        </button>
      </div>

      {/* Market status */}
      <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: `1px solid ${connected ? "rgba(255,204,66,0.12)" : "rgba(255,49,49,0.20)"}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" style={{ color: connected ? "#00FF41" : "#FF3131" }} />
            <span className="text-[10px] font-heading font-bold tracking-wider uppercase text-white/60">Market Status</span>
          </div>
          <SetupStatusBadge status={status?.setup_status || "Waiting for anchor"} direction={status?.direction} size="sm" />
        </div>

        {!connected ? (
          <div className="py-3 text-center">
            <p className="text-sm font-heading font-bold" style={{ color: "#FF3131" }}>Market feed disconnected</p>
            <p className="text-[10px] text-white/40 mt-1">Connect MT5 to receive live data</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Price" value={fmt(status?.current_price)} />
            <Stat label="Spread" value={status?.spread != null ? fmt(status.spread) : "--"} />
            <Stat label="Session" value={status?.anchor_session || "--"} />
            <Stat label="Broker Offset" value={status?.broker_offset != null ? `UTC${status.broker_offset >= 0 ? "+" : ""}${status.broker_offset}` : "--"} />
          </div>
        )}
      </div>

      {/* Chart */}
      {connected && <LSR3RChart status={status} />}

      {/* Anchor levels */}
      {connected && status?.anchor_high != null && (
        <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid rgba(255,204,66,0.12)" }}>
          <p className="text-[10px] font-heading font-bold tracking-wider uppercase text-white/60 mb-3">Anchor Levels</p>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Anchor High" value={fmt(status.anchor_high)} accent="#FFCC42" />
            <Stat label="Anchor Low" value={fmt(status.anchor_low)} accent="#FFCC42" />
            <Stat label="Sweep High" value={fmt(status.sweep_high)} accent="#00E5FF" />
            <Stat label="Sweep Low" value={fmt(status.sweep_low)} accent="#00E5FF" />
          </div>
          {status?.anchor_times_broker && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <Clock className="w-3 h-3 text-white/30" />
              <span className="text-[9px] text-white/40 font-heading">
                Anchor times (broker): {status.anchor_times_broker.a1} / {status.anchor_times_broker.a2}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Signal details */}
      {hasSignal && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: `1px solid ${dirColor}40` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: dirColor }} />
              <span className="text-sm font-heading font-black tracking-wider" style={{ color: dirColor }}>
                {status.direction} SIGNAL
              </span>
            </div>
            {countdown > 0 && (
              <span className="text-[10px] font-mono px-2 py-1 rounded-full" style={{ background: "rgba(255,204,66,0.10)", color: "#FFCC42" }}>
                ⏱ {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat label="Entry" value={fmt(status.entry)} accent={dirColor} />
            <Stat label="Stop Loss" value={fmt(status.stop_loss)} accent="#FF3131" />
            <Stat label="Take Profit" value={fmt(status.take_profit)} accent="#00FF41" />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <Stat label="Risk/Reward" value={`1:${status.risk_reward}`} />
            <Stat label="Risk $" value={status.risk_amount ? `$${status.risk_amount.toFixed(2)}` : "--"} />
            <Stat label="Lot Size" value={status.lot_size?.toFixed(2) || "--"} accent="#FFCC42" />
          </div>
        </motion.div>
      )}

      {/* Skip / warning reasons */}
      {status?.skip_reason && (
        <div className="rounded-2xl p-3.5 flex items-start gap-2" style={{ background: "rgba(255,49,49,0.06)", border: "1px solid rgba(255,49,49,0.20)" }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#FF3131" }} />
          <p className="text-[11px] text-white/70">{status.skip_reason}</p>
        </div>
      )}
      {status?.lot_skip_reason && (
        <div className="rounded-2xl p-3.5 flex items-start gap-2" style={{ background: "rgba(255,204,66,0.06)", border: "1px solid rgba(255,204,66,0.20)" }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#FFCC42" }} />
          <p className="text-[11px] text-white/70">{status.lot_skip_reason}</p>
        </div>
      )}

      {/* Risk dashboard */}
      {connected && (
        <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] font-heading font-bold tracking-wider uppercase text-white/60 mb-3">Daily Risk</p>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Trades Today" value={`${status?.trades_today ?? 0}/${status?.max_trades ?? 2}`} />
            <Stat label="Daily Loss" value={`$${(status?.daily_loss ?? 0).toFixed(2)}`} accent={(status?.daily_loss ?? 0) > 0 ? "#FF3131" : "#999"} />
            <Stat label="Loss Limit" value={`$${(status?.daily_loss_limit ?? 0).toFixed(2)}`} />
            <Stat label="Consec. Losses" value={`${status?.consecutive_losses ?? 0}`} accent={(status?.consecutive_losses ?? 0) >= 2 ? "#FF3131" : "#999"} />
          </div>
          {status?.is_demo && (
            <p className="text-[9px] text-center mt-3 pt-3 border-t font-heading tracking-wider" style={{ borderColor: "rgba(255,255,255,0.05)", color: "#FFCC42" }}>
              DEMO MODE — SIGNALS FOR JOURNALING ONLY
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading mb-0.5">{label}</p>
      <p className="text-sm font-mono font-bold" style={{ color: accent || "#ffffff" }}>{value}</p>
    </div>
  );
}