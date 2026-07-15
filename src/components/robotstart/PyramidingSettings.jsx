export default function PyramidingSettings({ form, set, Field, NumberInput, SelectInput, Toggle }) {
  return (
    <div className="space-y-2.5">
      <Field label="Enable Pyramiding">
        <Toggle value={form.pyramiding_enabled} onChange={set("pyramiding_enabled")} />
      </Field>
      {form.pyramiding_enabled && (
        <>
          <Field label="Pyramiding Step ($)">
            <NumberInput value={form.pyramiding_step_usd} onChange={set("pyramiding_step_usd")} min={0.1} step={0.1} />
          </Field>
          <Field label="Max Layers">
            <NumberInput value={form.pyramiding_max_layers} onChange={set("pyramiding_max_layers")} min={2} />
          </Field>
          <Field label="Scale-in Lot Size">
            <NumberInput value={form.pyramiding_lot_size} onChange={set("pyramiding_lot_size")} min={0.01} step={0.01} />
          </Field>
          <Field label="Require HTF Trend">
            <Toggle value={form.pyramiding_require_trend} onChange={set("pyramiding_require_trend")} />
          </Field>
          {form.pyramiding_require_trend && (
            <>
              <Field label="Trend Timeframe">
                <SelectInput value={form.pyramiding_trend_timeframe} onChange={set("pyramiding_trend_timeframe")} options={["M15", "H1", "H4"]} />
              </Field>
              <Field label="Trend EMA Period">
                <NumberInput value={form.pyramiding_trend_ema_period} onChange={set("pyramiding_trend_ema_period")} min={5} />
              </Field>
            </>
          )}
        </>
      )}
      <Field label="Enable Trailing TP">
        <Toggle value={form.trailing_tp_enabled} onChange={set("trailing_tp_enabled")} />
      </Field>
      {form.trailing_tp_enabled && (
        <>
          <Field label="Trailing Trigger ($)">
            <NumberInput value={form.trailing_trigger_usd} onChange={set("trailing_trigger_usd")} min={0.1} step={0.1} />
          </Field>
          <Field label="Trailing Distance ($)">
            <NumberInput value={form.trailing_tp_distance_usd} onChange={set("trailing_tp_distance_usd")} min={0.1} step={0.1} />
          </Field>
          <Field label="Progressive Tightening">
            <Toggle value={form.trailing_tp_tighten_enabled} onChange={set("trailing_tp_tighten_enabled")} />
          </Field>
          {form.trailing_tp_tighten_enabled && (
            <>
              <Field label="Min Trailing Distance ($)">
                <NumberInput value={form.trailing_tp_min_distance_usd} onChange={set("trailing_tp_min_distance_usd")} min={0.1} step={0.1} />
              </Field>
              <p className="text-[9px] text-white/25 leading-relaxed">
                Distance shrinks from ${form.trailing_tp_distance_usd} to ${form.trailing_tp_min_distance_usd} as profit grows — locks in more of the trend.
              </p>
            </>
          )}
        </>
      )}
      <p className="text-[9px] text-white/25 leading-relaxed">
        Pyramiding scales into the trend by adding positions every ${form.pyramiding_step_usd} of favorable price movement. Trailing TP dynamically follows price once floating profit reaches ${form.trailing_trigger_usd}.
      </p>
    </div>
  );
}