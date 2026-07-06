import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, OctagonX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BotActionButtons({ connected, active, onPause, onStopAll }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const handlePause = async () => {
    if (!connected) return;
    setBusy(true);
    try { await onPause?.(); } finally { setBusy(false); }
  };
  const handleStopAll = async () => {
    setBusy(true);
    try { await onStopAll?.(); } finally { setBusy(false); setConfirm(false); }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handlePause}
          disabled={!connected || !active || busy}
          className="h-14 rounded-2xl flex items-center justify-center gap-2 font-heading font-bold tracking-widest text-[11px] disabled:opacity-35 transition-all"
          style={{
            background: "rgba(0,255,65,0.06)",
            border: "1.5px solid rgba(0,255,65,0.5)",
            color: "#00FF41",
            boxShadow: "0 0 16px rgba(0,255,65,0.18)",
          }}
        >
          <Pause className="w-4 h-4 fill-current" />
          PAUSE BOT
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setConfirm(true)}
          disabled={!connected || busy}
          className="h-14 rounded-2xl flex items-center justify-center gap-2 font-heading font-bold tracking-widest text-[11px] disabled:opacity-35 transition-all"
          style={{
            background: "rgba(255,49,49,0.05)",
            border: "1.5px solid rgba(255,49,49,0.5)",
            color: "#FF3131",
            boxShadow: "0 0 16px rgba(255,49,49,0.18)",
          }}
        >
          <OctagonX className="w-4 h-4" />
          STOP ALL
        </motion.button>
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
            onClick={() => !busy && setConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-3xl p-6 w-full max-w-sm text-center"
            >
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
                style={{ background: "rgba(255,49,49,0.12)", border: "1px solid rgba(255,49,49,0.4)" }}>
                <ShieldAlert className="w-7 h-7 text-[#FF3131]" />
              </div>
              <h3 className="font-heading font-black text-white text-lg tracking-wider">STOP ALL?</h3>
              <p className="text-[12px] text-white/55 mt-1.5 leading-relaxed">
                This will pause the robot and request the connected MT5 backend to close all open positions.
              </p>
              <div className="flex gap-2.5 mt-5">
                <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy}
                  className="flex-1 h-11 rounded-xl text-white/70 hover:bg-white/5">
                  Cancel
                </Button>
                <Button onClick={handleStopAll} disabled={busy}
                  className="flex-1 h-11 rounded-xl border border-red-500/50 bg-red-500/15 hover:bg-red-500/25 text-[#FF3131] font-heading tracking-widest text-[11px]">
                  {busy ? "STOPPING…" : "CONFIRM STOP"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}