import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, ZapOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function HftModeButton({ settings, onUpdate }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    setEnabled(settings?.hft_mode_enabled === true);
  }, [settings]);

  const toggle = async () => {
    setToggling(true);
    const newVal = !enabled;
    try {
      const records = await base44.entities.BotSettings.list();
      if (records?.length) {
        await base44.entities.BotSettings.update(records[0].id, {
          hft_mode_enabled: newVal,
          ...(newVal ? { hft_current_lot: records[0].hft_base_lot ?? 0.01, hft_consecutive_profits: 0 } : {}),
        });
      }
      setEnabled(newVal);
      onUpdate?.({ ...settings, hft_mode_enabled: newVal });

      toast({
        title: newVal ? "⚠ DANGER MODE ACTIVATED" : "HFT Mode Disabled",
        description: newVal
          ? "ALL rules bypassed. Scalping any profit. Lot multiplies on each win."
          : "Normal trading rules restored.",
        duration: 4000,
      });
    } catch (e) {
      toast({ title: "Toggle Failed", description: e.message, variant: "destructive" });
    }
    setToggling(false);
  };

  return (
    <motion.button
      onClick={toggle}
      disabled={toggling}
      whileTap={{ scale: 0.97 }}
      className="w-full rounded-2xl flex items-center gap-3 px-4 py-3.5 transition-all"
      style={{
        background: enabled
          ? "linear-gradient(135deg, rgba(255,49,49,0.18), rgba(255,49,49,0.05))"
          : "rgba(255,255,255,0.03)",
        border: enabled ? "1.5px solid rgba(255,49,49,0.55)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: enabled ? "0 0 22px rgba(255,49,49,0.25)" : "none",
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: enabled ? "rgba(255,49,49,0.15)" : "rgba(255,255,255,0.04)",
          border: enabled ? "1px solid rgba(255,49,49,0.40)" : "1px solid rgba(255,255,255,0.08)",
        }}>
        {enabled
          ? <Zap className="w-5 h-5" style={{ color: "#FF3131" }} fill="currentColor" />
          : <ZapOff className="w-5 h-5 text-white/30" />}
      </div>
      <div className="flex-1 text-left">
        <p className="font-heading font-bold text-sm tracking-wider" style={{ color: enabled ? "#FF3131" : "#fff" }}>
          {enabled ? "⚠ DANGER MODE" : "HFT MODE"}
        </p>
        <p className="text-[10px]" style={{ color: enabled ? "rgba(255,49,49,0.70)" : "rgba(255,255,255,0.35)" }}>
          {enabled ? "ALL RULES BYPASSED — Scalping any profit · Lot compounding on wins" : "Bypass all rules · Scalp any profit · Compound lots"}
        </p>
      </div>
      <div className="w-11 h-6 rounded-full flex items-center px-0.5 transition-all shrink-0"
        style={{ background: enabled ? "#FF3131" : "rgba(255,255,255,0.10)", justifyContent: enabled ? "flex-end" : "flex-start" }}>
        <motion.div className="w-5 h-5 rounded-full bg-white shadow"
          layout transition={{ type: "spring", stiffness: 500, damping: 30 }} />
      </div>
    </motion.button>
  );
}