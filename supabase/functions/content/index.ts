// supabase/functions/content/index.ts
// Website content store edge function.
// Returns merged site copy (headlines, CTAs, hero text, etc.) used by the
// marketing website. Supports GET (read) and POST (write/edit).
// Called via: GET  /functions/v1/content?action=website.content
//             POST /functions/v1/content?action=website.edit

import { corsHeaders, json, errorResponse } from "../_shared/http-utils.ts";

const CONTENT_FILE = "data/site-content.json";

/** Read the site content store from local filesystem (mounted volume). */
async function readContent(): Promise<Record<string, string>> {
  try {
    const raw = await Deno.readTextFile(CONTENT_FILE);
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    // Return sensible defaults when the file doesn't exist yet
    return {
      heroHeadline: "Reinvent Yourself, Digitally.",
      heroSubhead: "Faceless digital businesses built for Gen X women who value systems over hustle.",
      ctaPrimary: "Take the Superpower Quiz",
      ctaSecondary: "Explore the Dashboard",
      about: "DigitallyDefined helps you build a faceless digital business using systems, not self-promotion.",
      footer: "© 2026 DigitallyDefined. All rights reserved.",
    };
  }
}

/** Write an updated content key back to the store. */
async function writeContent(updates: Record<string, string>): Promise<void> {
  const current = await readContent();
  const merged = { ...current, ...updates };
  await Deno.mkdir("data", { recursive: true });
  await Deno.writeTextFile(CONTENT_FILE, JSON.stringify(merged, null, 2));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (req.method === "POST" ? "website.edit" : "website.content");

  try {
    if (action === "website.content") {
      // GET — return the full content store
      const content = await readContent();
      return json({ ok: true, content });
    }

    if (action === "website.edit") {
      // POST — update one or more content keys
      const body = await req.json().catch(() => ({}));
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string" && value.length > 0) {
          updates[key] = value.slice(0, 500); // cap at 500 chars per field
        }
      }
      if (Object.keys(updates).length === 0) {
        return errorResponse(400, "No valid content fields to update");
      }
      await writeContent(updates);
      return json({ ok: true, updated: Object.keys(updates), content: await readContent() });
    }

    return errorResponse(400, `Unknown content action: ${action}`);
  } catch (err) {
    console.error("[content] error:", err);
    return errorResponse(500, err instanceof Error ? err.message : "Internal error");
  }
});
