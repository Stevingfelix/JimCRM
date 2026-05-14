"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import type { QuoteListRow } from "../queries";
import { QuotePeekDrawer } from "./quote-peek-drawer";

type Props = {
  rows: QuoteListRow[];
  emptyMessage: string;
};

// Stops the row-level peek handler from firing when clicking an inline link.
function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

export function QuotesListBody({ rows, emptyMessage }: Props) {
  const [peekId, setPeekId] = useState<string | null>(null);

  return (
    <>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-center text-sm text-muted-foreground py-8"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow
              key={row.id}
              className="hover:bg-muted/40 cursor-pointer"
              onClick={() => setPeekId(row.id)}
            >
              <TableCell className="font-medium tabular-nums">
                <Link
                  href={`/quotes/${row.id}`}
                  className="hover:underline"
                  onClick={stop}
                >
                  {formatQuoteNumber(row.quote_number)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link
                  href={`/customers/${row.customer_id}`}
                  className="hover:underline"
                  onClick={stop}
                >
                  {row.customer_name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground tabular-nums">
                {formatDate(row.created_at)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground tabular-nums">
                {formatDate(row.validity_date)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {row.line_count}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {row.total != null ? formatMoney(row.total) : "—"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      <QuotePeekDrawer
        quoteId={peekId}
        onClose={() => setPeekId(null)}
      />
    </>
  );
}
