"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { disconnectGmail, pollNow } from "../actions";

type Props = {
  status: {
    connected: boolean;
    email: string | null;
    watched_label: string | null;
    last_polled_at: string | null;
  };
};

export function GmailStatus({ status }: Props) {
  const router = useRouter();
  const [polling, startPoll] = useTransition();
  const [, startDisconnect] = useTransition();

  const onPoll = () => {
    startPoll(async () => {
      const result = await pollNow();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        result.data.processed > 0
          ? `Pulled ${result.data.processed} new email${result.data.processed === 1 ? "" : "s"}`
          : "No new emails",
      );
      router.refresh();
    });
  };

  const onDisconnect = () => {
    if (!confirm("Disconnect Gmail? The cron will stop polling.")) return;
    startDisconnect(async () => {
      const result = await disconnectGmail();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Disconnected");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-3 text-sm">
        {status.connected ? (
          <>
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900"
            >
              Gmail connected
            </Badge>
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">
                {status.email}
              </span>{" "}
              · watching label{" "}
              <code className="text-xs">{status.watched_label}</code>
              {status.last_polled_at && (
                <>
                  {" "}
                  · last poll {formatDate(status.last_polled_at)}{" "}
                  {new Date(status.last_polled_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              )}
            </span>
          </>
        ) : (
          <>
            <Badge variant="outline" className="text-muted-foreground">
              Not connected
            </Badge>
            <span className="text-muted-foreground">
              Connect Gmail to start ingesting quote requests automatically.
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {status.connected ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onPoll}
              disabled={polling}
            >
              {polling ? "Polling…" : "Poll now"}
            </Button>
            <Button size="sm" variant="outline" onClick={onDisconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <a
            href="/api/auth/google/start"
            className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Connect Gmail
          </a>
        )}
      </div>
    </div>
  );
}
