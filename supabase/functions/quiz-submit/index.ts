// supabase/functions/quiz-submit/index.ts
// Digital Superpower Quiz pipeline:
//   score answers -> upsert lead -> generate roadmap (OmniRoute -> Gemini)
//   -> store roadmap -> send email (Brevo) -> return result

import { scoreQuiz, PERSONA_PROFILES, PERSONA_PATHWAYS } from "../_shared/quiz-personas.ts";
import { corsHeaders, json, errorResponse } from "../_shared/http-utils.ts";
import { callOmniRoute, callGemini } from "../_shared/ai-client.ts";
import { upsertLead, storeRoadmap, getRoadmapByEmail } from "../_shared/supabase-store.ts";
import { sendBrevoEmail, buildRoadmapEmail } from "../_shared/brevo-email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(405, "Method not allowed");

  try {
    const body = await req.json().catch(() => ({}));
    const { answers, name, email } = body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse(400, "A valid email is required");
    }
    if (!answers || typeof answers !== "object") {
      return errorResponse(400, "Quiz answers are required");
    }

    // 1. Score the quiz (pure, deterministic)
    const { persona, confidence, counts } = scoreQuiz(answers);
    const profile = PERSONA_PROFILES[persona];

    // 2. Upsert the lead
    await upsertLead({ email, name, tags: [`superpower:${persona}`], metadata: { answers, confidence } });

    // 3. Generate the personalized roadmap via AI
    const prompt = buildRoadmapPrompt(profile, answers, name);
    let roadmap: Record<string, unknown>;
    let provider = "omniroute";
    try {
      roadmap = await callOmniRoute(prompt);
    } catch {
      roadmap = await callGemini(prompt);
      provider = "gemini";
    }

    // 4. Store the roadmap
    const stored = await storeRoadmap({ email, name, superpower: persona, answers, roadmap });

    // 5. Send the email (non-fatal if it fails)
    let emailSent = false;
    try {
      await sendBrevoEmail({ to: email, name, subject: `Your ${profile.superpowerName} roadmap`, html: buildRoadmapEmail(profile, roadmap, name) });
      emailSent = true;
    } catch (err) {
      console.error("[quiz-submit] email failed:", err);
    }

    return json({
      ok: true,
      emailSent,
      persona,
      confidence,
      counts,
      profile,
      roadmap,
      provider,
      roadmapId: stored?.id ?? null,
    });
  } catch (err) {
    console.error("[quiz-submit] error:", err);
    return errorResponse(500, err instanceof Error ? err.message : "Internal error");
  }
});

function buildRoadmapPrompt(profile: { superpowerName: string; persona: string; strengths: string[]; businessModel: string }, answers: unknown[], name?: string) {
  const firstName = name ? `The user\'s first name is ${name}. ` : "";
  return [
    "You are Hermes, the AI business partner for DigitallyDefined.",
    "Generate a personalized digital-business roadmap for the user\'s archetype.",
    firstName,
    `Superpower type: ${profile.superpowerName} (${profile.persona}).`,
    `Strengths: ${profile.strengths.join("; ")}.`,
    `Business model: ${profile.businessModel}.`,
    `Quiz answers: ${JSON.stringify(answers)}`,
    "",
    "Return STRICT JSON only (no markdown, no code fences) with this exact shape:",
    "{\"title\":string,\"summary\":string,\"steps\":[{\"title\":string,\"description\":string,\"timeframe\":string}],\"next3Steps\":[string,string,string],\"recommendedTool\":string,\"cta\":string}",
    "Steps: 4-6 concrete phases. Tone: direct, practical, no fluff.",
  ].join("\n");
}
