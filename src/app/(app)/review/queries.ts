import { createClient } from "@/lib/supabase/server";
import type { EnrichedLine } from "@/lib/extractors/enrich";
import type { ExtractionResult } from "@/lib/extractors/_pattern";

export type ReviewListRow = {
  id: string;
  gmail_msg_id: string;
  subject: string | null;
  sender_email: string | null;
  sender_name: string | null;
  received_at: string | null;
  source_type: string | null;
  line_count: number;
  parse_status: "pending" | "parsed" | "failed" | "skipped";
  matched_customer_name: string | null;
};

export async function listReviewQueue(): Promise<ReviewListRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("email_events")
    .select("id, gmail_msg_id, parse_status, parsed_payload, received_at")
    .eq("needs_review", true)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    gmail_msg_id: string;
    parse_status: ReviewListRow["parse_status"];
    received_at: string | null;
    parsed_payload: {
      sender?: { email?: string | null; name?: string | null };
      subject?: string | null;
      extraction?: { source_type?: string; lines?: unknown[] };
      matched_customer?: { customer_name?: string } | null;
    } | null;
  };

  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    gmail_msg_id: r.gmail_msg_id,
    subject: r.parsed_payload?.subject ?? null,
    sender_email: r.parsed_payload?.sender?.email ?? null,
    sender_name: r.parsed_payload?.sender?.name ?? null,
    received_at: r.received_at,
    source_type: r.parsed_payload?.extraction?.source_type ?? null,
    line_count: r.parsed_payload?.extraction?.lines?.length ?? 0,
    parse_status: r.parse_status,
    matched_customer_name:
      r.parsed_payload?.matched_customer?.customer_name ?? null,
  }));
}

export type ReviewDetail = {
  id: string;
  gmail_msg_id: string;
  parse_status: "pending" | "parsed" | "failed" | "skipped";
  received_at: string | null;
  subject: string | null;
  sender_email: string | null;
  sender_name: string | null;
  body_text: string | null;
  extraction: ExtractionResult | null;
  enriched: EnrichedLine[];
  matched_customer:
    | { customer_id: string; customer_name: string }
    | null;
  error: string | null;
};

export async function getReviewDetail(id: string): Promise<ReviewDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("email_events")
    .select("id, gmail_msg_id, parse_status, received_at, parsed_payload")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  type Payload = {
    sender?: { email?: string | null; name?: string | null };
    subject?: string | null;
    body_text?: string | null;
    body_preview?: string | null;
    extraction?: ExtractionResult;
    enriched?: EnrichedLine[];
    matched_customer?: {
      customer_id: string;
      customer_name: string;
    } | null;
    error?: string;
  };
  const p = (data.parsed_payload as Payload | null) ?? {};

  return {
    id: data.id,
    gmail_msg_id: data.gmail_msg_id,
    parse_status: data.parse_status,
    received_at: data.received_at,
    subject: p.subject ?? null,
    sender_email: p.sender?.email ?? null,
    sender_name: p.sender?.name ?? null,
    body_text: p.body_text ?? p.body_preview ?? null,
    extraction: p.extraction ?? null,
    enriched: p.enriched ?? [],
    matched_customer: p.matched_customer ?? null,
    error: p.error ?? null,
  };
}

export async function countNeedsReview(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("email_events")
    .select("id", { count: "exact", head: true })
    .eq("needs_review", true);
  return count ?? 0;
}
