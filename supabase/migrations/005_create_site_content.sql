-- ============================================================
-- 005_create_site_content.sql
-- Live website content store used by the Hermes `website.edit`
-- and `website.content` actions. Holds text overrides for
-- editable site copy keyed by a stable "section.field" key.
--
-- The marketing site reads these at runtime and falls back to
-- hardcoded defaults when a key has no row yet, so edits appear
-- on the next normal frontend deploy (or instantly on the live
-- page once the site is wired to fetch at runtime).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_content_content_key_idx
  ON public.site_content (content_key);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Service role (used by the Hermes edge function) can read/write.
CREATE POLICY "Service role manages site content" ON public.site_content
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anonymous/marketing site may read overrides (they are public site copy).
CREATE POLICY "Public can read site content" ON public.site_content
  FOR SELECT TO anon, authenticated USING (true);