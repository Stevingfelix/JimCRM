"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowRight, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import { getQuotePeek, type QuotePeek } from "../peek-actions";

const STATUS_TONE: Record<
  QuotePeek["status"],
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
  sent: {
    label: "Sent",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  },
  won: {
    label: "Won",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  lost: {
    label: "Lost",
    className:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
  },
  expired: {
    label: "Expired",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

type Props = {
  quoteId: string | null;
  onClose: () => void;
};

export function QuotePeekDrawer({ quoteId, onClose }: Props) {
  const router = useRouter();
  const [data, setData] = useState<QuotePeek | null>(null);
  const [loading, startLoading] = useTransition();

  // Whenever a new quoteId opens the drawer, refetch.
  useEffect(() => {
    if (!quoteId) {
      setData(null);
      return;
    }
    startLoading(async () => {
      const peek = await getQuotePeek(quoteId);
      setData(peek);
    });
  }, [quoteId]);

  return (
    <DialogPrimitive.Root
      open={quoteId !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed right-0 top-0 z-50 h-screen w-full sm:w-[520px] flex flex-col bg-card border-l shadow-2xl outline-none",
            "duration-300 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right",
          )}
        >
          {!quoteId ? null : loading || !data ? (
            <DrawerSkeleton />
          ) : (
            <DrawerBody
              peek={data}
              onClose={onClose}
              onOpenFull={() => {
                router.push(`/quotes/${data.id}`);
              }}
            />
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DrawerSkeleton() {
  return (
    <>
      <DrawerHeader title="Loading…" />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
        <div className="pt-4 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <div className="border-t p-4 flex items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    </>
  );
}

function DrawerHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-4 border-b flex items-start justify-between gap-4">
      <div className="min-w-0">
        <DialogPrimitive.Title
          className="text-lg font-semibold tracking-tight truncate"
          render={<h2 />}
        >
          {title}
        </DialogPrimitive.Title>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>
      <DialogPrimitive.Close
        render={
          <button
            type="button"
            className="size-8 rounded-full bg-muted/70 hover:bg-muted text-muted-foreground grid place-items-center shrink-0"
            aria-label="Close"
          />
        }
      >
        <X className="size-4" />
      </DialogPrimitive.Close>
    </div>
  );
}

function DrawerBody({
  peek,
  onClose,
  onOpenFull,
}: {
  peek: QuotePeek;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  const tone = STATUS_TONE[peek.status];
  const hasMoreLines = peek.line_count > peek.lines.length;

  return (
    <>
      <DrawerHeader
        title={formatQuoteNumber(peek.quote_number)}
        subtitle={
          <Link
            href={`/customers/${peek.customer_id}`}
            className="hover:underline"
            onClick={onClose}
          >
            {peek.customer_name}
          </Link>
        }
      />

      <div className="flex-1 overflow-auto">
        {/* Meta row */}
        <div className="px-6 py-4 border-b flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Badge variant="outline" className={cn("border", tone.className)}>
            {tone.label}
          </Badge>
          <Meta label="Total">
            <span className="font-semibold tabular-nums">
              {peek.total != null ? formatMoney(peek.total) : "—"}
            </span>
          </Meta>
          <Meta label="Lines">
            <span className="tabular-nums">{peek.line_count}</span>
          </Meta>
          <Meta label="Created">
            <span className="tabular-nums">{formatDate(peek.created_at)}</span>
          </Meta>
          {peek.validity_date && (
            <Meta label="Valid through">
              <span className="tabular-nums">
                {formatDate(peek.validity_date)}
              </span>
            </Meta>
          )}
          {peek.sent_at && (
            <Meta label="Sent">
              <span className="tabular-nums">{formatDate(peek.sent_at)}</span>
            </Meta>
          )}
        </div>

        {/* Lines */}
        <div className="px-6 py-4 space-y-3">
          <div className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            Items
          </div>
          {peek.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lines yet.</p>
          ) : (
            <div className="space-y-2">
              {peek.lines.map((line) => {
                const lineTotal =
                  line.unit_price != null ? line.qty * line.unit_price : null;
                return (
                  <div
                    key={line.position}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-background/40"
                  >
                    <div className="text-xs text-muted-foreground tabular-nums w-5 pt-0.5 shrink-0">
                      {line.position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {line.part_internal_pn ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {line.part_short_description ?? ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm tabular-nums">
                        {line.qty} ×{" "}
                        {line.unit_price != null
                          ? formatMoney(line.unit_price)
                          : "—"}
                      </div>
                      <div className="text-xs font-medium tabular-nums">
                        {lineTotal != null ? formatMoney(lineTotal) : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
              {hasMoreLines && (
                <div className="text-xs text-muted-foreground text-center pt-1">
                  + {peek.line_count - peek.lines.length} more line
                  {peek.line_count - peek.lines.length === 1 ? "" : "s"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        {peek.customer_notes && (
          <div className="px-6 py-4 space-y-2 border-t">
            <div className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Customer notes
            </div>
            <p className="text-sm whitespace-pre-wrap">{peek.customer_notes}</p>
          </div>
        )}
      </div>

      <div className="border-t p-4 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose} className="rounded-full">
          Close
        </Button>
        <Button onClick={onOpenFull} className="rounded-full">
          Open quote
          <ArrowRight className="size-4 ml-2" />
        </Button>
      </div>
    </>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-muted-foreground tracking-wide uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
