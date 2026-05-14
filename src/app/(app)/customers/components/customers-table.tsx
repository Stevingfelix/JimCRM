"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { CustomerListRow } from "../queries";
import { softDeleteCustomer } from "../actions";
import { EditCustomerDialog } from "./edit-customer-dialog";

type Props = {
  rows: CustomerListRow[];
  total: number;
  page: number;
  pageSize: number;
  hasFilter: boolean;
};

function initials(name: string | null, fallback: string): string {
  const source = (name ?? fallback ?? "").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

export function CustomersTable({
  rows,
  total,
  page,
  pageSize,
  hasFilter,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<CustomerListRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    if (allOnPage) {
      const next = new Set(selected);
      rows.forEach((r) => next.delete(r.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      rows.forEach((r) => next.add(r.id));
      setSelected(next);
    }
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="border-t overflow-x-auto min-h-[420px]">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[10px] font-semibold tracking-wider uppercase text-muted-foreground border-b">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allOnPage}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                  className="rounded border-input"
                />
              </th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Company</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3 text-right">Total quoted</th>
              <th className="px-3 py-3 text-right">Total won</th>
              <th className="w-12 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-10">
                  {hasFilter
                    ? "No customers match the current filter."
                    : "No customers yet — add one to get started."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.name}`}
                      className="rounded border-input"
                    />
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <Link
                      href={`/customers/${row.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="size-8 rounded-full bg-muted text-muted-foreground grid place-items-center text-xs font-semibold shrink-0">
                        {initials(row.primary_contact_name, row.name)}
                      </div>
                      <span className="font-medium group-hover:underline truncate">
                        {row.primary_contact_name ?? row.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 align-middle text-muted-foreground truncate max-w-[220px]">
                    {row.name}
                  </td>
                  <td className="px-3 py-3 align-middle text-muted-foreground truncate max-w-[260px]">
                    {row.primary_email ?? "—"}
                  </td>
                  <td className="px-3 py-3 align-middle text-right tabular-nums">
                    {formatMoney(row.total_quoted)}
                  </td>
                  <td className="px-3 py-3 align-middle text-right tabular-nums">
                    {formatMoney(row.total_won)}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <RowMenu
                      row={row}
                      onEdit={() => setEditingId(row.id)}
                      onDelete={() => setConfirming(row)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: counts + pagination */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t bg-muted/10">
        <span className="text-xs text-muted-foreground">
          {total === 0 ? (
            "0 results"
          ) : (
            <>
              Showing <strong className="text-foreground">{firstShown}</strong>{" "}
              to <strong className="text-foreground">{lastShown}</strong> of{" "}
              <strong className="text-foreground">{total.toLocaleString()}</strong>{" "}
              results
            </>
          )}
        </span>
        <Pagination page={page} totalPages={totalPages} />
      </div>

      <DeleteCustomerDialog
        row={confirming}
        onClose={() => setConfirming(null)}
      />

      <EditCustomerDialog
        customerId={editingId}
        onClose={() => setEditingId(null)}
      />
    </>
  );
}

function RowMenu({
  row,
  onEdit,
  onDelete,
}: {
  row: CustomerListRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${row.name}`}
        className="size-8 rounded-md grid place-items-center text-muted-foreground border bg-background hover:bg-muted hover:text-foreground transition-colors data-[popup-open]:bg-muted"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4 mr-2" />
          Edit customer
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4 mr-2" />
          Delete customer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteCustomerDialog({
  row,
  onClose,
}: {
  row: CustomerListRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!row) return;
    startTransition(async () => {
      const res = await softDeleteCustomer(row.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Deleted ${row.name}`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={!!row}
      onOpenChange={(o) => {
        if (!o && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this customer?</DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{row?.name}</strong> will be
            hidden from the list. Their quotes stay in the system. You can
            restore them from the database if needed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-full"
          >
            {pending ? "Deleting…" : "Delete customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  if (totalPages <= 1) return null;

  function goTo(target: number) {
    const params = new URLSearchParams(window.location.search);
    if (target > 1) params.set("page", String(target));
    else params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/customers?${qs}` : "/customers");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => goTo(Math.max(1, page - 1))}
        disabled={page === 1}
        className={cn(
          "inline-flex h-8 items-center rounded-full border px-3 text-xs",
          page === 1
            ? "text-muted-foreground border-border opacity-50"
            : "hover:bg-muted",
        )}
      >
        Previous
      </button>
      <button
        type="button"
        onClick={() => goTo(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className={cn(
          "inline-flex h-8 items-center rounded-full border px-3 text-xs",
          page >= totalPages
            ? "text-muted-foreground border-border opacity-50"
            : "hover:bg-muted",
        )}
      >
        Next
      </button>
    </div>
  );
}
