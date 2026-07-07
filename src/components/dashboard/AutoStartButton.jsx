import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Clock3 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function AutoStartButton({ settings, onUpdate }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    setEnabled(settings?.auto_start_enabled === true);
    setStartTime(settings?.auto_start_time || "09:00");
  }, [settings]);

  const save = async (newEnabled, newTime) => {
    setToggling(true);
    try {
      const records = await base44.entities.BotSettings.list();
      const patch = { auto_start_enabled: newEnabled, auto_start_time: newTime };
      if (records?.length) {
        await base44.entities.BotSettings.update(records[0].id, patch);
      }
      setEnabled(newEnabled);
      setStartTime(newTime);
      onUpdate?.({ ...settings, auto_start_enabled: newEnabled, auto_start_time: newTime });
      toast({
        title: newEnabled ? "Auto-Start Enabled" : "Auto-Start Disabled",
        description: newEnabled ? `Robot will auto-launch at ${newTime} (NY time).` : "Manual start only.",
        duration: 3000,
      });
    } catch (e) {
      toast({ title: "Toggle Failed", description: e.message, variant: "destructive" });
    }
    setToggling(false);
  };

  const toggle = () => save(!enabled, startTime);
  const onTimeChange = (e) => setStartTime(e.target.value);
  const onTimeBlur = () => { if (enabled) save(true, startTime); };

  return (
    <div className="w-full rounded-2xl overflow-hidden transition-all"
      style={{
        background: enabled ? "linear-gradient(135deg, rgba(0,255,65,0.12), rgba(0,255,65,0.03))" : "rgba(255,255,255,0.03)",
        border: enabled ? "1.5px solid rgba(0,255,65,0.45)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: enabled ? "0 0 18px rgba(0,255,65,0.15)" : "none",
      }}>
      <motion.button
        onClick={toggle}
        disabled={toggling}
        whileTap={{ scale: 0.97 }}
        className="w-full flex items-center gap-3 px-4 py-3.5"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: enabled ? "rgba(0,255,65,0.12)" : "rgba(255,255,255,0.04)",
            border: enabled ? "1px solid rgba(0,255,65,0.35)" : "1px solid rgba(255,255,255,0.08)",
          }}>
          {enabled
            ? <Clock3 className="w-5 h-5" style={{ color: "#00FF41" }} />
            : <Clock className="w-5 h-5 text-white/30" />}
        </div>
        <div className="flex-1 text-left">
          <p className="font-heading font-bold text-sm tracking-wider" style={{ color: enabled ? "#00FF41" : "#fff" }}>
            {enabled ? "AUTO-START ON" : "AUTO-START"}
          </p>
          <p className="text-[10px]" style={{ color: enabled ? "rgba(0,255,65,0.70)" : "rgba(255,255,255,0.35)" }}>
            {enabled ? `Launches daily at ${startTime}` : "Auto-launch robot at scheduled time"}
          </p>
        </div>
        <div className="w-11 h-6 rounded-full flex items-center px-0.5 transition-all shrink-0"
          style={{ background: enabled ? "#00FF41" : "rgba(255,255,255,0.10)", justifyContent: enabled ? "flex-end" : "flex-start" }}>
          <motion.div className="w-5 h-5 rounded-full bg-white shadow"
            layout transition={{ type: "spring", stiffness: 500, damping: 30 }} />
        </div>
      </motion.button>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3.5 flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-heading shrink-0">Start Time</span>
              <input
                type="time"
                value={startTime}
                onChange={onTimeChange}
                onBlur={onTimeBlur}
                className="flex-1 h-9 rounded-lg px-3 text-sm font-heading text-white bg-black/40 border border-white/10 focus:border-[#00FF41]/40 focus:outline-none"
                style={{ colorScheme: "dark" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}