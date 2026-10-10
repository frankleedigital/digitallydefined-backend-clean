// supabase/functions/quiz-roadmap/index.ts — GET latest roadmap for an email
import { corsHeaders, json, errorResponse } from "../_shared/http-utils.ts";
import { getRoadmapByEmail } from "../_shared/supabase-store.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return errorResponse(405, "Method not allowed");

  try {
    const email = new URL(req.url).searchParams.get("email") || "";
    if (!email) return errorResponse(400, "email query parameter is required");
    const row = await getRoadmapByEmail(email);
    if (!row) return errorResponse(404, "No roadmap found for this email");
    return json({ ok: true, roadmap: row.roadmap, superpower: row.superpower, createdAt: row.created_at });
  } catch (err) {
    return errorResponse(500, err instanceof Error ? err.message : "Internal error");
  }
});
