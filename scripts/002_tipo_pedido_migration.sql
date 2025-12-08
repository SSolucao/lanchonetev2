-- ==============================================================================
-- Migração: Simplificação de Tipos de Pedido
-- ==============================================================================
-- Substitui channel + delivery_mode por um único campo tipo_pedido
-- Valores: BALCAO, RETIRADA, ENTREGA
-- ==============================================================================

-- Passo 1: Limpar pedidos de teste
-- ==============================================================================
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders);
DELETE FROM orders;

-- Passo 2: Garantir que a coluna tipo_pedido existe
-- ==============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'tipo_pedido'
  ) THEN
    ALTER TABLE orders ADD COLUMN tipo_pedido TEXT;
  END IF;
END $$;

-- Passo 3: Remover constraints antigas de channel e delivery_mode
-- ==============================================================================
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_mode_check;

-- Passo 4: Tornar channel e delivery_mode opcionais (para manter compatibilidade temporária)
-- ==============================================================================
ALTER TABLE orders ALTER COLUMN channel DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN delivery_mode DROP NOT NULL;

-- Passo 5: Adicionar constraint para tipo_pedido
-- ==============================================================================
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_tipo_pedido_check;
ALTER TABLE orders ADD CONSTRAINT orders_tipo_pedido_check 
  CHECK (tipo_pedido IN ('BALCAO', 'RETIRADA', 'ENTREGA', 'COMANDA'));

-- Passo 6: Tornar tipo_pedido obrigatório
-- ==============================================================================
ALTER TABLE orders ALTER COLUMN tipo_pedido SET NOT NULL;

-- Passo 7: Criar índice para tipo_pedido
-- ==============================================================================
DROP INDEX IF EXISTS idx_orders_tipo_pedido;
CREATE INDEX idx_orders_tipo_pedido ON orders(tipo_pedido);

-- ==============================================================================
-- COMENTÁRIOS
-- ==============================================================================
COMMENT ON COLUMN orders.tipo_pedido IS 'Tipo do pedido: BALCAO (venda rápida), RETIRADA (cliente busca), ENTREGA (delivery), COMANDA (consumo no local)';
COMMENT ON COLUMN orders.channel IS 'DEPRECATED: Use tipo_pedido ao invés';
COMMENT ON COLUMN orders.delivery_mode IS 'DEPRECATED: Use tipo_pedido ao invés';
