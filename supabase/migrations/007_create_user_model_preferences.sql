-- 007_create_user_model_preferences.sql
-- Dashboard AI model selector persistence.
-- set-model (backend-clean) and hermes.setActiveModel (edge function) both
-- write here so the active OmniRoute model survives cold starts.

CREATE TABLE IF NOT EXISTS public.user_model_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_model_preferences_user_id_idx
  ON public.user_model_preferences (user_id);

ALTER TABLE public.user_model_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages user model preferences" ON public.user_model_preferences
  FOR ALL TO service_role USING (true) WITH CHECK (true);
