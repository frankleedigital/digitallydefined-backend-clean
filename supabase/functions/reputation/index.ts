// supabase/functions/reputation/index.ts
// Niche reputation intelligence edge function.
// Evaluates demand + trust signals for a proposed digital niche.
// Called via: POST /functions/v1/reputation  { niche, evidence? }
// Also callable as agent.reputation through the Hermes dispatcher.

import { corsHeaders, json, errorResponse } from "../_shared/http-utils.ts";
import { callOmniRoute, callGemini } from "../_shared/ai-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(405, "Method not allowed");

  try {
    const body = await req.json().catch(() => ({}));
    const niche = String(body.niche || body.query || "").trim();
    if (!niche) return errorResponse(400, "A 'niche' field is required");

    const evidence = body.evidence || {};
    const prompt = [
      "You are the DigitallyDefined Niche Reputation Analyzer.",
      `Evaluate the reputation signals and market viability for the niche: "${niche}".`,
      `Supplied evidence: ${JSON.stringify(evidence)}`,
      "",
      "Do NOT claim live market research unless evidence is supplied.",
      "Return STRICT JSON only (no markdown, no code fences):",
      '{"niche":"...","demandScore":7,"competitionScore":5,"reputationSignals":["..."],"recommendation":"..."}',
      "Scores 1-10. Be direct and practical.",
    ].join("\n");

    let reply: string;
    let provider = "omniroute";
    try {
      const data = await callOmniRoute(prompt);
      reply = typeof data === "string" ? data : JSON.stringify(data);
    } catch {
      const geminiData = await callGemini(prompt);
      reply = typeof geminiData === "string" ? geminiData : JSON.stringify(geminiData);
      provider = "gemini";
    }

    // Parse and validate the response
    const cleaned = reply.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Extract first JSON object if wrapped in text
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return errorResponse(502, "Invalid AI response format");
      try { parsed = JSON.parse(match[0]); } catch { return errorResponse(502, "Could not parse AI response"); }
    }

    return json({
      ok: true,
      niche: parsed.niche || niche,
      demandScore: typeof parsed.demandScore === "number" ? parsed.demandScore : 5,
      competitionScore: typeof parsed.competitionScore === "number" ? parsed.competitionScore : 5,
      reputationSignals: Array.isArray(parsed.reputationSignals) ? parsed.reputationSignals : [],
      recommendation: parsed.recommendation || "Validate with real traffic before building.",
      provider,
    });
  } catch (err) {
    console.error("[reputation] error:", err);
    return errorResponse(500, err instanceof Error ? err.message : "Internal error");
  }
});
