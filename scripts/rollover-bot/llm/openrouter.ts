export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/**
 * Minimal OpenRouter chat client — same fetch pattern as
 * src/lib/server/aiEngine.ts, generalized to take an arbitrary model/messages
 * so this script can run a multi-stage pipeline against different models.
 */
export async function callOpenRouter(model: string, messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in .env — add it to run the rollover bot.");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://sportystake.com",
      "X-Title": "SportyStake Rollover Bot",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(150000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter request failed (${res.status}) for model ${model}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error(`OpenRouter returned no content for model ${model}`);
  }
  return content;
}

export function extractJson(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in model response");
  return JSON.parse(match[0]);
}
