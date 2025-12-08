-- Add delivery_fee_default column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_fee_default DECIMAL(10,2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN customers.delivery_fee_default IS 'Default delivery fee calculated and saved when customer address is registered';
