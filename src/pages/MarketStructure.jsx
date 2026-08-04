import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Square, Check, X, Activity, Settings as SettingsIcon, Radar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import HudPanel from "@/components/dashboard/hud/HudPanel";

const STATUS_COLORS = {
  "Scanning": "text-cyan-400",
  "Signal Found": "text-[#00FF41]",
  "Waiting Approval": "text-amber-400",
  "Pending Order Placed": "text-blue-400",
  "Activated": "text-[#00FF41]",
  "Canceled": "text-red-400",
  "Expired": "text-white/40",
  "Rejected": "text-red-400",
  "Closed": "text-white/60",
};

export default function MarketStructure() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [setups, setSetups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, setupsRes, activityRes] = await Promise.all([
        base44.functions.invoke("marketStructureScanner", { action: "settings" }),
        base44.functions.invoke("marketStructureScanner", { action: "setups" }),
        base44.functions.invoke("marketStructureScanner", { action: "activity" }),
      ]);
      if (settingsRes?.data?.settings) setSettings(settingsRes.data.settings);
      if (setupsRes?.data?.setups) setSetups(setupsRes.data.setups);
      if (activityRes?.data?.activity) setActivity(activityRes.data.activity);
    } catch (e) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const checkConnection = useCallback(async () => {
    try {
      const res = await mt5Api.account();
      setConnected(res?.ok && res?.data?.account?.balance != null);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    checkConnection();
    const poll = setInterval(() => { loadData(); checkConnection(); }, 15000);
    return () => clearInterval(poll);
  }, [loadData, checkConnection]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke("marketStructureScanner", { action: "scan" });
      const r = res?.data;
      if (r?.ok) {
        setScanResult(r);
        if (r.results) {
          const found = r.results.filter(s => s.found);
          if (found.length > 0) {
            toast({ title: `${found.length} Setup(s) Found`, description: found.map(s => s.reason).join("\n"), duration: 5000 });
          } else {
            toast({ title: "Scan Complete", description: "No setups found — scanner monitoring market.", duration: 3000 });
          }
        }
      }
      await loadData();
    } catch (e) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (setupId) => {
    try {
      const res = await base44.functions.invoke("marketStructureScanner", { action: "approve", setup_id: setupId });
      const r = res?.data;
      if (r?.ok) {
        if (r.demo) {
          toast({ title: "Demo Order Placed", description: "Demo mode — order simulated successfully.", duration: 3000 });
        } else {
          toast({ title: "Order Placed", description: `MT5 ticket: ${r.ticket}`, duration: 4000 });
        }
      } else {
        toast({ title: "Order Rejected", description: r?.error || "MT5 rejected the order.", variant: "destructive", duration: 5000 });
      }
      await loadData();
    } catch (e) {
      toast({ title: "Approve failed", description: e.message, variant: "destructive" });
    }
  };

  const handleReject = async (setupId) => {
    try {
      await base44.functions.invoke("marketStructureScanner", { action: "reject", setup_id: setupId });
      toast({ title: "Setup Rejected", duration: 2000 });
      await loadData();
    } catch (e) {
      toast({ title: "Reject failed", description: e.message, variant: "destructive" });
    }
  };

  const handleCancel = async (setupId) => {
    try {
      await base44.functions.invoke("marketStructureScanner", { action: "cancel", setup_id: setupId });
      toast({ title: "Order Canceled", duration: 2000 });
      await loadData();
    } catch (e) {
      toast({ title: "Cancel failed", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleScanner = async () => {
    if (!settings) return;
    try {
      const res = await base44.functions.invoke("marketStructureScanner", {
        action: "settings",
        update: { scanner_active: !settings.scanner_active },
      });
      if (res?.data?.settings) setSettings(res.data.settings);
      toast({ title: settings.scanner_active ? "Scanner Stopped" : "Scanner Activated", duration: 2000 });
    } catch (e) {
      toast({ title: "Toggle failed", description: e.message, variant: "destructive" });
    }
  };

  const handleSettingChange = async (key, value) => {
    if (!settings) return;
    try {
      const res = await base44.functions.invoke("marketStructureScanner", {
        action: "settings",
        update: { [key]: value },
      });
      if (res?.data?.settings) setSettings(res.data.settings);
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-[#00FF41]/30 border-t-[#00FF41] rounded-full animate-spin" />
      </div>
    );
  }

  const cfg = settings || {};

  return (
    <div className="min-h-screen bg-black max-w-md mx-auto px-4 py-4 space-y-3">
      {/* HEADER */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-[#00FF41]" />
          <h1 className="font-heading text-sm tracking-[0.2em] text-white">MARKET STRUCTURE</h1>
        </div>
        <button
          onClick={handleToggleScanner}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-wider transition-all ${
            cfg.scanner_active
              ? "bg-[#FF3131]/10 text-[#FF3131] border border-[#FF3131]/40"
              : "bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/40"
          }`}
        >
          {cfg.scanner_active ? "STOP" : "START"}
        </button>
      </div>

      {/* A. SCANNER STATUS */}
      <HudPanel label="Scanner Status" accent={cfg.scanner_active ? "#00FF41" : "#FF3131"}>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          {[
            { label: "Scanner", value: cfg.scanner_active ? "Active" : "Stopped", color: cfg.scanner_active ? "text-[#00FF41]" : "text-[#FF3131]" },
            { label: "MT5", value: connected ? "Connected" : "Disconnected", color: connected ? "text-[#00FF41]" : "text-[#FF3131]" },
            { label: "Auto Exec", value: cfg.auto_execution_enabled ? "ON" : "OFF", color: cfg.auto_execution_enabled ? "text-amber-400" : "text-white/40" },
            { label: "Mode", value: cfg.trading_mode || "demo", color: cfg.trading_mode === "live" ? "text-[#FF3131]" : "text-cyan-400" },
            { label: "Last Scan", value: cfg.last_scan_time ? new Date(cfg.last_scan_time).toLocaleTimeString() : "--", color: "text-white/60" },
            { label: "Last Signal", value: cfg.last_signal_time ? new Date(cfg.last_signal_time).toLocaleTimeString() : "--", color: "text-white/60" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center py-0.5 border-b border-white/5">
              <span className="text-white/35 uppercase tracking-wider">{label}</span>
              <span className={`font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </HudPanel>

      {/* SCAN BUTTON */}
      <motion.button
        onClick={handleScan}
        disabled={scanning || !cfg.scanner_active}
        whileTap={{ scale: 0.97 }}
        className="w-full h-12 rounded-xl flex items-center justify-center gap-2 font-mono font-bold tracking-wider text-sm disabled:opacity-40"
        style={{
          background: "rgba(0,255,65,0.07)",
          color: "#00FF41",
          border: "1.5px solid rgba(0,255,65,0.4)",
          boxShadow: "0 0 18px rgba(0,255,65,0.12)",
        }}
      >
        {scanning ? <div className="w-4 h-4 border-2 border-[#00FF41]/30 border-t-[#00FF41] rounded-full animate-spin" /> : <Activity className="w-4 h-4" />}
        <span>{scanning ? "SCANNING…" : "SCAN NOW"}</span>
      </motion.button>

      {/* B. SCANNER SETTINGS */}
      <HudPanel label="Scanner Settings" accent="#00FF41">
        <div className="space-y-2 text-[10px] font-mono">
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Symbols</span>
            <span className="text-white font-bold">{cfg.symbols || "XAUUSD"}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Timeframes</span>
            <span className="text-white font-bold">{cfg.trend_timeframe}/{cfg.structure_timeframe}/{cfg.entry_timeframe}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Risk %</span>
            <span className="text-white font-bold">{cfg.risk_percentage}%</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Min Score</span>
            <span className="text-white font-bold">{cfg.min_signal_score}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Entry Method</span>
            <span className="text-white font-bold">{(cfg.entry_method || "order_block_mid").replace(/_/g, " ")}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Risk:Reward</span>
            <span className="text-white font-bold">1:{cfg.default_rr}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-white/35 uppercase tracking-wider">Max Pending</span>
            <span className="text-white font-bold">{cfg.max_pending_orders}</span>
          </div>
        </div>
      </HudPanel>

      {/* C. CURRENT SETUPS */}
      <HudPanel label="Current Setups" accent="#00FF41">
        {setups.length === 0 ? (
          <div className="py-6 text-center text-[10px] font-mono text-white/25">No active setups — scanner monitoring market.</div>
        ) : (
          <div className="space-y-2">
            {setups.map((s) => (
              <div key={s.id} className="p-2 rounded-lg border border-white/5 bg-white/2">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold text-xs ${s.direction === "BUY" ? "text-[#00FF41]" : "text-[#FF3131]"}`}>
                      {s.direction}
                    </span>
                    <span className="font-mono text-[10px] text-white/60">{s.symbol}</span>
                    <span className="font-mono text-[9px] text-white/30">{s.order_type}</span>
                  </div>
                  <span className={`font-mono text-[9px] font-bold ${STATUS_COLORS[s.status] || "text-white/40"}`}>
                    {s.status}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
                  <div><span className="text-white/30">Entry:</span> <span className="text-white/80">{s.entry_price?.toFixed(2)}</span></div>
                  <div><span className="text-white/30">SL:</span> <span className="text-[#FF3131]/80">{s.stop_loss?.toFixed(2)}</span></div>
                  <div><span className="text-white/30">TP:</span> <span className="text-[#00FF41]/80">{s.take_profit?.toFixed(2)}</span></div>
                  <div><span className="text-white/30">Score:</span> <span className="text-amber-400">{s.signal_score}</span></div>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[9px] font-mono text-white/25">
                  <span>RR 1:{s.risk_reward?.toFixed(1)}</span>
                  <span>Lot {s.lot_size}</span>
                  <span>{s.zone_type?.replace(/_/g, " ")}</span>
                </div>
                {s.status === "Waiting Approval" && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleApprove(s.setup_id)}
                      className="flex-1 py-1.5 rounded-md text-[9px] font-mono font-bold bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 hover:bg-[#00FF41]/20 transition-all flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" /> APPROVE
                    </button>
                    <button
                      onClick={() => handleReject(s.setup_id)}
                      className="flex-1 py-1.5 rounded-md text-[9px] font-mono font-bold bg-[#FF3131]/10 text-[#FF3131] border border-[#FF3131]/30 hover:bg-[#FF3131]/20 transition-all flex items-center justify-center gap-1"
                    >
                      <X className="w-3 h-3" /> REJECT
                    </button>
                  </div>
                )}
                {s.status === "Pending Order Placed" && s.mt5_ticket && (
                  <div className="flex items-center justify-between mt-2 text-[9px] font-mono">
                    <span className="text-blue-400">Ticket: {s.mt5_ticket}</span>
                    <button
                      onClick={() => handleCancel(s.setup_id)}
                      className="px-2 py-1 rounded-md text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/30"
                    >
                      CANCEL
                    </button>
                  </div>
                )}
                {s.rejected_reason && (
                  <div className="mt-1.5 text-[9px] font-mono text-red-400/70">⚠ {s.rejected_reason}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </HudPanel>

      {/* D. RECENT ACTIVITY */}
      <HudPanel label="Recent Activity" accent="#FFCC42">
        {activity.length === 0 ? (
          <div className="py-4 text-center text-[10px] font-mono text-white/25">No activity yet.</div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {activity.slice(0, 20).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1 px-1 text-[9px] font-mono border-b border-white/5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`font-bold ${s.direction === "BUY" ? "text-[#00FF41]/70" : "text-[#FF3131]/70"}`}>
                    {s.direction || "--"}
                  </span>
                  <span className="text-white/40">{s.symbol}</span>
                  <span className={`font-bold ${STATUS_COLORS[s.status] || "text-white/40"}`}>{s.status}</span>
                </div>
                <span className="text-white/20 flex-shrink-0">
                  {s.created_date ? new Date(s.created_date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </HudPanel>

      {/* SAFETY NOTICE */}
      <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <p className="text-[9px] font-mono text-amber-400/70 leading-relaxed">
          ⚠ {cfg.trading_mode === "live"
            ? "LIVE MODE — Real orders will be sent to MT5. Ensure all settings are correct."
            : "DEMO MODE — Orders are simulated. No real trades will be placed."}
          {" "}Default is Manual Confirmation — you approve every order before it's sent.
        </p>
      </div>
    </div>
  );
}