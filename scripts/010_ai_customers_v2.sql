-- Add support fields for AI customers v2 flow
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_rule_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_delivery_rule_id_fkey'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_delivery_rule_id_fkey
      FOREIGN KEY (delivery_rule_id)
      REFERENCES delivery_rules(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_customers_delivery_rule_id ON customers(delivery_rule_id);
