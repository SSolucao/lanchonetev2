-- Add flag to mark products available for Balcao (quick sale)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_balcao BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_balcao ON products(is_balcao);
