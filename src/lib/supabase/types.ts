// Temporary loose typing — replace with output of:
//   supabase gen types typescript --linked > src/lib/supabase/types.ts
// Once that runs against Jim's real Supabase project, TypeScript will enforce
// row shapes against migrations automatically. Until then, queries return any.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Database = any;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type QuoteStatus = "draft" | "sent" | "won" | "lost" | "expired";
export type ParseStatus = "pending" | "parsed" | "failed" | "skipped";
export type AliasSourceType =
  | "customer"
  | "manufacturer"
  | "vendor"
  | "other";
