# POS System - Project Structure

This document describes the folder structure and organization of the POS system backend.

## Overview

This is a Next.js application with TypeScript, using Supabase as the database. The project is organized to separate concerns between domain models, services, and infrastructure.

## Folder Structure

\`\`\`
├── app/                          # Next.js app directory
│   ├── layout.tsx               # Root layout
│   ├── globals.css              # Global styles
│   └── page.tsx                 # Home page (to be created)
│
├── lib/                          # Infrastructure and utilities
│   └── supabase/                # Supabase client configuration
│       ├── client.ts            # Browser client for client-side operations
│       └── server.ts            # Server client for server-side operations
│
├── src/                          # Application source code
│   ├── domain/                  # Domain models and types
│   │   └── types.ts             # TypeScript interfaces for all entities
│   │
│   └── services/                # Service layer (business logic)
│       ├── restaurantsService.ts
│       ├── usersService.ts
│       ├── customersService.ts
│       ├── productsService.ts
│       ├── paymentMethodsService.ts
│       ├── deliveryRulesService.ts
│       ├── ordersService.ts
│       ├── activityLogService.ts
│       └── n8nClient.ts         # n8n integration placeholders
│
├── scripts/                      # Database scripts
│   └── 001_initial_schema.sql   # Initial database schema
│
└── components/                   # React components (to be created in future steps)
    └── ui/                      # shadcn/ui components
\`\`\`

## Key Files

### Database Schema
- `scripts/001_initial_schema.sql` - Complete database schema with all tables, indexes, and triggers

### Domain Models
- `src/domain/types.ts` - TypeScript types matching the database schema exactly

### Infrastructure
- `lib/supabase/client.ts` - Supabase browser client (for client-side operations)
- `lib/supabase/server.ts` - Supabase server client (for server-side operations)

### Services
All services follow the same pattern:
- List, get, create, update, delete operations
- Typed with domain models
- Direct Supabase queries (no ORM)
- Async functions with error handling

### n8n Integration
- `src/services/n8nClient.ts` - Placeholder functions for future automations:
  - Calculate delivery fee based on distance
  - Update stock when orders are confirmed
  - Notify on order status changes
  - Send low stock alerts

## Database Schema

The database includes 10 main tables:
1. `restaurants` - Restaurant information
2. `users` - System users with roles (OWNER, ATTENDANT, KITCHEN, VIEW_ONLY)
3. `customers` - Customer information with address details
4. `products` - Products (UNIT or COMBO) with stock tracking
5. `product_combo_items` - Items that compose a combo
6. `payment_methods` - Payment methods with settlement days
7. `delivery_rules` - Distance-based delivery fee rules
8. `orders` - Orders with channel (BALCAO/DELIVERY) and status tracking
9. `order_items` - Items in each order
10. `activity_log` - Audit trail for all operations

All tables include:
- UUID primary keys
- `restaurant_id` for multi-tenancy support
- Timestamps (`created_at`, `updated_at`)
- Proper foreign key constraints

## Next Steps

In future stages, we will add:
1. UI components for PDV (point of sale)
2. Kitchen Kanban board
3. Customer and product management screens
4. Reporting dashboards
5. Authentication middleware
6. n8n workflow implementations

## Environment Variables

Required environment variables (already configured in Supabase integration):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `N8N_BASE_URL` - n8n webhook base URL (for future use)
