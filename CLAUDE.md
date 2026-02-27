# Project Context for Claude Code

## Architecture
- **Next.js App Router** with TypeScript, Tailwind CSS v4, deployed on **Vercel**
- **Vercel Postgres** (PostgreSQL) for database, **Vercel Blob** for image storage
- **Shopify Admin REST API** integration — metafields in `jadepuma` and `custom` namespaces
- **NextAuth** with CredentialsProvider for authentication (bcrypt hashed passwords in env vars)
- **PM App** at `https://avp-product-management-6ded0b52f729.herokuapp.com/` — read-only API, source of truth for sellers & sources

## Key Architecture Decisions
- PM App is source of truth for sellers & sources (platforms); this Research App is a superset
- Artists table has NO unique constraint on name (intentional — uses alias matching)
- `dealers` is a VIEW pointing to `sellers` table (backward compatibility)
- `getAllDealers` default limit is 100 — always pass explicit limit for domain map building
- Domain map includes ALL dealers (active+inactive) to recognize excluded sites
- Visual verification threshold default: 30 (filters clearly different posters)
- Client/server code separation: `push-constants.ts` (shared) vs `push-helpers.ts` (server-only with `sql`)

## Database Tables (Key)
- `posters` — main table, links to Shopify via `shopify_product_id`
- `artists`, `printers`, `publishers`, `publications` — linked entities
- `sellers` — acquisition sources (has backward-compat `dealers` VIEW)
- `platforms` — where you buy (marketplaces, venues)
- `push_queue` — per-field pending Shopify changes, persists across sessions
- `push_history` — audit trail + undo for every push
- `user_settings` — per-user auto-push preferences (JSONB)
- `publications` (formerly `books`) — backward-compat `books` VIEW exists

## Shopify Metafield Keys (jadepuma namespace)
Research: concise_description, book_title_source, publisher, printer, color, artist_bio, country_of_origin, medium
Custom: artist, date, technique, history, talking_points

## Shopify Push System
- Inline push controls per field (PushFieldIndicator component)
- PushQueueContext provides queue state, push/undo actions, sync status
- PushQueueBar sticky bottom bar shows queued changes
- Tags are **additive** — local selections merge with existing Shopify tags, never remove
- Color metafield uses `list.single_line_text_field` type (JSON array format)
- Auto-push: safe fields default ON, judgment fields (title, description, artist, date) default OFF
- ShopifyPanel is read-only (no push controls)

## Development Workflow
- All changes are pushed to `main` branch and auto-deployed to Vercel
- No local dev server needed — review changes on live site after push
- Database migrations run via `/settings/migrate` page in the app
- TypeScript check before committing: `npx tsc --noEmit`

## File Conventions
- API routes: `app/api/` (Next.js App Router)
- Components: `components/` (React, `'use client'` where needed)
- Database queries: `lib/` (use `sql` from `@vercel/postgres`)
- Shared constants: `lib/push-constants.ts` (safe for client import)
- Server-only helpers: `lib/push-helpers.ts`, `lib/shopify.ts` (NOT safe for client import)

## Naming
- `book_id` renamed to `publication_id` on posters table
- Shopify metafield keys stay unchanged (`jadepuma.book_title_source`) even after local rename
- Managed lists key: `publications` (not `books`)

## Content & Copywriting Rules
**No em dashes (—) in any generated text.** This applies to all customer-facing content: product descriptions, concise descriptions, talking points, Time & Place text, and any other text pushed to Shopify or displayed as marketing copy. This is a strict rule with no exceptions.

Replace em dashes with:
- A comma, colon, or semicolon for mid-sentence asides
- Parentheses for parenthetical information
- Two sentences when a pause or shift in thought is needed
- An en dash (–) sparingly, only for ranges (e.g. date ranges, size ranges)
