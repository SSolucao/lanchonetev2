-- ==============================================================================
-- Comandas System - Phase 1: Database Structure
-- ==============================================================================
-- Creates the comandas table and adds comanda_id to orders
-- ==============================================================================

-- 1. CREATE COMANDAS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL, -- Sequential number per restaurant (001, 002, 003...)
  mesa TEXT NOT NULL, -- Table/location identifier: "Mesa 5", "Balcão 2", "Área Externa 3"
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('ABERTA', 'FECHADA')),
  total NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Accumulated total from all orders
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL, -- Only set when closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_comandas_restaurant_id ON comandas(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_comandas_customer_id ON comandas(customer_id);
CREATE INDEX IF NOT EXISTS idx_comandas_status ON comandas(status);
CREATE INDEX IF NOT EXISTS idx_comandas_opened_at ON comandas(opened_at);

-- 2. ADD COMANDA_ID TO ORDERS
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'comanda_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN comanda_id UUID REFERENCES comandas(id) ON DELETE SET NULL;
    CREATE INDEX idx_orders_comanda_id ON orders(comanda_id);
  END IF;
END$$;

-- 3. FUNCTION TO GET NEXT COMANDA NUMBER
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_next_comanda_numero(p_restaurant_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1
  INTO next_num
  FROM comandas
  WHERE restaurant_id = p_restaurant_id;
  
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- 4. TRIGGER TO UPDATE COMANDA TOTAL
-- ==============================================================================
-- Automatically recalculates comanda total when orders are added/updated/deleted
CREATE OR REPLACE FUNCTION update_comanda_total()
RETURNS TRIGGER AS $$
DECLARE
  v_comanda_id UUID;
  v_new_total NUMERIC(10, 2);
BEGIN
  -- Determine which comanda_id to update
  IF TG_OP = 'DELETE' THEN
    v_comanda_id := OLD.comanda_id;
  ELSE
    v_comanda_id := NEW.comanda_id;
  END IF;
  
  -- Skip if no comanda_id
  IF v_comanda_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate new total
  SELECT COALESCE(SUM(total), 0)
  INTO v_new_total
  FROM orders
  WHERE comanda_id = v_comanda_id
    AND status != 'CANCELADO';
  
  -- Update comanda total
  UPDATE comandas
  SET total = v_new_total,
      updated_at = now()
  WHERE id = v_comanda_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order changes
DROP TRIGGER IF EXISTS trigger_update_comanda_total ON orders;
CREATE TRIGGER trigger_update_comanda_total
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_comanda_total();

-- 5. ADD UPDATED_AT TRIGGER FOR COMANDAS
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_comandas_updated_at') THEN
    CREATE TRIGGER update_comandas_updated_at 
      BEFORE UPDATE ON comandas 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- ==============================================================================
-- Script completed successfully
-- ==============================================================================
