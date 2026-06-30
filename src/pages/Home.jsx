import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bot, Play, Square, Wifi, WifiOff, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const STATUS_MAP = {
  "Running":               { color: "text-green-400",  dot: "bg-green-400" },
  "Waiting for Confirmation": { color: "text-amber-400",  dot: "bg-amber-400" },
  "Scanning Market":       { color: "text-sky-400",    dot: "bg-sky-400"   },
  "Entering Trade":        { color: "text-yellow-400", dot: "bg-yellow-400"},
  "Managing Position":     { color: "text-purple-400", dot: "bg-purple-400"},
  "Paused":                { color: "text-gray-400",   dot: "bg-gray-400"  },
  "Locked":                { color: "text-red-400",    dot: "bg-red-400"   },
};

export default function Home() {
  const [settings, setSettings] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const load = async () => {
    const list = await base44.entities.BotSettings.list();
    let s = list[0];
    if (!s) s = await base44.entities.BotSettings.create({});
    setSettings(s);
  };

  useEffect(() => { load(); }, []);

  const patch = async (data) => {
    await base44.entities.BotSettings.update(settings.id, data);
    setSettings((p) => ({ ...p, ...data }));
  };

  const handleStart = async () => {
    await patch({ robot_status: "Scanning Market" });
    toast({ title: "Robot started", description: "Scanning market…" });
    setTimeout(() => patch({ robot_status: "Running" }), 2000);
  };

  const handleStop = async () => {
    await patch({ robot_status: "Paused" });
    toast({ title: "Robot paused" });
  };

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const connected = settings.connection_status === "Connected";
  const status = settings.robot_status || "Paused";
  const running = status === "Running";
  const active = connected && (running || status === "Scanning Market" || status === "Entering Trade" || status === "Managing Position");
  const cfg = STATUS_MAP[status] || STATUS_MAP["Paused"];

  const fmt = (val, decimals = 2) =>
    connected && val != null ? `$${Number(val).toFixed(decimals)}` : "--";

  return (
    <div className="min-h-screen flex flex-col px-5 pt-8 pb-28 max-w-md mx-auto">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-xl font-black text-white leading-none tracking-widest">
            FLOUBA <span className="text-red-500">ELITE</span>
          </h1>
          <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mt-0.5">AI Trading Engine</p>
        </div>

        {/* Connection Badge */}
        <button
          onClick={() => !connected && navigate("/connect-mt5")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-heading font-bold uppercase tracking-widest transition-colors ${
            connected
              ? "bg-green-500/10 border border-green-500/30 text-green-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
          }`}
        >
          {connected
            ? <><Wifi className="w-3 h-3" /> Connected</>
            : <><WifiOff className="w-3 h-3" /> Not Connected</>
          }
        </button>
      </motion.div>

      {/* Robot Visual */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center mb-8"
      >
        {/* Outer rings */}
        <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
          <motion.div
            className="absolute w-52 h-52 rounded-full border border-dashed border-red-500/15"
            animate={{ rotate: 360 }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          />
          {[0, 90, 180, 270].map((deg) => (
            <motion.div
              key={deg}
              className="absolute w-52 h-52"
              animate={{ rotate: 360 }}
              transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            >
              <div
                className="absolute w-2 h-2 bg-red-500 rounded-full"
                style={{
                  top: "50%", left: "50%",
                  transform: `rotate(${deg}deg) translate(104px) translate(-50%, -50%)`,
                  boxShadow: "0 0 8px rgba(239,68,68,0.8)",
                }}
              />
            </motion.div>
          ))}
          <motion.div
            className="absolute w-36 h-36 rounded-full border border-red-500/20"
            animate={{ rotate: -360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          {active && (
            <motion.div
              className="absolute w-32 h-32 rounded-3xl border border-red-500/30"
              animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          {/* Core bot */}
          <motion.div
            className={`relative w-28 h-28 rounded-3xl flex items-center justify-center border-2 ${active ? "border-red-500/60" : "border-white/10"}`}
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              backdropFilter: "blur(16px)",
              boxShadow: active ? "0 0 40px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.08)" : "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <Bot className="w-14 h-14 text-red-500" strokeWidth={1.2} />
            {active && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {[0, 0.15, 0.3].map((d) => (
                  <motion.div
                    key={d}
                    className="w-1 bg-red-500 rounded-full"
                    animate={{ height: ["4px", "10px", "4px"] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: d }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Label + Status */}
        <p className="font-heading text-base font-black text-white tracking-[0.2em] mt-2">Flouba AI Engine</p>
        <div className="flex items-center gap-2 mt-2">
          <motion.div
            className={`w-2 h-2 rounded-full ${connected ? cfg.dot : "bg-gray-500"}`}
            animate={active ? { scale: [1, 1.5, 1], opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <span className={`font-heading text-xs uppercase tracking-[0.18em] ${connected ? cfg.color : "text-muted-foreground"}`}>
            {connected ? status : "Waiting for MT5 Connection"}
          </span>
        </div>
      </motion.div>

      {/* START / STOP Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <motion.button
          onClick={handleStart}
          disabled={!connected || running}
          whileTap={connected && !running ? { scale: 0.96 } : {}}
          className="h-14 rounded-2xl bg-green-600 hover:bg-green-500 disabled:opacity-25 disabled:cursor-not-allowed font-heading tracking-widest text-sm text-white flex items-center justify-center gap-2 transition-colors"
          style={connected && !running ? { boxShadow: "0 0 20px rgba(74,222,128,0.35)" } : {}}
        >
          <Play className="w-4 h-4 fill-current" />
          START
        </motion.button>
        <motion.button
          onClick={handleStop}
          disabled={!connected || !running}
          whileTap={connected && running ? { scale: 0.96 } : {}}
          className="h-14 rounded-2xl border border-red-500/40 bg-red-600/10 hover:bg-red-600/25 disabled:opacity-25 disabled:cursor-not-allowed font-heading tracking-widest text-sm text-red-400 flex items-center justify-center gap-2 transition-colors"
          style={running ? { boxShadow: "0 0 20px rgba(239,68,68,0.3)" } : {}}
        >
          <Square className="w-4 h-4 fill-current" />
          STOP
        </motion.button>
      </motion.div>

      {/* Connect MT5 Button (when disconnected) */}
      {!connected && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          onClick={() => navigate("/connect-mt5")}
          className="w-full h-12 rounded-2xl border border-red-500/30 bg-red-600/8 hover:bg-red-600/15 font-heading tracking-widest text-xs text-red-400 flex items-center justify-center gap-2 transition-colors mb-6"
        >
          <LinkIcon className="w-4 h-4" />
          Connect MT5 Account
        </motion.button>
      )}

      {/* Balance / Equity / Profit */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { label: "Balance",       value: fmt(settings.balance) },
          { label: "Equity",        value: fmt(settings.equity) },
          { label: "Today's Profit", value: fmt(settings.profit_today) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl p-3 text-center"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
              border: "1px solid rgba(255,80,80,0.1)",
            }}
          >
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className={`font-heading text-sm font-bold ${value === "--" ? "text-muted-foreground/40" : "text-white"}`}>
              {value}
            </p>
          </div>
        ))}
      </motion.div>

    </div>
  );
}