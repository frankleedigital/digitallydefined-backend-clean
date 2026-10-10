// supabase/functions/_shared/supabase-store.ts — REST persistence (service role)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEYS") || "";

function headers() {
  return {
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "apikey": SERVICE_KEY,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=representation",
  };
}

async function rest<T>(table: string, init: RequestInit & { upsertConflict?: string } = {}): Promise<T> {
  const conflict = init.upsertConflict ? `?on_conflict=${init.upsertConflict}` : "";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${conflict}`, { ...init, headers: headers() });
  if (!res.ok) throw new Error(`Supabase ${table} error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

export async function upsertLead(lead: { email: string; name?: string; tags: string[]; metadata: unknown }) {
  return rest("website_leads", {
    method: "POST",
    upsertConflict: "email,source",
    body: JSON.stringify([{ email: lead.email, name: lead.name ?? null, source: "digital-superpower-quiz", tags: lead.tags, metadata: lead.metadata }]),
  });
}

export async function storeRoadmap(row: { email: string; name?: string; superpower: string; answers: unknown; roadmap: unknown }) {
  const rows = await rest<{ id: string }[]>("quiz_roadmaps", {
    method: "POST",
    body: JSON.stringify([{ email: row.email, name: row.name ?? null, superpower: row.superpower, answers: row.answers, roadmap: row.roadmap, source: "digital-superpower-quiz" }]),
  });
  return rows?.[0] ?? null;
}

export async function getRoadmapByEmail(email: string) {
  const url = `${SUPABASE_URL}/rest/v1/quiz_roadmaps?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`;
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase query error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const rows = await res.json();
  return rows?.[0] ?? null;
}
