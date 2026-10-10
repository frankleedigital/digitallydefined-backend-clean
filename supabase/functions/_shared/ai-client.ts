// supabase/functions/_shared/ai-client.ts — AI calls with JSON parsing
// OmniRoute first (any configured base URL), direct Gemini fallback.

const TIMEOUT_MS = 90_000;

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function chatCompletion(baseUrl: string, apiKey: string, model: string, prompt: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI provider ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return JSON.parse(stripFences(content));
  } finally {
    clearTimeout(timer);
  }
}

/** OmniRoute via any configured base URL (OMNIROUTE_URL, then OMNIROUTE_BASE_URL). */
export async function callOmniRoute(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("OMNIROUTE_API_KEY") || "";
  if (!apiKey) throw new Error("OMNIROUTE_API_KEY not configured");
  const bases = [Deno.env.get("OMNIROUTE_URL"), Deno.env.get("OMNIROUTE_BASE_URL")].filter(Boolean) as string[];
  if (bases.length === 0) throw new Error("No OmniRoute base URL configured");
  const model = Deno.env.get("OMNIROUTE_MODEL") || "dd-combo";
  let lastError: unknown = new Error("no base attempted");
  for (const base of bases) {
    try {
      return await chatCompletion(base, apiKey, model, prompt);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Direct Gemini fallback (public endpoint — reachable from Supabase cloud). */
export async function callGemini(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const base = "https://generativelanguage.googleapis.com/v1beta/openai";
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
  return chatCompletion(base, apiKey, model, prompt);
}
