import React from "react";

const HTF_OPTIONS = ["M15", "H1"];

export default function TrendFilterSettings({ form, set, Field, NumberInput, SelectInput, Toggle }) {
  return (
    <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 px-4 py-4 space-y-2.5">
      <p className="text-[9px] uppercase tracking-[0.25em] text-blue-400 font-heading font-bold">📈 Trend Filter (Higher Timeframe)</p>
      <Field label="Enable Trend Filter">
        <Toggle value={form.trend_filter_enabled} onChange={set("trend_filter_enabled")} />
      </Field>
      {form.trend_filter_enabled && (
        <>
          <Field label="HTF Chart">
            <SelectInput value={form.trend_filter_timeframe} onChange={set("trend_filter_timeframe")} options={HTF_OPTIONS} />
          </Field>
          <Field label="EMA Period">
            <NumberInput value={form.trend_filter_ema_period} onChange={set("trend_filter_ema_period")} min={50} step={10} />
          </Field>
        </>
      )}
      <p className="text-[9px] text-white/25 leading-relaxed">
        Identifies the broader direction on the {form.trend_filter_timeframe} chart using the {form.trend_filter_ema_period} EMA. Only takes Buy positions above the EMA and Sell positions below it — applies to every strategy.
      </p>
    </div>
  );
}