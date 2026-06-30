import React, { useState } from "react";
import { Drawer } from "vaul";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile-first select using Vaul Drawer instead of a Popover.
 * Props: value, onChange, options (string[] | {label, value}[]), placeholder, label
 */
export default function MobileSelect({ value, onChange, options = [], placeholder = "Select…", label, className }) {
  const [open, setOpen] = useState(false);

  const normalized = options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o
  );

  const selected = normalized.find((o) => o.value === value);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between px-4 h-11 rounded-xl glass text-sm font-semibold text-white transition-opacity active:opacity-70",
            className
          )}
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-[100]" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[101] max-w-md mx-auto outline-none"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="rounded-t-3xl overflow-hidden"
            style={{ background: "rgba(14,14,14,0.98)", border: "1px solid rgba(255,80,80,0.15)", borderBottom: "none" }}>
            {/* drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {label && (
              <p className="font-heading text-xs uppercase tracking-widest text-muted-foreground text-center py-3 border-b border-white/5">
                {label}
              </p>
            )}

            <div className="py-2 max-h-72 overflow-y-auto">
              {normalized.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center justify-between px-5 py-4 text-sm font-semibold transition-colors active:bg-white/5",
                      active ? "text-red-400" : "text-white/80 hover:text-white"
                    )}
                  >
                    {opt.label}
                    {active && <Check className="w-4 h-4 text-red-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="h-2" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}