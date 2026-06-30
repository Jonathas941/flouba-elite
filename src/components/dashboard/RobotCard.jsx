import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Play, Square } from "lucide-react";
import GlassCard from "@/components/GlassCard";

const STATUS_MAP = {
  "Running":               { color: "text-green-400",  ring: "border-green-500/50",  dot: "bg-green-400", glow: "0 0 30px rgba(74,222,128,0.5)" },
  "Waiting for Confirmation": { color: "text-amber-400",  ring: "border-amber-500/50",  dot: "bg-amber-400",  glow: "0 0 30px rgba(251,191,36,0.4)" },
  "Scanning Market":       { color: "text-sky-400",    ring: "border-sky-500/50",    dot: "bg-sky-400",    glow: "0 0 30px rgba(56,189,248,0.4)" },
  "Entering Trade":        { color: "text-yellow-400", ring: "border-yellow-500/50", dot: "bg-yellow-400", glow: "0 0 30px rgba(250,204,21,0.4)" },
  "Managing Position":     { color: "text-purple-400", ring: "border-purple-500/50", dot: "bg-purple-400", glow: "0 0 30px rgba(192,132,252,0.4)" },
  "Paused":                { color: "text-gray-400",   ring: "border-gray-500/30",   dot: "bg-gray-400",   glow: "none" },
  "Locked":                { color: "text-red-400",    ring: "border-red-500/50",    dot: "bg-red-400",    glow: "0 0 30px rgba(239,68,68,0.5)" },
};

export default function RobotCard({ status, connected, onStart, onStop }) {
  const cfg = STATUS_MAP[status] || STATUS_MAP["Paused"];
  const running = status === "Running";
  const active = running || status === "Scanning Market" || status === "Entering Trade" || status === "Managing Position";

  return (
    <GlassCard className="relative overflow-hidden py-5">
      <div className="absolute inset-0 grid-lines opacity-20 pointer-events-none" />

      {/* Robot Visual */}
      <div className="flex items-center justify-center mb-5" style={{ height: 190 }}>
        <div className="relative flex items-center justify-center">
          {/* Outer slow ring */}
          <motion.div
            className="absolute w-44 h-44 rounded-full border border-dashed border-red-500/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
          {/* Orbit dots */}
          {[0, 90, 180, 270].map((deg, i) => (
            <motion.div
              key={deg}
              className="absolute w-44 h-44"
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            >
              <div
                className="absolute w-2 h-2 bg-red-500 rounded-full neon-red"
                style={{ top: "50%", left: "50%", transform: `rotate(${deg}deg) translate(86px) translate(-50%, -50%)` }}
              />
            </motion.div>
          ))}
          {/* Inner ring */}
          <motion.div
            className="absolute w-32 h-32 rounded-full border border-red-500/30"
            animate={{ rotate: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          />
          {/* Pulse when active */}
          {active && (
            <motion.div
              className="absolute w-28 h-28 rounded-2xl border border-red-500/40"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          {/* Core bot */}
          <motion.div
            className={`relative w-24 h-24 glass rounded-2xl flex items-center justify-center border-2 ${cfg.ring}`}
            style={active ? { boxShadow: cfg.glow } : {}}
            animate={active ? { boxShadow: [cfg.glow, cfg.glow.replace("0.5", "0.9"), cfg.glow] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Bot className="w-12 h-12 text-red-500" strokeWidth={1.5} />
            {active && (
              <motion.div
                className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {[0, 0.15, 0.3].map((d) => (
                  <motion.div key={d} className="w-1 bg-red-500 rounded-full"
                    animate={{ height: ["4px", "10px", "4px"] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: d }}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-center gap-2 mb-5">
        <motion.div
          className={`w-2 h-2 rounded-full ${cfg.dot}`}
          animate={active ? { scale: [1, 1.4, 1], opacity: [1, 0.4, 1] } : {}}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <span className={`font-heading text-sm tracking-[0.15em] uppercase ${cfg.color}`}>{status || "Paused"}</span>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={onStart}
          disabled={!connected || running}
          whileTap={{ scale: 0.95 }}
          className="h-14 rounded-2xl bg-green-600 hover:bg-green-500 disabled:opacity-35 font-heading tracking-wider text-sm text-white flex items-center justify-center gap-2 transition-colors"
          style={!connected || running ? {} : { boxShadow: "0 0 16px rgba(74,222,128,0.4)" }}
        >
          <Play className="w-4 h-4 fill-current" />
          START
        </motion.button>
        <motion.button
          onClick={onStop}
          disabled={!running}
          whileTap={{ scale: 0.95 }}
          className="h-14 rounded-2xl border border-red-500/50 bg-red-600/15 hover:bg-red-600/30 disabled:opacity-35 font-heading tracking-wider text-sm text-red-400 flex items-center justify-center gap-2 transition-colors"
          style={running ? { boxShadow: "0 0 16px rgba(239,68,68,0.4)" } : {}}
        >
          <Square className="w-4 h-4 fill-current" />
          STOP
        </motion.button>
      </div>
    </GlassCard>
  );
}