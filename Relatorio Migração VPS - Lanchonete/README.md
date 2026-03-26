# 🍔 lanchonetev2 — Sistema de Gestão para Food Service

Sistema web de gestão operacional para estabelecimentos do setor de **food service** (lanchonetes, hot dog, hamburguerias e similares). Centraliza **PDV**, controle de pedidos via **Kanban em tempo real**, gestão de clientes, estoque e relatórios em uma interface única acessível pelo navegador. Hospedado em **VPS própria com Docker**, sem dependência de plataformas SaaS de terceiros para o core da operação.

---

## 📁 Estrutura do Repositório

```
lanchonetev2/
├── app/                        # Rotas e páginas Next.js (App Router)
│   └── api/                    # 54 rotas de API / 77 handlers HTTP
├── src/                        # Hooks, serviços e lógica de negócio
│   └── hooks/
│       ├── useOrdersKanban.ts  # Realtime — Kanban de pedidos
│       └── useOrderNotifications.ts  # Realtime — notificações
├── components/                 # Componentes React reutilizáveis
├── lib/                        # Utilitários e configurações
├── scripts/                    # Scripts SQL de migração do banco
│   ├── 001_initial_schema.sql
│   ├── 002_stock_management.sql
│   ├── 005_comandas_system.sql
│   ├── 008_ai_menu_documents.sql
│   └── ...
├── .github/
│   └── workflows/
│       └── deploy.yml          # Pipeline CI/CD GitHub Actions → VPS
├── Dockerfile                  # Build multi-stage Next.js
├── .env.production             # Variáveis de ambiente (não versionar)
└── next.config.mjs
```

> ⚠️ **O arquivo `.env.production` contém segredos reais e nunca deve ser commitado.** Veja a seção [Configuração](#%EF%B8%8F-configuração) abaixo.

---

## 🏗️ Arquitetura

```
Usuário (Navegador)
        │
        ▼
┌───────────────────────────────────────────┐
│   Traefik v3.4 (Reverse Proxy + TLS)      │  ← HTTPS via Let's Encrypt
│   systemfood.lanchonete.supersolucao.com.br│
└────────────────────┬──────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────┐
│   lanchonetev2-web (Next.js 16)            │  ← App Router + API Routes
│                                           │
│   PDV → Pedido → Kanban (Realtime)        │
│   Cadastros → Relatórios → Configurações  │
└──────┬──────────────────┬─────────────────┘
       │                  │
       ▼                  ▼
┌─────────────┐   ┌───────────────────────┐
│ PostgreSQL  │   │   MinIO (Storage S3)  │
│ (lanchonete)│   │                       │
│             │   │ product-images/       │  ← Público
│ 15 tabelas  │   │ ai-menu-documents/    │  ← Privado (signed URL)
└─────────────┘   └───────────────────────┘
       │
       ▼
┌───────────────────────────────────────────┐
│   Supabase                                │
│   Auth + Realtime (Kanban/Notificações)   │  ← Migração futura para VPS
└───────────────────────────────────────────┘
```

---

## 📋 Módulos do Sistema

### 1. `PDV — Ponto de Venda`

Interface principal de atendimento. Exibe catálogo de produtos por categoria, permite montagem de pedido com observações, seleção de cliente, tipo (balcão/entrega), forma de pagamento e cálculo automático de taxa de entrega via Google Maps.

**Fluxo:**
```
Seleciona produtos → Adiciona ao carrinho → Informa cliente
  → Tipo de pedido (Balcão / Entrega)
        → Entrega: busca taxa via Google Maps Distance Matrix
        → Balcão: sem taxa
  → Forma de pagamento → Confirma pedido
  → Gera comanda de cozinha + cupom de balcão (PDF)
  → Pedido aparece no Kanban em tempo real
```

---

### 2. `Kanban de Pedidos`

Visualização em tempo real dos pedidos em andamento. Atualiza automaticamente via Supabase Realtime sem necessidade de refresh.

**Colunas:** Novo → Em preparo → Saiu para entrega → Finalizado

---

### 3. `Comandas`

Controle de comandas abertas por mesa ou atendimento. Permite agregar múltiplos pedidos em uma mesma comanda.

---

### 4. `Cadastros`

- **Clientes:** nome, telefone, endereço completo (CEP, rua, número, bairro, cidade, complemento, observações)
- **Produtos:** simples e combos, com categoria, preço, descrição e receita de estoque
- **Configurações:** dados do estabelecimento, formas de pagamento, regras de entrega por distância, controle de estoque

---

### 5. `Relatórios`

Análise de vendas por período: faturamento, taxas de entrega, total de pedidos, ticket médio, top 3 produtos mais vendidos, melhor e pior dia.

---

### 6. `AI Menu Documents`

Upload e gerenciamento de documentos de cardápio para uso com IA. Arquivos armazenados no MinIO com acesso via signed URL.

---

## 🔌 Integrações

| Serviço | Uso | Autenticação |
|---|---|---|
| Supabase | Auth de usuários + Realtime (Kanban/notificações) | ANON_KEY / SERVICE_ROLE_KEY |
| Google Maps API | Cálculo automático de taxa de entrega por distância | API Key |
| UAZAPI (WhatsApp) | Envio de mensagens, menu e documentos | Token + URL base |
| MinIO (S3 compatível) | Storage de imagens de produtos e documentos de menu | Access Key / Secret Key |
| QZ Tray | Impressão térmica direta no estabelecimento | Chave RSA + Certificado PEM |
| N8N | Automações e webhooks de integração | URL base |
| GitHub Actions | CI/CD automático (push na main → deploy na VPS) | SSH Key (secret) |

---

## ⚙️ Configuração

### Pré-requisitos

- Node.js 20+
- Docker + Docker Swarm (para produção na VPS)
- PostgreSQL 14 acessível
- MinIO rodando com buckets `product-images` (público) e `ai-menu-documents` (privado)
- Traefik configurado na VPS com certresolver Let's Encrypt
- Projeto no Supabase com Auth e Realtime habilitados
- API Key do Google Maps com Distance Matrix ativa
- Instância UAZAPI conectada a um número WhatsApp (se usar integração)

### Variáveis de Ambiente

Criar o arquivo `.env.production` (ou `.env.local` para desenvolvimento) com as seguintes variáveis:

| Variável | Descrição | Origem |
|---|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL | VPS / banco local |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública Supabase | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave admin Supabase | Supabase Dashboard |
| `GOOGLE_MAPS_API_KEY` | Chave API Google Maps Distance Matrix | Google Cloud Console |
| `UAZAPI_URL` | Endpoint envio de texto WhatsApp | UAZAPI Dashboard |
| `UAZAPI_MENU_URL` | Endpoint envio de menu WhatsApp | UAZAPI Dashboard |
| `UAZAPI_SEND_DOCUMENT_URL` | Endpoint envio de documento WhatsApp | UAZAPI Dashboard |
| `UAZAPI_TOKEN` | Token de autenticação UAZAPI | UAZAPI Dashboard |
| `ADMIN_API_TOKEN` | Token interno para APIs administrativas | Gerado manualmente |
| `QZ_PRIVATE_KEY_PEM` | Chave privada RSA para QZ Tray | Gerado manualmente |
| `QZ_CERT_PEM` | Certificado TLS para QZ Tray | Gerado manualmente |
| `N8N_BASE_URL` | URL da instância N8N | VPS local |

### Instalação (desenvolvimento)

```bash
# Clonar o repositório
git clone https://github.com/SSolucao/lanchonetev2.git
cd lanchonetev2

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.production .env.local
# Editar .env.local com os valores corretos

# Rodar em desenvolvimento
npm run dev
```

### Build e deploy manual (produção)

```bash
cd /opt/apps/lanchonetev2
git pull origin main
cp .env.production .env.local
docker build -t lanchonetev2-web:latest .
docker service update --image lanchonetev2-web:latest lanchonetev2-web
```

---

## 🚀 CI/CD Automático

Qualquer push na branch `main` dispara automaticamente o pipeline de deploy via **GitHub Actions**.

**Fluxo:**
```
Push na branch main
  → GitHub Actions (.github/workflows/deploy.yml)
  → Conecta na VPS via SSH
  → git pull origin main
  → docker build -t lanchonetev2-web:latest .
  → docker service update --image lanchonetev2-web:latest lanchonetev2-web
  → Aguarda 15s → Healthcheck HTTP 200
      → OK: deploy concluído
      → Falhou: docker service rollback lanchonetev2-web
```

**Secrets necessários no GitHub:**

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP da VPS (ex: `75.119.154.81`) |
| `VPS_USER` | Usuário SSH (ex: `root`) |
| `VPS_SSH_KEY` | Chave privada ED25519 gerada para o pipeline |

**Tempo médio de deploy:** ~5 minutos

---

## 🗄️ Banco de Dados

PostgreSQL 14 rodando em container Docker na VPS.

**Banco:** `lanchonete` | **Usuário:** `postgres` | **Host interno:** `postgres:5432`

**Tabelas principais:**

| Tabela | Descrição |
|---|---|
| `restaurants` | Dados do estabelecimento |
| `users` | Usuários do sistema |
| `customers` | Base de clientes com endereço |
| `products` | Catálogo de produtos e combos |
| `orders` / `order_items` | Pedidos e itens |
| `comandas` | Comandas abertas |
| `payment_methods` | Formas de pagamento |
| `stock_items` / `stock_transactions` | Estoque e movimentações |
| `ai_menu_documents` | Documentos de cardápio para IA |
| `delivery_rules` | Regras de entrega por distância |

**Scripts de migração:** pasta `scripts/` — executar em ordem numérica (`001_`, `002_`, ..., `010_`).

**Funções críticas:**
- `get_next_comanda_numero()` — numeração sequencial de comandas
- `update_updated_at_column()` — trigger de atualização automática de `updated_at`
- `update_comanda_total()` — recalcula total da comanda ao modificar pedidos

---

## 📦 Storage (MinIO)

| Bucket | Visibilidade | Conteúdo | URL Base |
|---|---|---|---|
| `product-images` | **Público** | Imagens de produtos (`products/uuid.jpeg`) | `https://s3.carrantos.supersolucao.com.br/product-images/` |
| `ai-menu-documents` | **Privado** | Documentos de menu para IA | Acesso via signed URL (Supabase SDK) |

---

## 🔒 Segurança

- Nunca versione `.env.production` ou qualquer arquivo com credenciais reais
- O `SUPABASE_SERVICE_ROLE_KEY` é uma chave admin — nunca exponha no frontend
- O `ADMIN_API_TOKEN` protege rotas administrativas internas — gere um valor forte e único
- As chaves QZ (`QZ_PRIVATE_KEY_PEM` e `QZ_CERT_PEM`) devem ser geradas por estabelecimento
- A chave SSH do CI/CD (`VPS_SSH_KEY`) é dedicada ao pipeline — não usar a chave pessoal do desenvolvedor
- O bucket `ai-menu-documents` é privado — acesso somente via signed URL gerada pelo backend

---

## 🌐 Ambiente de Produção

| Item | Valor |
|---|---|
| URL de produção | https://systemfood.lanchonete.supersolucao.com.br |
| VPS | 75.119.154.81 |
| Repositório na VPS | `/opt/apps/lanchonetev2` |
| Arquivo de envs | `/opt/apps/lanchonetev2/.env.production` |
| Portainer | https://portainer.carrantos.supersolucao.com.br |
| MinIO Console | https://minio.carrantos.supersolucao.com.br |
| GitHub Actions | https://github.com/SSolucao/lanchonetev2/actions |

---

## 🔄 Rollback

Para reverter para a versão anterior do container imediatamente:

```bash
docker service rollback lanchonetev2-web
```

Verificar se voltou corretamente:

```bash
curl -s -o /dev/null -w "%{http_code}" -L https://systemfood.lanchonete.supersolucao.com.br
# Esperado: 200
```
