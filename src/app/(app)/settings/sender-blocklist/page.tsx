import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listBlockedSenders } from "@/lib/sender-blocklist";
import { UnblockButton } from "./components/unblock-button";

export const dynamic = "force-dynamic";

export default async function SenderBlocklistPage() {
  const rows = await listBlockedSenders();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 max-w-5xl">
      <div className="flex items-center text-sm text-muted-foreground gap-1">
        <Link
          href="/settings"
          className="hover:underline inline-flex items-center gap-1"
        >
          <ChevronLeft className="size-3.5" />
          Settings
        </Link>
        <span>›</span>
        <span className="text-foreground font-medium">Sender blocklist</span>
      </div>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Sender blocklist
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Senders here are skipped before any LLM extraction runs. They&apos;re
          added automatically when you reject their email in the review queue.
          If a real customer or vendor lands here by mistake, unblock them and
          the next email from them will be processed normally.
        </p>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sender email</TableHead>
              <TableHead className="w-[120px] text-right">Rejects</TableHead>
              <TableHead className="w-[140px]">Last rejected</TableHead>
              <TableHead className="w-[140px]">First rejected</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No senders blocklisted yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.sender_email}>
                  <TableCell className="font-medium text-sm">
                    {row.sender_email}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.rejected_count}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(row.last_rejected_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(row.first_rejected_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <UnblockButton email={row.sender_email} />
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
