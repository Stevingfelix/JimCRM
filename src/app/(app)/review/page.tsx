import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { getActiveCredentialsPublic } from "@/lib/gmail/credentials";
import { listReviewQueue } from "./queries";
import { GmailStatus } from "./components/gmail-status";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: { gmail?: string; gmail_error?: string };
}) {
  const [status, rows] = await Promise.all([
    getActiveCredentialsPublic(),
    listReviewQueue(),
  ]);

  return (
    <div className="px-8 py-8 space-y-6 max-w-7xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} item{rows.length === 1 ? "" : "s"} need review
        </p>
      </div>

      {searchParams.gmail === "connected" && (
        <div className="text-sm rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-900 px-3 py-2">
          Gmail connected — the cron will pull new emails on the next tick.
        </div>
      )}
      {searchParams.gmail_error && (
        <div className="text-sm rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950 dark:border-rose-900 px-3 py-2">
          OAuth error: {searchParams.gmail_error}
        </div>
      )}

      <GmailStatus status={status} />

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
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
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  Nothing to review right now.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
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
                    <Badge
                      variant="outline"
                      className="text-xs capitalize"
                    >
                      {row.parse_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
