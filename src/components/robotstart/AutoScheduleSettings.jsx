import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Lock } from "lucide-react";

export default function AutoScheduleSettings({ form, set, Field, Toggle }) {
  return (
    <div className="rounded-2xl border border-purple-500/25 bg-purple-500/5 px-4 py-4 space-y-2.5">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="w-3.5 h-3.5 text-purple-400" />
        <p className="text-[9px] uppercase tracking-[0.25em] text-purple-400 font-heading font-bold">
          📅 Auto Schedule
        </p>
      </div>

      {/* Auto-Start toggle */}
      <Field label="Auto-Start (Daily)">
        <Toggle value={form.auto_start_enabled} onChange={set("auto_start_enabled")} />
      </Field>

      {/* Auto-Start time picker */}
      <AnimatePresence>
        {form.auto_start_enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Field label="Start Time">
              <input
                type="time"
                value={form.auto_start_time}
                onChange={(e) => set("auto_start_time")(e.target.value)}
                className="w-24 text-right px-2 py-1.5 rounded-lg font-heading font-bold text-xs text-white bg-white/5 border border-white/10 focus:border-purple-500/40 focus:outline-none"
              />
            </Field>
            <p className="text-[9px] text-white/25 leading-relaxed mt-1">
              Robot auto-launches at this time (America/Detroit) if not already running.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Stop toggle — permanently locked ON for account safety */}
      <Field label="Auto-Stop on Limit">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-green-400" />
          <div className="w-11 h-6 rounded-full bg-green-500 flex items-center pointer-events-none">
            <div className="w-5 h-5 rounded-full bg-white shadow ml-[22px]" />
          </div>
        </div>
      </Field>

      <p className="text-[9px] text-white/25 leading-relaxed">
        Auto-stops the robot when daily profit target (${form.daily_profit_target}) or loss limit
        (${form.daily_loss_limit}) is reached. A background monitor checks every 5 minutes.
      </p>
    </div>
  );
}