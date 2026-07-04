import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { ShieldCheck, Loader2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  {
    key: "news_filter",
    label: "News Filter",
    desc: "Block trades around high-impact news releases.",
  },
  {
    key: "trend_filter_enabled",
    label: "HTF Trend Filter",
    desc: "Only buy above / sell below the HTF 200 EMA.",
  },
  {
    key: "volatility_filter",
    label: "Volatility Filter",
    desc: "Skip entries when ATR is outside the allowed band.",
  },
  {
    key: "spread_filter",
    label: "Spread Filter",
    desc: "Reject orders when the live spread is too wide.",
  },
  {
    key: "break_even",
    label: "Break-Even",
    desc: "Move SL to entry once price reaches a set threshold.",
  },
  {
    key: "trailing_stop",
    label: "Trailing Stop",
    desc: "Trail the stop loss behind price to lock in profit.",
  },
];

export default function StrategyFilterToggles() {
  const { toast } = useToast();
  const [settingsId, setSettingsId] = useState(null);
  const [toggles, setToggles] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.BotSettings.list("-created_date", 1);
        const s = list[0];
        if (s) {
          setSettingsId(s.id);
          setToggles(
            FILTERS.reduce((acc, f) => ({ ...acc, [f.key]: s[f.key] ?? false }), {})
          );
        }
      } catch {
        /* ignore — keep all off */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async (key) => {
    if (savingKey) return;
    const next = !toggles[key];
    setToggles((p) => ({ ...p, [key]: next }));
    setSavingKey(key);
    try {
      const payload = { [key]: next };
      if (settingsId) {
        await base44.entities.BotSettings.update(settingsId, payload);
      } else {
        const created = await base44.entities.BotSettings.create(payload);
        setSettingsId(created.id);
      }
      toast({
        title: next ? "Filter enabled" : "Filter disabled",
        description: FILTERS.find((f) => f.key === key)?.label,
        duration: 2000,
      });
    } catch {
      // revert on failure
      setToggles((p) => ({ ...p, [key]: !next }));
      toast({
        title: "Update failed",
        description: "Could not save the filter change.",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <SlidersHorizontal className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-sm font-bold text-white">Logic Filters</h3>
          <p className="text-xs text-muted-foreground">Turn individual confirmation filters on or off.</p>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : (
          FILTERS.map((f, i) => (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{f.label}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{f.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(f.key)}
                disabled={!!savingKey}
                className={cn(
                  "relative w-12 h-7 rounded-full transition-colors shrink-0",
                  toggles[f.key] ? "bg-red-600 neon-red" : "bg-white/10"
                )}
                aria-pressed={!!toggles[f.key]}
              >
                <span
                  className={cn(
                    "absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all",
                    toggles[f.key] ? "left-6" : "left-1"
                  )}
                />
              </button>
            </motion.div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-t border-white/5">
        <ShieldCheck className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <p className="text-[10px] text-muted-foreground leading-tight">
          Changes apply live to the robot on its next scan cycle.
        </p>
      </div>
    </GlassCard>
  );
}