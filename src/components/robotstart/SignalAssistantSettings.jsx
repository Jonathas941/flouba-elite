export default function SignalAssistantSettings({ saForm, setSa, Field, NumberInput, SelectInput, Toggle }) {
  return (
    <div className="space-y-2.5">
      <Field label="Execution Mode">
        <SelectInput value={saForm.execution_mode} onChange={setSa("execution_mode")} options={["signal_only", "semi_auto", "full_auto"]} />
      </Field>
      <p className="text-[9px] text-white/25 leading-relaxed">
        {saForm.execution_mode === "signal_only"
          ? "Signal Only: scans and displays signals on the chart and dashboard. No auto-trading. You decide manually."
          : saForm.execution_mode === "semi_auto"
          ? "Semi-Auto: shows signals with BUY NOW / SELL NOW / PLACE PENDING / CANCEL buttons. You confirm each trade."
          : "Full Auto: displays the signal, waits for price to reach entry, then executes automatically with SL and TP."}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Show on Chart">
          <Toggle value={saForm.show_signals_on_chart} onChange={setSa("show_signals_on_chart")} />
        </Field>
        <Field label="Auto Trading">
          <Toggle value={saForm.auto_trading_enabled} onChange={setSa("auto_trading_enabled")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Manual Execution">
          <Toggle value={saForm.manual_execution_enabled} onChange={setSa("manual_execution_enabled")} />
        </Field>
        <Field label="Virtual Trigger">
          <Toggle value={saForm.virtual_trigger_mode} onChange={setSa("virtual_trigger_mode")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Broker Pending">
          <Toggle value={saForm.broker_pending_order_mode} onChange={setSa("broker_pending_order_mode")} />
        </Field>
        <Field label="Cancel Expired">
          <Toggle value={saForm.cancel_expired_signals} onChange={setSa("cancel_expired_signals")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Draw Entry/SL/TP">
          <Toggle value={saForm.draw_entry_sl_tp_lines} onChange={setSa("draw_entry_sl_tp_lines")} />
        </Field>
        <Field label="Draw Arrows">
          <Toggle value={saForm.draw_direction_arrows} onChange={setSa("draw_direction_arrows")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Expiration Timer">
          <Toggle value={saForm.show_expiration_timer} onChange={setSa("show_expiration_timer")} />
        </Field>
        <Field label="Min Confidence">
          <NumberInput value={saForm.min_confidence_score} onChange={setSa("min_confidence_score")} min={0} max={100} />
        </Field>
      </div>

      <Field label="Signal Expiration (min)">
        <NumberInput value={saForm.signal_expiration_minutes} onChange={setSa("signal_expiration_minutes")} min={1} />
      </Field>

      <p className="text-[9px] text-white/25 leading-relaxed">
        Virtual Trigger monitors live price and executes when ask/bid reaches entry. Broker Pending places a real MT5 pending order immediately.
        Trade comment: "{saForm.trade_comment || "Flouba Gold HFT"}"
      </p>
    </div>
  );
}