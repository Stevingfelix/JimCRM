# CAP Hardware Quoting System

Internal quoting tool for CAP Hardware Supply. Replaces a manual email-and-spreadsheet workflow with a database-backed quote builder, AI-assisted email/attachment parsing, and ERP-ready CSV export.

Full project brief: `./specs/MVP_BRIEF.md` — always re-read it before working on a new feature area.

## Stack (locked, don't deviate)

- **Frontend \+ backend:** Next.js 14 (App Router) \+ TypeScript. One repo, one deploy.  
- **DB / auth / storage:** Supabase (Postgres). Use the Supabase MCP for migrations and queries.  
- **UI:** Tailwind CSS \+ shadcn/ui. No other component libraries.  
- **PDF:** `@react-pdf/renderer`. Templates are React components in `src/pdf/templates/`.  
- **LLM:** Anthropic Claude API. Sonnet for extraction, Haiku for cheap classification. Structured JSON outputs only (use `tool_use` for schema enforcement).  
- **Email ingest:** Gmail API, polled every 90s via Vercel Cron.  
- **Attachment parsing:** `pdf-parse` for PDF → text, `xlsx` (SheetJS) for Excel → JSON. LLM extracts from both.  
- **Drive:** Google Picker (client-side), `drive.file` scope only.  
- **Hosting:** Vercel \+ Supabase cloud.

Anything else needs an explicit ADR in `./specs/adrs/`.

## Hard rules

- **No proprietary lock-in.** Everything must be exportable as plain SQL or CSV. No third-party SaaS in the data path.  
- **Keep Google OAuth in Testing mode.** Add Jim's team as test users. Never publish the OAuth consent screen — it triggers a multi-week security review.  
- **Drive scope \= `drive.file` only.** Picking files the user explicitly selects. Anything broader triggers Google verification.  
- **Internal notes never appear on customer PDFs.** Schema separates `internal_notes` from `customer_notes` at quote and line level. Enforce in the renderer.  
- **All data mutations record `updated_by` \+ `updated_at`.** Trigger on every table.  
- **Server-side only for tokens, prompts, and DB writes.** Never expose Anthropic / Google tokens to the client.  
- **Extractors always return confidence \+ reasoning.** Anything below 0.7 confidence routes to the review queue, never silently saved.

## Repo layout

src/

  app/                 \# Next.js App Router pages \+ route handlers

    (auth)/            \# auth routes

    quotes/            \# quote builder, list, detail

    parts/             \# parts \+ aliases CRUD

    customers/

    vendors/

    review/            \# extraction review queue

    api/

      cron/gmail/      \# Gmail polling endpoint (Vercel Cron)

      extract/         \# LLM extraction endpoints

      export/csv/      \# ERP CSV export

  components/          \# shadcn/ui \+ custom components

  lib/

    supabase/          \# client \+ server helpers

    gmail/             \# Gmail API client

    drive/             \# Drive Picker helpers

    extractors/        \# email-body, pdf, excel extractors

    pricing/           \# AI price suggestion

    pdf/               \# PDF generation entry point

  pdf/templates/       \# React-PDF templates (cap-branded, blind, etc.)

supabase/

  migrations/          \# SQL migrations, numbered

  seed.sql             \# seed data for dev

specs/

  MVP\_BRIEF.md         \# full project brief

  adrs/                \# architecture decision records

.claude/

  commands/            \# custom slash commands

  agents/              \# subagents

## Data model

Canonical schema lives in `supabase/migrations/`. Summary:

- `parts (id, internal_pn UNIQUE, description, internal_notes)`  
- `part_aliases (id, part_id, alias_pn, source_type, source_name)` — index on `alias_pn`  
- `customers`, `customer_contacts`  
- `vendors`, `vendor_contacts`  
- `quotes (id, customer_id, status, validity_date, customer_notes, internal_notes, template_id, ...)`  
- `quote_lines (id, quote_id, part_id, qty, unit_price, line_notes_internal, line_notes_customer, ai_suggested_price, ai_reasoning, override_reason)`  
- `vendor_quotes (id, vendor_id, part_id, qty, unit_price, lead_time_days, quoted_at, source_message_id)`  
- `email_events (id, gmail_msg_id UNIQUE, label, parsed_payload jsonb, needs_review, linked_quote_id)`  
- `pdf_templates (id, name, react_component_key, is_default)`  
- `quote_attachments (id, quote_id, drive_file_id, name, mime_type)`

Every table: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, `created_by`, `updated_by`, soft-delete via `deleted_at` on `quotes` and `parts`.

## Coding conventions

- TypeScript strict. No `any` unless commented why.  
- Server components by default. `"use client"` only when needed (interactivity, hooks).  
- Database access via typed Supabase client (generate types with `supabase gen types typescript`).  
- Zod schemas for every LLM extraction output and every API route input.  
- Errors: throw typed errors, catch at route boundary, return `{ error: { code, message } }`.  
- File naming: kebab-case for files, PascalCase for components, camelCase for utilities.  
- One feature \= one folder under `src/app/<feature>/` with its own `page.tsx`, `actions.ts` (server actions), and components.  
- Tests: Vitest for unit (extractors, pricing logic), Playwright for one happy-path E2E per feature.

## LLM extraction pattern

All three extractors (email body, PDF, Excel) follow the same shape — see `src/lib/extractors/_pattern.ts`:

input → text normalization → Claude (Sonnet, tool\_use w/ Zod schema) → 

  { lines: \[{ raw\_text, part\_number\_guess, qty, unit\_price?, confidence, reasoning }\] } →

  alias lookup per line →

  rows w/ confidence \< 0.7 OR no part match → review queue →

  rows accepted by user → commit to quote\_lines OR vendor\_quotes

Pricing suggestion is a separate Claude call with structured output `{ suggested_price, confidence, reasoning }`. Reasoning shown on hover only, never in PDF.

## Build / deploy commands

- `npm run dev` — local dev on :3000  
- `npm run build` — production build  
- `npm run typecheck` — strict TS check  
- `npm run test` — Vitest  
- `npm run e2e` — Playwright  
- `supabase db push` — apply migrations to remote  
- `supabase gen types typescript --linked > src/lib/supabase/types.ts` — regenerate types  
- Deploy is auto on push to `main` via Vercel.

## Working agreements with Claude Code

- **Always read `specs/MVP_BRIEF.md` before starting a new feature area.** Re-ground on Jim's actual requirements.  
- **Use plan mode (Shift+Tab) for anything touching OAuth, the extraction pipeline, or the PDF renderer.** These are the high-risk areas.  
- **Run `npm run typecheck && npm run test` after any non-trivial change.** Fix breaks before reporting done.  
- **For migrations:** write the SQL file in `supabase/migrations/` first, then run via Supabase MCP, then regenerate types.  
- **Never commit secrets.** `.env.local` is gitignored. Required env vars are documented in `.env.example`.  
- **Don't add dependencies without checking.** If a new package is needed, propose it before installing.

## Required env vars (`.env.local`)

NEXT\_PUBLIC\_SUPABASE\_URL=

NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=

SUPABASE\_SERVICE\_ROLE\_KEY=

ANTHROPIC\_API\_KEY=

GOOGLE\_CLIENT\_ID=

GOOGLE\_CLIENT\_SECRET=

GOOGLE\_REDIRECT\_URI=

CRON\_SECRET=  
