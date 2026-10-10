# ✅ CANONICAL — All Supabase Edge Functions Live Here

**This is the single source of truth for every Supabase Edge Function deploy.**

Supabase project: `dijjlppdljpcgyoakdnq`

## Rules

1. **Edit and deploy functions ONLY from this folder.**
   ```bash
   cd digitallydefined-backend-clean/supabase
   supabase link --project-ref dijjlppdljpcgyoakdnq   # once, per machine
   supabase functions deploy <function-name>
   ```
2. **Do NOT** recreate a `supabase/` tree in any other repo/folder. Three legacy
   trees were consolidated here on 2026-10-09 and their CLI link state was retired
   (renamed `.temp` → `.temp.retired-20261009`) so they cannot deploy.
3. **New backend features** (HTTP routes, agents, services) go in `../src/` —
   this repo is the active backend. Only Deno edge functions go under `functions/`.

## Layout

| Path | Contents |
|---|---|
| `functions/` | 14 edge functions (see below) |
| `functions/_shared/` | 31 shared modules (AI router, publishers, Notion, email, CORS…) |
| `migrations/` | 7 SQL migrations (001–007) |
| `config.toml` | Supabase project config (`project_id = dijjlppdljpcgyoakdnq`) |

**Functions:** `analytics`, `content`, `followup`, `hermes`, `notion-sync`,
`omniroute`, `optimization-loop`, `optimization-loop-weekly`, `post-publisher`,
`quiz-roadmap`, `quiz-submit`, `reputation`, `sellable`, `sync`

## Provenance (consolidated 2026-10-09)

These were previously split across **two** live trees, both linked to the same
project — the exact "deploys overwrite each other" failure mode:

- 9 functions + 27 `_shared` modules ← `digitallydefined-os-backend/supabase/` (frozen repo)
- 5 functions (`content`, `omniroute`, `quiz-roadmap`, `quiz-submit`, `reputation`) + 4 `_shared` modules ← workspace-root `supabase/`

`_shared/brevo-email.ts` had **fully diverged** between the two trees (disjoint
APIs, no symbol collisions) and was merged: os-backend's mode-detection +
contact-sync API **plus** the root tree's `sendBrevoEmail` / `buildRoadmapEmail`.

## Validation

All 14 functions pass `deno check`. Two pre-existing type errors were fixed in
the process (they existed in the old root tree):
- `reputation/index.ts` — `callGemini` returns an object, now stringified (matches `callOmniRoute` handling).
- `quiz-submit/index.ts` — `buildRoadmapPrompt` params were implicitly `any`.

## Retired trees — do not deploy from these

| Retired location | Note |
|---|---|
| `digitallydefined-os-backend/supabase/` | Frozen repo; functions moved here. `.temp` retired. |
| `supabase/` (workspace root) | Functions moved here. `.temp` retired. |
| `digitallydefined-online-local/supabase/` | Already retired; contained only 2 duplicate migrations. `.temp` retired. |
