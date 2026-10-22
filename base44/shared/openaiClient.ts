// ── Shared OpenAI Client ───────────────────────────────────────────────────
// Uses the user's OPENAI_API_KEY secret directly (no integration credits).
// No InvokeLLM fallback — if the direct call fails, returns null.
//
// All AI in Flouba Elite was migrated to the external server.
// This client is retained for any edge-case direct calls but will NOT
// fall back to Base44 InvokeLLM (which consumes integration credits).

export async function callOpenAI({ systemPrompt, userPrompt, schema, temperature = 0.3, base44Client = null }) {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return null;

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
          return null;
        }
      }
    }
  } catch {
    // Network or API error
  }

  return null;
}