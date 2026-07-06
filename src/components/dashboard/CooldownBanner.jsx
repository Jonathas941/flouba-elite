import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";

/**
 * Shows a live countdown when the bot is in a session-target cooldown.
 * Uses adaptive_global_cooldown_until if set, otherwise computes from
 * adaptive_daily_target_reached_at + session_cooldown_minutes.
 */
export default function CooldownBanner({ settings }) {
  const [remaining, setRemaining] = useState(null);

  const cooldownEnd = (() => {
    if (!settings) return null;
    if (settings.adaptive_global_cooldown_until) return settings.adaptive_global_cooldown_until;
    if (settings.adaptive_daily_target_reached && settings.adaptive_daily_target_reached_at) {
      const reached = new Date(settings.adaptive_daily_target_reached_at).getTime();
      const mins = settings.session_cooldown_minutes ?? 60;
      return new Date(reached + mins * 60000).toISOString();
    }
    return null;
  })();

  useEffect(() => {
    if (!cooldownEnd) { setRemaining(null); return; }
    const tick = () => {
      const ms = new Date(cooldownEnd).getTime() - Date.now();
      setRemaining(ms > 0 ? ms : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownEnd]);

  if (!cooldownEnd || !remaining) return null;

  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const label = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  const pct = Math.min(100, Math.round((1 - remaining / ((settings?.session_cooldown_minutes ?? 60) * 60000)) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4 flex items-center gap-3 overflow-hidden"
      style={{ border: "1px solid rgba(255,206,77,0.30)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(255,206,77,0.10)", border: "1px solid rgba(255,206,77,0.35)" }}
      >
        <Timer className="w-5 h-5 text-[#ffce4d]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold text-[12px] text-[#ffce4d] tracking-wide">Session Target Reached</p>
        <p className="text-[10px] text-white/45 leading-tight">Bot in cooldown — resumes automatically</p>
        <div className="mt-1.5 h-1 rounded-full bg-white/8 overflow-hidden" style={{ maxWidth: 160 }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #ffce4d, #ff9d4d)" }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[8px] uppercase tracking-widest text-white/35 font-heading">Resumes In</p>
        <p className="font-heading font-black text-[16px] text-white tabular-nums tracking-wider">{label}</p>
      </div>
    </motion.div>
  );
}