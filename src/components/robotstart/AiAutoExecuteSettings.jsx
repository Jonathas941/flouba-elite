export default function AiAutoExecuteSettings({ form, set, Field, NumberInput, Toggle }) {
  return (
    <div className="space-y-2.5">
      <Field label="Enable AI Auto-Execute">
        <Toggle value={form.ai_auto_execute_enabled} onChange={set("ai_auto_execute_enabled")} />
      </Field>
      {form.ai_auto_execute_enabled && (
        <>
          <Field label="Min Confluence Score">
            <NumberInput value={form.ai_auto_execute_min_score} onChange={set("ai_auto_execute_min_score")} min={0} max={100} />
          </Field>
          <p className="text-[9px] text-white/25 leading-relaxed">
            When enabled, the robot automatically places a trade whenever the AI Trade Decision Engine
            produces a signal with a confluence score ≥ {form.ai_auto_execute_min_score} across all 15 strategies.
            Runs every 5 minutes.
          </p>
        </>
      )}
      {!form.ai_auto_execute_enabled && (
        <p className="text-[9px] text-white/25 leading-relaxed">
          AI Auto-Execute lets the robot trade autonomously based on AI signals from all strategies.
          You can also manually execute signals from the AI Signals page.
        </p>
      )}
    </div>
  );
}