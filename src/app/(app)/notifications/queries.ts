import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type NotificationEvent = {
  id: string;
  subject: string | null;
  sender_email: string | null;
  sender_name: string | null;
  source_type: string | null;
  needs_review: boolean;
  parse_status: "pending" | "parsed" | "failed" | "skipped";
  received_at: string | null;
  line_count: number;
};

export type NotificationsPayload = {
  unread_count: number;
  recent: NotificationEvent[];
  last_seen_at: string | null;
};

export async function getNotifications(
  limit = 10,
): Promise<NotificationsPayload> {
  const supabase = createClient();
  const user = await getCurrentUser();

  // Read last_notifications_seen_at from the user's session metadata.
  const { data: userData } = await supabase.auth.getUser();
  const lastSeen =
    (userData.user?.user_metadata?.last_notifications_seen_at as string | undefined) ??
    null;

  // Only show emails that actually need attention — skip marketing,
  // transactional, and other noise that Haiku already filtered out.
  const recentRes = await supabase
    .from("email_events")
    .select("id, parse_status, needs_review, received_at, parsed_payload")
    .or("needs_review.eq.true,parse_status.eq.parsed,parse_status.eq.failed")
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  type Row = {
    id: string;
    parse_status: NotificationEvent["parse_status"];
    needs_review: boolean;
    received_at: string | null;
    parsed_payload: {
      sender?: { email?: string | null; name?: string | null };
      subject?: string | null;
      extraction?: { source_type?: string; lines?: unknown[] };
    } | null;
  };

  const recent: NotificationEvent[] = ((recentRes.data ?? []) as Row[]).map(
    (r) => ({
      id: r.id,
      subject: r.parsed_payload?.subject ?? null,
      sender_email: r.parsed_payload?.sender?.email ?? null,
      sender_name: r.parsed_payload?.sender?.name ?? null,
      source_type: r.parsed_payload?.extraction?.source_type ?? null,
      needs_review: r.needs_review,
      parse_status: r.parse_status,
      received_at: r.received_at,
      line_count: r.parsed_payload?.extraction?.lines?.length ?? 0,
    }),
  );

  // Unread = events needing review that arrived after last_seen.
  let unreadCount = 0;
  const reviewable = recent.filter((e) => e.needs_review);
  if (lastSeen) {
    const cutoff = Date.parse(lastSeen);
    unreadCount = reviewable.filter(
      (e) => e.received_at && Date.parse(e.received_at) > cutoff,
    ).length;
  } else if (user) {
    unreadCount = reviewable.length;
  }

  return {
    unread_count: unreadCount,
    recent,
    last_seen_at: lastSeen,
  };
}
