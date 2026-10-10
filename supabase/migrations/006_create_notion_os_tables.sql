-- 006_create_notion_os_tables.sql
-- Supabase mirrors of the 8 core Notion OS databases.
-- notion-sync writes Notion→Supabase (content blocks, templates, assets, ideas);
-- Hermes + the FastAPI layer read them via the service-role key.
-- Money Snapshot / Monthly Review / Reputation Signals are Notion-only views
-- for now and are intentionally not mirrored.

CREATE TABLE IF NOT EXISTS public.notion_content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  content_type TEXT,
  niche TEXT,
  url TEXT,
  created TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notion_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  format TEXT,
  url TEXT,
  niche TEXT,
  created TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notion_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  niche TEXT,
  url TEXT,
  asset_value NUMERIC,
  created TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notion_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  source TEXT,
  niche TEXT,
  created TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notion_content_blocks_page_idx
  ON public.notion_content_blocks (notion_page_id) WHERE notion_page_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notion_templates_page_idx
  ON public.notion_templates (notion_page_id) WHERE notion_page_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notion_assets_page_idx
  ON public.notion_assets (notion_page_id) WHERE notion_page_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notion_ideas_page_idx
  ON public.notion_ideas (notion_page_id) WHERE notion_page_id IS NOT NULL;

ALTER TABLE public.notion_content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notion_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notion_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notion_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages notion content blocks" ON public.notion_content_blocks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages notion templates" ON public.notion_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages notion assets" ON public.notion_assets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages notion ideas" ON public.notion_ideas
  FOR ALL TO service_role USING (true) WITH CHECK (true);