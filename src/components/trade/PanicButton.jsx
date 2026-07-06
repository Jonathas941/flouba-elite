import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldOff } from "lucide-react";

export default function PanicButton({ onPanic, disabled }) {
  const [confirm, setConfirm] = useState(false);
  const [executing, setExecuting] = useState(false);

  const handleFirstPress = () => {
    if (disabled) return;
    setConfirm(true);
    setTimeout(() => setConfirm(false), 4000);
  };

  const handleConfirm = async () => {
    setExecuting(true);
    await onPanic();
    setExecuting(false);
    setConfirm(false);
  };

  return (
    <div className="space-y-2">
      <AnimatePresence mode="wait">
        {!confirm ? (
          <motion.button
            key="panic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleFirstPress}
            disabled={disabled}
            whileTap={{ scale: 0.96 }}
            className="w-full h-14 rounded-2xl flex items-center justify-between px-5 font-heading font-black tracking-[0.2em] text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "rgba(220,38,38,0.12)",
              border: "1.5px solid rgba(220,38,38,0.5)",
              color: "#f87171",
              boxShadow: "0 0 20px rgba(220,38,38,0.2)",
            }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>EMERGENCY STOP</span>
            </div>
            <ShieldOff className="w-4 h-4 opacity-60" />
          </motion.button>
        ) : (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <p className="text-center text-[11px] font-heading text-red-400 tracking-widest uppercase">
              ⚠ This will close ALL open positions
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 h-12 rounded-xl font-heading font-bold text-xs tracking-widest text-white/50 border border-white/10"
              >
                CANCEL
              </button>
              <motion.button
                onClick={handleConfirm}
                disabled={executing}
                whileTap={{ scale: 0.96 }}
                className="flex-1 h-12 rounded-xl font-heading font-black text-xs tracking-widest text-white disabled:opacity-50"
                style={{ background: "rgba(220,38,38,0.9)", boxShadow: "0 0 25px rgba(220,38,38,0.5)" }}
              >
                {executing ? "CLOSING…" : "CONFIRM CLOSE ALL"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}