// ── Shared OpenAI Client ───────────────────────────────────────────────────
// Uses the user's OPENAI_API_KEY secret directly (no integration credits).
// Falls back to built-in InvokeLLM with gpt_5_mini if the direct call fails.
//
// All AI automation in Flouba Elite routes through this client so that OpenAI
// is the single source of truth for every AI decision: market structure, SL/TP,
// strategy selection, news risk monitoring, and fallback trade analysis.

export async function callOpenAI({ systemPrompt, userPrompt, schema, temperature = 0.3, base44Client = null }) {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  // ── 1. Try OpenAI API directly (user's own key — no integration credits) ──
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt || "You are an expert trading analyst. Respond only with valid JSON matching the requested schema." },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          try {
            return { ...JSON.parse(content), _source: "openai_direct" };
          } catch {
            // JSON parse failed — fall through
          }
        }
      }
    } catch {
      // Network or API error — fall through
    }
  }

  // ── 2. Fall back to built-in InvokeLLM with OpenAI model ──
  if (base44Client) {
    try {
      const res = await base44Client.integrations.Core.InvokeLLM({
        prompt: userPrompt,
        response_json_schema: schema,
        model: "gpt_5_mini",
      });
      return { ...res, _source: "invoke_llm_gpt" };
    } catch {
      // Fall through
    }
  }

  return null;
}