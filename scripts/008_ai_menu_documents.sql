-- ==============================================================================
-- AI Menu Documents (PDF/Images)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS ai_menu_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_menu_documents_restaurant_id ON ai_menu_documents(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_menu_documents_storage_path_unique ON ai_menu_documents(storage_path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_menu_documents_one_active_per_restaurant
  ON ai_menu_documents(restaurant_id)
  WHERE is_active = true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ai_menu_documents_updated_at') THEN
    CREATE TRIGGER update_ai_menu_documents_updated_at
      BEFORE UPDATE ON ai_menu_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-menu-documents', 'ai-menu-documents', false)
ON CONFLICT (id) DO NOTHING;
