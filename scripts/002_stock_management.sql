-- ==============================================================================
-- Stock Management System - Migration Script
-- ==============================================================================
-- Adds stock items and product recipes for inventory control
-- ==============================================================================

-- 1. STOCK ITEMS (Matéria-prima e itens de estoque)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT')),
  current_qty NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_qty NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_items_restaurant_id ON stock_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_is_active ON stock_items(is_active);
CREATE INDEX IF NOT EXISTS idx_stock_items_name ON stock_items(name);

-- 2. PRODUCT STOCK RECIPE (Receita de cada produto)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS product_stock_recipe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, stock_item_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_product_id ON product_stock_recipe(product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_stock_item_id ON product_stock_recipe(stock_item_id);

-- 3. STOCK TRANSACTIONS (Histórico de movimentações)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
  quantity NUMERIC(10, 2) NOT NULL,
  previous_qty NUMERIC(10, 2) NOT NULL,
  new_qty NUMERIC(10, 2) NOT NULL,
  reason TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_restaurant_id ON stock_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_stock_item_id ON stock_transactions(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_order_id ON stock_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_at ON stock_transactions(created_at);

-- ==============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stock_items_updated_at') THEN
    CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON stock_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;
