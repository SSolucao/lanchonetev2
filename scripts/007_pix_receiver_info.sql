-- ==============================================================================
-- Add Pix bank/titular info to restaurants
-- ==============================================================================
-- Adds optional fields for Pix receiver details
-- ==============================================================================

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS pix_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS pix_account_holder TEXT;
