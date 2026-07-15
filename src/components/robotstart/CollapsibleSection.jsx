import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export default function CollapsibleSection({ title, defaultOpen = false, accent = "white", children }) {
  const [open, setOpen] = useState(defaultOpen);
  const accentClass =
    accent === "red" ? "text-red-400"
    : accent === "blue" ? "text-blue-400"
    : accent === "purple" ? "text-purple-400"
    : accent === "green" ? "text-[#00FF41]"
    : accent === "gold" ? "text-[#FFCC42]"
    : "text-white/45";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className={`text-[10px] uppercase tracking-[0.25em] font-heading font-bold ${accentClass}`}>
          {title}
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 text-white/30" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}