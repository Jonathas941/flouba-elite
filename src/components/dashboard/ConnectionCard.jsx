import React from "react";
import { motion } from "framer-motion";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import GlassCard from "@/components/GlassCard";

export default function ConnectionCard({ settings, onToggle }) {
  const connected = settings?.connection_status === "Connected";

  return (
    <GlassCard className="relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-10 pointer-events-none ${connected ? "bg-green-500" : "bg-red-600"}`} />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <motion.div
            className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
            animate={connected ? { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] } : { scale: 1 }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className={`font-heading text-xs tracking-[0.2em] uppercase font-bold ${connected ? "text-green-400" : "text-red-400"}`}>
            {settings?.connection_status || "Disconnected"}
          </span>
        </div>
        <button onClick={onToggle} className="glass w-9 h-9 rounded-xl flex items-center justify-center">
          {connected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {[
          { label: "MT5 Server", value: settings?.mt5_server || "Flouba-Live01" },
          { label: "Broker", value: settings?.broker_name || "Flouba Broker" },
          { label: "Account #", value: settings?.mt5_account || "5012984" },
          { label: "Robot", value: settings?.robot_version || "v2.4.1" },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</p>
            <p className="text-sm font-semibold text-white mt-0.5 truncate">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5">
        <RefreshCw className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Last sync: {connected ? "2 seconds ago" : "N/A"}
        </span>
      </div>
    </GlassCard>
  );
}