"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { rejectReviewBulk } from "../actions";
import type { ReviewListRow } from "../queries";

export function ReviewList({ rows }: { rows: ReviewListRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    );
  };

  const onConfirmBulkReject = () => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await rejectReviewBulk(ids);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        `Rejected ${result.data.count} item${result.data.count === 1 ? "" : "s"}`,
      );
      setSelected(new Set());
      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} item{rows.length === 1 ? "" : "s"} need review
          {selected.size > 0 && (
            <span className="ml-2 text-foreground font-medium">
              · {selected.size} selected
            </span>
          )}
        </p>
        {selected.size > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
          >
            Reject {selected.size} selected
          </Button>
        )}
      </div>

      {/* Mobile: card list. Hidden ≥md. */}
      <ul className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <li className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing to review right now.
          </li>
        ) : (
          rows.map((row) => {
            const isChecked = selected.has(row.id);
            return (
              <li
                key={row.id}
                className="rounded-xl border bg-card overflow-hidden flex items-stretch"
              >
                <label
                  className="flex items-center px-3 cursor-pointer select-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={isChecked}
                    onChange={() => toggle(row.id)}
                  />
                </label>
                <Link
                  href={`/review/${row.id}`}
                  className="flex-1 block px-4 py-3 active:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium truncate flex-1">
                      {row.sender_name || row.sender_email || "—"}
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {formatDate(row.received_at)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {row.subject ?? "(no subject)"}
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                    {row.source_type && (
                      <Badge variant="outline">
                        {row.source_type.replace(/_/g, " ")}
                      </Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {row.parse_status}
                    </Badge>
                    <span className="text-muted-foreground tabular-nums">
                      {row.line_count} line{row.line_count === 1 ? "" : "s"}
                    </span>
                    {row.matched_customer_name && (
                      <span className="text-muted-foreground truncate">
                        → {row.matched_customer_name}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>

      {/* Desktop: table. Hidden < md. */}
      <div className="hidden md:block rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="h-4 w-4 rounded border-input accent-primary align-middle"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  disabled={rows.length === 0}
                />
              </TableHead>
              <TableHead className="w-[120px]">Received</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-[140px]">Customer match</TableHead>
              <TableHead className="w-[160px]">Source</TableHead>
              <TableHead className="w-[70px] text-right">Lines</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  Nothing to review right now.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isChecked = selected.has(row.id);
                return (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/40"
                    data-state={isChecked ? "selected" : undefined}
                  >
                    <TableCell className="w-[40px]">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${row.sender_email ?? row.id}`}
                        className="h-4 w-4 rounded border-input accent-primary align-middle"
                        checked={isChecked}
                        onChange={() => toggle(row.id)}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(row.received_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="truncate max-w-[220px]">
                        <Link
                          href={`/review/${row.id}`}
                          className="hover:underline"
                        >
                          {row.sender_name || row.sender_email || "—"}
                        </Link>
                      </div>
                      {row.sender_name && row.sender_email && (
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {row.sender_email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[360px]">
                      <Link
                        href={`/review/${row.id}`}
                        className="hover:underline"
                      >
                        {row.subject ?? "(no subject)"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.matched_customer_name ? (
                        row.matched_customer_name
                      ) : (
                        <span className="text-muted-foreground">none</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.source_type ? (
                        <Badge variant="outline" className="text-xs">
                          {row.source_type.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.line_count}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {row.parse_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!pending) setConfirmOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {selected.size} item{selected.size === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              They&apos;ll be removed from the review queue without creating any
              quote or vendor-quote records. This can&apos;t be undone — if you
              change your mind, the emails will need to be re-imported from
              Gmail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmBulkReject}
              disabled={pending}
              className="rounded-full"
            >
              {pending ? "Rejecting…" : "Reject selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
