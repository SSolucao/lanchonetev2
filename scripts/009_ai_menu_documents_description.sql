-- ==============================================================================
-- Add description to AI menu documents
-- ==============================================================================

ALTER TABLE ai_menu_documents
  ADD COLUMN IF NOT EXISTS description TEXT;
