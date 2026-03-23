# Plano Completo de Migracao para VPS (Docker)

## Objetivo

Migrar o sistema atual (hoje em Vercel + Supabase) para uma VPS com Docker, aproveitando ao maximo o codigo existente e evitando retrabalho.

Premissas deste plano:
- O banco ja existe na VPS (PostgreSQL) e contem copia dos dados.
- Ainda falta migrar os arquivos de storage (imagens e documentos), que sao obrigatorios para o sistema funcionar.
- A migracao deve preservar o comportamento atual das APIs e do frontend, com mudanca minima de codigo.

---

## Diagnostico Real do Projeto (baseado no codigo)

- Framework: Next.js (App Router), APIs em `app/api/**/route.ts`.
- Inventario atual: 54 rotas API, 77 handlers HTTP.
- Dependencia forte de Supabase SDK em backend e frontend.
- Storage em uso:
  - `product-images` (upload publico via `getPublicUrl`)
  - `ai-menu-documents` (privado, com signed URL)
- Realtime em uso no frontend:
  - `src/hooks/useOrdersKanban.ts`
  - `src/hooks/useOrderNotifications.ts`
- Nao existe Dockerfile/compose no repositorio atual.
- Nao existe middleware global protegendo `/api`.
- Login atual usa comparacao simples de senha (fase 2 para hardening).

Conclusao tecnica para menor retrabalho:
- **Manter compatibilidade de contrato Supabase** (URL/keys/storage/realtime) no ambiente da VPS.
- Evitar refatoracao imediata para driver SQL puro em dezenas de arquivos.

---

## Estrategia Recomendada (Minimo Retrabalho)

### 1) Estrategia principal

Subir stack em containers com:
- App Next.js
- Nginx (reverse proxy + TLS)
- Camada compativel com Supabase (API + Storage + Realtime)
- MinIO (objeto)
- PostgreSQL da VPS como banco principal

Resultado: o app continua usando as variaveis atuais (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) sem reescrever services/queries.

### 2) Estrategia alternativa (nao recomendada para agora)

Remover Supabase do app e migrar tudo para SQL direto + S3 SDK + websocket custom.

Impacto:
- alto retrabalho,
- maior risco,
- janela de migracao maior.

---

## Arquitetura Alvo na VPS

### Containers

- `app` (Next.js buildado)
- `nginx` (porta 80/443)
- `supabase-gateway` (ou equivalente self-hosted)
- `supabase-storage` (compat storage API)
- `supabase-realtime`
- `minio` (bucket/object backend)

### Rede

- Rede Docker interna para trafego entre containers
- Somente Nginx exposto publicamente

### DNS sugerido

- `app.seudominio.com` -> Nginx -> `app:3000`
- `supabase.seudominio.com` -> Nginx -> gateway Supabase self-hosted (se separado)

### TLS

- Let's Encrypt
- renovacao automatica

---

## Plano de Acao por Fases

## Fase 0 - Preparacao e congelamento

1. Congelar deploys na Vercel durante janela de migracao.
2. Reduzir TTL DNS (ex.: 300s) 24h antes do cutover.
3. Criar backup/snapshot do PostgreSQL da VPS (pre-migracao).
4. Inventariar buckets e objetos no ambiente atual.

Checklist de saida:
- backup validado
- lista de buckets e contagem de objetos registrada

---

## Fase 1 - Banco PostgreSQL da VPS

Objetivo: garantir que schema/funcoes/triggers estejam 100% compativeis com o codigo atual.

Validar e aplicar scripts em ordem logica:
- `scripts/001_initial_schema.sql`
- `scripts/002_stock_management.sql`
- `scripts/002_tipo_pedido_migration.sql` (avaliar impacto, possui limpeza de pedidos)
- `scripts/004_delivery_fee_default.sql`
- `scripts/005_comandas_system.sql` (ou fix, conforme estado atual)
- `scripts/006_addons.sql`
- `scripts/007_products_balcao_flag.sql`
- `scripts/007_pix_receiver_info.sql`
- `scripts/008_ai_menu_documents.sql`
- `scripts/009_ai_menu_documents_description.sql`
- `scripts/010_ai_customers_v2.sql`

Pontos criticos:
- `get_next_comanda_numero` e trigger de `comandas` precisam existir (usa `rpc` no codigo).
- `update_updated_at_column` deve estar ativo para tabelas com `updated_at`.
- Nao executar scripts destrutivos em producao (ex.: limpeza completa de pedidos/produtos).

Checklist de saida:
- schema validado
- funcoes/indices/triggers validados
- consultas-chave respondendo corretamente

---

## Fase 2 - Storage (obrigatorio)

Objetivo: migrar arquivos de storage sem quebrar URLs e referencias.

Buckets obrigatorios:
- `product-images` (publico)
- `ai-menu-documents` (privado, signed URL)

Regras importantes:
- Preservar `storage_path` usado na tabela `ai_menu_documents`.
- Garantir que `createSignedUrl` funcione para `ai-menu-documents`.
- Garantir `getPublicUrl` para `product-images`.

Validacoes obrigatorias:
1. Contagem de objetos por bucket (origem x destino).
2. Amostragem de download de arquivos antigos.
3. Upload de arquivo novo via API e leitura posterior.

Checklist de saida:
- 100% dos objetos migrados
- signed/public URL funcionando

---

## Fase 3 - Containerizacao da aplicacao

Objetivo: build reproduzivel e deploy padronizado em Docker.

Entregaveis:
- `Dockerfile` multi-stage para Next.js
- `docker-compose.yml` (ou stack no Portainer)
- `.env.production` com variaveis da VPS

Variaveis obrigatorias (sem valores no repo):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY`
- `UAZAPI_URL`, `UAZAPI_MENU_URL`, `UAZAPI_SEND_DOCUMENT_URL`, `UAZAPI_TOKEN`
- `ADMIN_API_TOKEN`
- `QZ_PRIVATE_KEY_PEM`, `QZ_CERT_PEM`
- `N8N_BASE_URL` (se usado no ambiente)

Observacoes:
- remover dependencias explicitas da Vercel quando possivel (analytics).
- manter segredos apenas em variaveis/secret store.

Checklist de saida:
- app sobe em container
- APIs respondem
- logs sem erro de env faltante

---

## Fase 4 - Nginx e roteamento

Objetivo: expor app/API com HTTPS e estabilidade.

Configurar:
- reverse proxy para app Next.js
- headers de proxy e websocket
- timeouts adequados
- compressao (gzip/brotli, se desejado)
- TLS com certbot

Ajustes importantes do projeto:
- QZ CORS (`/api/qz/cert` e `/api/qz/sign`) deve incluir o novo dominio da VPS.

Checklist de saida:
- HTTPS ativo
- app navegavel externamente
- QZ endpoints autorizando origem correta

---

## Fase 5 - CI/CD com GitHub (auto deploy)

Objetivo: qualquer ajuste no repo atualizar automaticamente a VPS.

Fluxo recomendado:
1. Push na branch principal.
2. GitHub Actions builda imagem Docker.
3. Publica imagem em registry (GHCR).
4. Job de deploy via SSH na VPS executa:
   - `docker compose pull`
   - `docker compose up -d`
5. Healthcheck pos-deploy.
6. Se falhar, rollback para imagem anterior.

Boas praticas:
- versionar por SHA/tag
- guardar logs de deploy
- evitar deploy direto sem healthcheck

Checklist de saida:
- deploy automatico funcionando
- rollback testado

---

## Fase 6 - Testes de homologacao (E2E funcional)

Executar validacao completa:

1. Auth
- login em `/api/auth/login`

2. Operacao PDV
- `/api/pdv/initial-data`
- criar pedido (`/api/orders/create`, `/api/comandas/order`)
- atualizar status (`/api/orders/update-status`)

3. Cadastros
- clientes, produtos, addons, estoque, formas de pagamento

4. Storage
- upload imagem produto (`/api/products/upload-image`)
- upload/lista docs AI (`/api/ai/menu-documents`)

5. Realtime
- Kanban atualizando automaticamente
- notificacao de pedidos novos

6. Integracoes externas
- UAZAPI (texto/menu/documento)
- Google Maps Distance Matrix
- QZ cert/sign

7. Relatorios
- `/api/reports/metrics`

Checklist de saida:
- fluxos criticos validados ponta a ponta

---

## Fase 7 - Cutover (virada para producao)

1. Pausar deploys e alteracoes durante a janela.
2. Fazer delta final de dados/arquivos desde ultimo sync.
3. Atualizar DNS para VPS.
4. Monitorar logs e disponibilidade em tempo real.

Janela de observacao recomendada:
- minimo 24h com monitoramento ativo.

---

## Fase 8 - Rollback planejado

Manter Vercel/Supabase origem prontas para retorno rapido por periodo de seguranca.

Plano de rollback:
1. Reverter DNS para origem.
2. Congelar escrita na VPS se necessario.
3. Reestabelecer trafego na origem.

---

## Itens de Risco e Mitigacao

1. Storage incompleto
- Mitigacao: comparacao por contagem + amostragem + testes de upload.

2. Realtime nao operacional
- Mitigacao: validar canal realtime antes do cutover e manter polling fallback temporario.

3. Divergencia de schema
- Mitigacao: checklist SQL completo e testes de endpoints criticos.

4. Seguranca atual do app
- Mitigacao de curto prazo: restringir acesso por rede/proxy e tokens.
- Mitigacao de fase 2: hash de senha, sessao real, middleware de auth.

---

## Fase 2 Pos-Migracao (Hardening sem bloquear a migracao)

Recomendado executar apos estabilizar em producao:

1. Autenticacao
- migrar senha para hash (bcrypt/argon2)
- sessao real server-side

2. Autorizacao
- corrigir escopo de restaurante (evitar `getFirstRestaurant` como identidade)
- middleware global para APIs sensiveis

3. Segredos
- remover fallback de chave hardcoded em `deliveryFeeService`
- revisar exposicao de chaves e logs

4. Observabilidade
- logs estruturados
- alerta de erro e latencia
- monitoramento de containers

---

## Entregaveis Finais Esperados

- Ambiente Docker estavel na VPS
- Banco PostgreSQL da VPS validado com schema correto
- Storage 100% migrado e funcional
- Nginx + TLS ativo
- CI/CD GitHub -> VPS automatizado
- Rollback documentado e testado
- Checklist de homologacao assinado

---

## Sequencia Executiva (resumo rapido)

1. Validar schema/funcoes no PostgreSQL da VPS.
2. Subir stack Docker compativel com Supabase (API/Storage/Realtime).
3. Migrar buckets/arquivos de storage e validar.
4. Subir app Next.js em container com envs corretas.
5. Configurar Nginx + TLS + CORS QZ.
6. Rodar homologacao E2E.
7. Ativar CI/CD automatico por GitHub.
8. Cutover DNS + monitoracao + rollback pronto.
