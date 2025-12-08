-- Script para deletar todos os produtos e dados relacionados
-- Útil para resetar o sistema após mudanças no esquema de estoque

-- Deletar itens de pedidos (order_items)
DELETE FROM order_items;

-- Deletar pedidos (orders)
DELETE FROM orders;

-- Deletar itens de combo (product_combo_items)
DELETE FROM product_combo_items;

-- Deletar receitas de produtos (product_stock_recipe)
DELETE FROM product_stock_recipe;

-- Deletar produtos (products)
DELETE FROM products;

-- Resetar sequências se necessário
-- (Opcional: apenas se quiser começar os IDs do zero novamente)
