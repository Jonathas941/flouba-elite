import React from "react";
import { TrendingUp } from "lucide-react";

export default function WinCompoundingSettings({ form, set, Field, NumberInput, Toggle }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        <p className="text-[9px] uppercase tracking-[0.25em] text-emerald-400 font-heading font-bold">Win Compounding</p>
      </div>
      <p className="text-[9px] text-white/25 leading-relaxed">
        Every confirmed winning trade multiplies the lot for the next trade, compounding profits to grow the account.
      </p>
      <Field label="Enable Win Compounding">
        <Toggle value={form.win_compounding_enabled} onChange={set("win_compounding_enabled")} />
      </Field>
      {form.win_compounding_enabled && (
        <>
          <Field label="Multiplier (×)">
            <NumberInput value={form.win_compounding_multiplier} onChange={set("win_compounding_multiplier")} min={1} step={0.1} />
          </Field>
          <Field label="Base Lot">
            <NumberInput value={form.win_compounding_base_lot} onChange={set("win_compounding_base_lot")} min={0.01} step={0.01} />
          </Field>
          <Field label="Max Lot (cap)">
            <NumberInput value={form.win_compounding_max_lot} onChange={set("win_compounding_max_lot")} min={0.01} step={0.05} />
          </Field>
          <Field label="Reset on Loss">
            <Toggle value={form.win_compounding_reset_on_loss} onChange={set("win_compounding_reset_on_loss")} />
          </Field>
          <p className="text-[9px] text-white/25 leading-relaxed">
            {form.win_compounding_reset_on_loss
              ? "Any losing trade resets the lot to base. The account grows safely on winning streaks."
              : "Lot never resets — compounds indefinitely up to the max cap. Higher risk."}
          </p>
        </>
      )}
    </div>
  );
}