# CAP Hardware — Quoting System MVP Brief (7-Day Full-Spec Sprint)

**Client:** Jim, CAP Hardware Supply **Prepared for:** Software / Engineering lead (solo dev, AI-assisted with Codex) **Date:** May 13, 2026 **Target ship:** 7 days from kickoff — full-spec v1 in Jim's hands. **Philosophy:** AI-assisted coding makes the full spec buildable in a week. Risk lives in external systems (Google OAuth, attachment formats), not in code velocity. Plan accordingly.

---

## 1\. What we're building (full spec)

Every feature Jim listed lands in v1. Nothing is deferred. The order of build is chosen so external dependencies (Google OAuth, real customer email samples) are unblocked early.

- Parts DB with internal PN \+ customer/mfg aliases \+ cross-ref search  
- Customer DB \+ Vendor DB (companies \+ contacts)  
- Quote builder: multi-line, internal/customer notes, validity date, inline edit  
- Last-5-quotes popover per part line (qty/price/date/customer)  
- AI price suggestion based on history \+ recent vendor cost, user-overridable  
- Vendor quote logging \+ per-line internal vendor recommendations (not shown to customer)  
- Gmail integration: watch one label/address, auto-create draft quotes  
- AI extraction from email body, PDF attachments, and Excel attachments  
- PDF quote generation with template-switching (ship with CAP-branded; framework supports blind/alt-brand templates)  
- CSV export matching Jim's ERP import schema  
- Google Drive attachment picker (drive.file scope) on quotes and parts  
- Supabase auth, multi-user, single workspace

---

## 2\. Risks that can blow the week (mitigate Day 1\)

These are not code-volume risks — Codex handles code volume fine. These are external-system risks.

### 2.1 Google OAuth verification trap

- Gmail's `gmail.readonly` and Drive's broader scopes are **restricted scopes** that require Google to run a security assessment before going to production. That process takes weeks.  
- **Mitigation:** Keep the Google Cloud project in **Testing** mode and add Jim's team (3–5 users max) as test users. No verification needed under 100 users. Document this so we don't accidentally publish.  
- For Drive, use the narrow **`drive.file` scope only** — files the app creates or that the user explicitly picks. Avoids restricted-scope review entirely.

### 2.2 Attachment parsing accuracy

- Codex can write the PDF/Excel ingest plumbing in an afternoon. Getting the LLM to reliably extract part/qty/price from N different vendor formats is **iteration time, not coding time**.  
- **Mitigation:** Ship with explicit confidence \+ a "review extracted rows" step before they hit the DB. Jim corrects anything wrong. Real-world accuracy improves over the first week of use.  
- Collect 5–10 real vendor PDFs and 3–5 real vendor Excel sheets from Jim on Day 1 as the test set. The extractor is "done" when it parses those correctly.

### 2.3 Gmail watcher reliability

- Polling is fine for v1 (every 1–2 min via cron) and avoids the complexity of Gmail Push Notifications / Pub/Sub.  
- **Mitigation:** Cron-driven poll on the chosen label. Idempotent on `gmail_msg_id`. Skip push notifications until v2.

### 2.4 Day-1 deliverables from Jim

The build can't really start without these. Pin them down before the clock runs.

- One sample ERP import CSV (exact column schema we have to match on export).  
- 1–2 current customer-facing quote PDFs (so we copy the layout).  
- 2–3 real customer quote-request emails (extractor test cases — body-only, attachment-only, mixed).  
- 5–10 real vendor reply emails / PDFs / Excel files (vendor extractor test cases).  
- Google Workspace account he wants the integration to run from (the watched label sits inside it).  
- A handful of seed parts with aliases \+ a few historical quotes (so history popovers aren't empty).

---

## 3\. Stack (locked)

- **DB / auth / storage:** Supabase (Postgres). Portable, no lock-in.  
- **App:** Next.js (App Router) \+ TypeScript. One repo, one deploy.  
- **UI:** Tailwind \+ shadcn/ui. Zero custom design system work.  
- **PDF:** `@react-pdf/renderer` (template-as-React-component is easiest to swap).  
- **LLM:** Claude API (Sonnet for extraction, Haiku for cheap classification). Structured JSON outputs only.  
- **Email ingest:** Gmail API \+ polling cron via Vercel Cron or Supabase Edge Function.  
- **Attachment parsing:**  
  - PDF → text via `pdf-parse`, then LLM extraction  
  - Excel → `xlsx` (SheetJS) → LLM extraction  
- **Drive:** Google Picker API client-side, `drive.file` scope.  
- **Hosting:** Vercel \+ Supabase cloud.

---

## 4\. Data model

parts (id, internal\_pn UNIQUE, description, internal\_notes, created\_at, created\_by)

part\_aliases (id, part\_id, alias\_pn, source\_type, source\_name)  \-- index on alias\_pn

customers (id, name, contacts jsonb, notes)

customer\_contacts (id, customer\_id, name, email, phone, role)

vendors (id, name, categories text\[\], contacts jsonb, notes)

vendor\_contacts (id, vendor\_id, name, email, phone, role)

quotes (id, customer\_id, status, validity\_date, customer\_notes,

        internal\_notes, template\_id, created\_by, created\_at, sent\_at)

quote\_lines (id, quote\_id, part\_id, qty, unit\_price,

             line\_notes\_internal, line\_notes\_customer,

             ai\_suggested\_price, ai\_reasoning, override\_reason)

quote\_attachments (id, quote\_id, drive\_file\_id, name, mime\_type)

vendor\_quotes (id, vendor\_id, part\_id, qty, unit\_price,

               lead\_time\_days, quoted\_at, source\_message\_id, source\_note)

email\_events (id, gmail\_msg\_id UNIQUE, label, received\_at,

              parse\_status, parsed\_payload jsonb, needs\_review bool,

              linked\_quote\_id, linked\_vendor\_quote\_ids uuid\[\])

pdf\_templates (id, name, react\_component\_key, is\_default)

Every table has `updated_at`, `updated_by`. Soft delete via `deleted_at` where it matters (quotes, parts).

---

## 5\. 7-day build plan

**Day 1 — foundation \+ unblocking**

- Supabase project, schema migration, RLS, auth, Next.js scaffold, Vercel deploy.  
- Google Cloud project, OAuth consent screen in Testing mode, Gmail \+ Drive scopes added, test users added.  
- Receive Jim's Day-1 deliverables (§2.4). Lock CSV export schema.

**Day 2 — parts, aliases, customers, vendors**

- Parts CRUD \+ aliases UI \+ typeahead search across internal PN and all aliases.  
- Customer \+ vendor CRUD with contacts.  
- Seed real data Jim sent.

**Day 3 — quote builder \+ history**

- Multi-line quote screen, spreadsheet-style inline editing, keyboard nav.  
- Internal vs. customer notes per quote and per line.  
- Validity date, status (draft/sent/won/lost).  
- Last-5-quotes popover (one query, indexed on part\_id \+ created\_at).

**Day 4 — Gmail watcher \+ email body extraction**

- OAuth flow, token storage.  
- Cron-polled label watcher with idempotent `gmail_msg_id`.  
- LLM extractor for email body → draft quote. Confidence scoring, low-confidence rows flagged for review.  
- "Review extracted rows" UI before commit to DB.

**Day 5 — attachment parsing \+ vendor quotes \+ AI pricing**

- PDF \+ Excel attachment extraction reusing the same review UI.  
- Vendor quote logging (manual \+ auto from parsed vendor emails).  
- AI price suggestion per quote line: prompt \= last 5 customer quotes \+ latest vendor cost \+ qty tier. Returns price \+ reasoning \+ confidence. Overridable.  
- Internal vendor recommendations per line based on vendor\_quotes history for that part/category.

**Day 6 — PDF templates \+ CSV export \+ Drive**

- React-PDF: CAP-branded template as default. Template registry so blind/alt-brand templates are a single-file add.  
- CSV export endpoint matching ERP schema exactly. Filters: by quote, by date range, by "new parts only."  
- Google Picker integration with `drive.file` scope. Attachments link from quote \+ part records.

**Day 7 — Jim dogfoods \+ fix top friction**

- Jim runs 8–10 real quotes through the system live.  
- Engineer fixes top friction items in real-time (keyboard shortcuts, label tweaks, prompt corrections, edge-case parsing).  
- Final deploy. Hand off.

---

## 6\. AI extraction — implementation notes

One pattern, used three times (email body, PDF attachment, Excel attachment):

input: raw text/sheet

↓

LLM call (Sonnet) with structured output schema:

  { source\_type, customer\_or\_vendor\_hint, lines: \[

      { raw\_text, part\_number\_guess, qty, unit\_price?, confidence } \]

  }

↓

For each line:

  \- alias lookup → existing part

  \- no match → mark as "new part, needs creation"

  \- confidence \< 0.7 → "needs review"

↓

Review UI: user accepts / edits / rejects each row

↓

Commit accepted rows to quote\_lines OR vendor\_quotes

Pricing suggestion is its own LLM call with a tight prompt and structured output: `{ suggested_price, confidence, reasoning }`. Reasoning shown on hover only, never in the PDF.

---

## 7\. Non-functional requirements

- Quote screen interactive in \<1s on warm cache.  
- All Google tokens encrypted at rest, refresh handled server-side.  
- Audit fields on every mutation (`updated_by`, `updated_at`).  
- Full Postgres dump exports cleanly (no lock-in).  
- Desktop browsers only. No mobile work in v1.

---

## 8\. Success criteria for Day-7 ship

- Jim creates a real multi-line quote from a real customer email (paste or parsed from label) in **under 3 minutes**.  
- The email/attachment extractor handles his 5–10 real test cases correctly or flags for review — no silent failures.  
- History popover surfaces useful prior pricing on repeat parts.  
- AI price suggestion lands within reasonable range on a known-history part; reasoning is sane.  
- PDF matches the existing CAP layout closely enough to send to customers.  
- CSV export loads into the ERP cleanly with zero re-keying.  
- Drive attachments link from a quote and open from the quote view.

---

## 9\. What "v1.1" looks like (post-week-1)

Not in this brief, but worth keeping in mind so the v1 code doesn't paint into a corner:

- Gmail Push (Pub/Sub) instead of polling.  
- Margin rules and target-markup logic feeding the price suggestion.  
- Analytics: what we quoted, at what margin, hit rate by customer/category.  
- Outbound vendor RFQ automation.  
- Customer portal.  
- Mobile-friendly quote review.

The v1 schema already supports all of these.

---

*Confirm Day-1 deliverables (§2.4) and the OAuth Testing-mode approach (§2.1) and the clock starts.*  
