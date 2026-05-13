"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
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

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NotificationBell({ initial }: Props) {
  const router = useRouter();
  const [unread, setUnread] = useState(initial.unread_count);
  const [recent, setRecent] = useState<NotificationEvent[]>(initial.recent);
  const [open, setOpen] = useState(false);
  const [, startMark] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSeenAtRef = useRef<string | null>(initial.last_seen_at);

  // Realtime: on any change to email_events, refetch the bell payload
  // (any client component can call a server action, including for reads).
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

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Optimistic: clear locally; server action persists.
      setUnread(0);
      startMark(async () => {
        const result = await markAllNotificationsSeen();
        if (!result.ok) {
          toast.error(result.error.message);
          // restore — keep the count visible
          setUnread(unread);
          return;
        }
        router.refresh();
      });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Notifications"
        className="size-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted relative"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 size-4 rounded-full bg-brand-gradient text-primary-foreground text-[10px] font-semibold grid place-items-center shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] rounded-xl border bg-card shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="text-sm font-semibold">Notifications</div>
            <Link
              href="/review"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              View all →
            </Link>
          </div>
          <ul className="divide-y max-h-[420px] overflow-auto">
            {recent.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nothing here yet. New emails from Gmail will show up
                automatically.
              </li>
            ) : (
              recent.map((e) => (
                <li key={e.id}>
                  <Link
                    href={
                      e.needs_review ? `/review/${e.id}` : "/review"
                    }
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div
                      className={cn(
                        "size-2 rounded-full mt-1.5 shrink-0",
                        lastSeenAtRef.current &&
                          e.received_at &&
                          Date.parse(e.received_at) >
                            Date.parse(lastSeenAtRef.current)
                          ? "bg-brand-gradient"
                          : "bg-transparent",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {e.subject ?? "(no subject)"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {e.sender_name || e.sender_email || "Unknown sender"}
                        {e.source_type && (
                          <>
                            {" · "}
                            <span className="capitalize">
                              {e.source_type.replace(/_/g, " ")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {timeAgo(e.received_at)}
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
