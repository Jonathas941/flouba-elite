import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ArrowRight } from "lucide-react";
import GlassCard from "@/components/GlassCard";

function eventColor(msg) {
  const m = (msg || "").toLowerCase();
  if (/reject|offline|failed|paused|error/.test(m)) return { dot: "bg-red-400", text: "text-red-300" };
  if (/executed|accepted|connected|online/.test(m)) return { dot: "bg-green-400", text: "text-green-300" };
  if (/validating|queued|received/.test(m)) return { dot: "bg-cyan-400", text: "text-cyan-300" };
  if (/target|cooldown/.test(m)) return { dot: "bg-amber-400", text: "text-amber-300" };
  return { dot: "bg-white/40", text: "text-white/60" };
}

export default function LiveEventFeed({ feed }) {
  const events = (feed || []).slice(0, 20);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-black text-sm text-white uppercase tracking-widest">Live Event Feed</h2>
        <span className="flex items-center gap-1 text-[9px] text-cyan-400 font-heading font-bold uppercase tracking-wider">
          <Radio className="w-3 h-3 animate-pulse" /> Live
        </span>
      </div>
      <GlassCard className="space-y-1.5 max-h-[280px] overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-[10px] text-white/30 text-center py-4 font-body">Waiting for activity…</p>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((e, i) => {
              const msg = typeof e === "string" ? e : (e?.message || e?.text || "");
              const t = typeof e === "object" ? e?.time : null;
              const c = eventColor(msg);
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-1.5 shrink-0 animate-pulse`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] ${c.text} font-body leading-snug`}>{msg}</p>
                    {t && <p className="text-[8px] text-white/25 font-mono">{new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </GlassCard>
    </div>
  );
}