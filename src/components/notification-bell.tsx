"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Info, FileSearch, AlertTriangle, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { markAllNotificationsSeen } from "@/app/(app)/notifications/actions";
import type {
  NotificationEvent,
  NotificationsPayload,
} from "@/app/(app)/notifications/queries";

type Props = {
  initial: NotificationsPayload;
};

function formatDateChip(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso)
    .toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();
}

function titleFor(e: NotificationEvent): string {
  const who = e.sender_name || e.sender_email?.split("@")[0] || "Someone";

  if (e.source_type === "customer_quote_request") {
    if (e.part_numbers.length > 0) {
      const shown = e.part_numbers.slice(0, 2).join(", ");
      const extra = e.line_count - 2;
      return extra > 0
        ? `RFQ: ${shown} + ${extra} more`
        : `RFQ: ${shown}`;
    }
    return `Quote request from ${who}`;
  }
  if (e.source_type === "vendor_quote_reply") {
    return `Vendor pricing from ${who}`;
  }
  if (e.part_numbers.length > 0) {
    const shown = e.part_numbers.slice(0, 2).join(", ");
    const extra = e.line_count - 2;
    return extra > 0 ? `${shown} + ${extra} more` : shown;
  }
  return e.subject ?? `Email from ${who}`;
}

function bodyFor(e: NotificationEvent): string {
  const who = e.sender_name || e.sender_email || "Unknown sender";

  if (e.source_type === "customer_quote_request") {
    return `${who} wants pricing on ${e.line_count} part${e.line_count === 1 ? "" : "s"}`;
  }
  if (e.source_type === "vendor_quote_reply") {
    return `${e.line_count} line${e.line_count === 1 ? "" : "s"} with pricing`;
  }
  if (e.needs_review) {
    return `From ${who} — ${e.line_count} part${e.line_count === 1 ? "" : "s"} to review`;
  }
  return e.subject ?? `From ${who}`;
}

function IconFor({ e }: { e: NotificationEvent }) {
  let Icon = Info;
  if (e.needs_review) Icon = AlertTriangle;
  else if (e.source_type === "customer_quote_request") Icon = FileSearch;
  else if (e.source_type === "vendor_quote_reply") Icon = Mail;
  return (
    <div className="size-9 rounded-full bg-brand-gradient-soft text-primary grid place-items-center shrink-0">
      <Icon className="size-4" />
    </div>
  );
}

export function NotificationBell({ initial }: Props) {
  const router = useRouter();
  const [unread, setUnread] = useState(initial.unread_count);
  const [recent, setRecent] = useState<NotificationEvent[]>(initial.recent);
  const [open, setOpen] = useState(false);
  const [, startMark] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSeenAtRef = useRef<string | null>(initial.last_seen_at);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/recent", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as NotificationsPayload;
      setUnread(data.unread_count);
      setRecent(data.recent);
      lastSeenAtRef.current = data.last_seen_at;
    } catch {
      /* network blip — next event will retry */
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notif-bell")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_events" },
        () => {
          refetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handleMarkAll() {
    if (unread === 0) return;
    const before = unread;
    setUnread(0);
    startMark(async () => {
      const result = await markAllNotificationsSeen();
      if (!result.ok) {
        toast.error(result.error.message);
        setUnread(before);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="size-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted relative"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold grid place-items-center shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            // Anchor to right on desktop; on mobile, shift left so it stays
            // on-screen for narrow viewports.
            "absolute z-50 mt-2 rounded-2xl border bg-card shadow-xl overflow-hidden",
            "right-0 w-[360px] sm:w-[380px]",
            "max-w-[calc(100vw-1.5rem)]",
          )}
        >
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight">
              Notifications
            </h3>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unread === 0}
              className={cn(
                "text-sm font-medium transition-colors",
                unread > 0
                  ? "text-primary hover:underline"
                  : "text-muted-foreground/70 cursor-default",
              )}
            >
              Mark all as read
            </button>
          </div>
          <ul className="max-h-[420px] overflow-auto px-3 pb-3 space-y-2">
            {recent.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nothing here yet. New emails from Gmail show up automatically.
              </li>
            ) : (
              recent.map((e) => {
                const isUnread =
                  !!e.received_at &&
                  (!lastSeenAtRef.current ||
                    Date.parse(e.received_at) >
                      Date.parse(lastSeenAtRef.current));
                return (
                  <li key={e.id}>
                    <Link
                      href={e.needs_review ? `/review/${e.id}` : "/review"}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl p-3 bg-background hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <IconFor e={e} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold leading-snug">
                            {titleFor(e)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {bodyFor(e)}
                          </div>
                          <div className="text-[10px] tracking-wider text-muted-foreground mt-1.5 font-medium">
                            {formatDateChip(e.received_at)}
                          </div>
                        </div>
                        {isUnread && (
                          <span
                            aria-hidden
                            className="size-2 rounded-full bg-primary shrink-0 mt-2"
                          />
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
