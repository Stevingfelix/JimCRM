import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Sheet, Download, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/format";
import { getReviewDetail } from "../queries";
import { ReviewEditor } from "./components/review-editor";

export default async function ReviewDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getReviewDetail(params.id);
  if (!detail) notFound();

  return (
    <div className="px-6 py-6 space-y-6 max-w-5xl">
      <div className="flex items-center text-sm text-muted-foreground gap-1">
        <Link href="/review" className="hover:underline">
          Review
        </Link>
        <span>›</span>
        <span className="text-foreground font-medium truncate max-w-[400px]">
          {detail.subject ?? "(no subject)"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">From</div>
          <div>
            {detail.sender_name && (
              <span className="font-medium">{detail.sender_name} </span>
            )}
            {detail.sender_email && (
              <span className="text-muted-foreground">
                &lt;{detail.sender_email}&gt;
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Received</div>
          <div className="tabular-nums">{formatDate(detail.received_at)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Status</div>
          <div className="flex gap-2">
            <Badge variant="outline" className="capitalize">
              {detail.parse_status}
            </Badge>
            {detail.extraction?.source_type && (
              <Badge variant="outline">
                {detail.extraction.source_type.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">
            Customer (matched by sender email)
          </div>
          <div>
            {detail.matched_customer ? (
              <Link
                href={`/customers/${detail.matched_customer.customer_id}`}
                className="hover:underline"
              >
                {detail.matched_customer.customer_name}
              </Link>
            ) : (
              <span className="text-muted-foreground">none — pick below</span>
            )}
          </div>
        </div>
      </div>

      {detail.error && (
        <div className="text-sm rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950 dark:border-rose-900 px-3 py-2">
          Extraction failed: {detail.error}
        </div>
      )}

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Extracted lines</h2>
        <ReviewEditor
          eventId={detail.id}
          defaultMode={
            detail.extraction?.source_type === "vendor_quote_reply"
              ? "vendor"
              : "customer"
          }
          initialLines={detail.enriched}
          initialCustomer={detail.matched_customer}
          vendorHint={detail.extraction?.customer_or_vendor_hint ?? null}
        />
      </section>

      {detail.attachments_meta.length > 0 && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight">
              Attachments ({detail.attachments_meta.length})
            </h2>
            <div className="grid gap-2">
              {detail.attachments_meta.map((att) => {
                const result = detail.attachments.find(
                  (a) => a.filename === att.filename,
                );
                const sizeKb = att.size
                  ? `${(att.size / 1024).toFixed(0)} KB`
                  : null;
                const downloadUrl = `/api/attachments?event_id=${detail.id}&filename=${encodeURIComponent(att.filename)}`;

                return (
                  <div
                    key={att.filename}
                    className="flex items-center gap-3 rounded-lg border border-foreground/[0.06] bg-muted/30 px-4 py-3"
                  >
                    <div className="shrink-0 text-muted-foreground">
                      {att.kind === "pdf" ? (
                        <FileText className="size-5" />
                      ) : (
                        <Sheet className="size-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {att.filename}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="uppercase">
                          {att.kind ?? att.mime_type ?? "file"}
                        </span>
                        {sizeKb && <span>{sizeKb}</span>}
                        {result?.extraction && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            {result.extraction.lines?.length ?? 0} lines
                            extracted
                          </Badge>
                        )}
                        {result?.error && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 border-rose-300 text-rose-600"
                          >
                            extraction failed
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {att.kind === "pdf" && (
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs hover:bg-muted transition-colors"
                        >
                          <Eye className="size-3.5" />
                          Preview
                        </a>
                      )}
                      <a
                        href={downloadUrl}
                        download={att.filename}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs hover:bg-muted transition-colors"
                      >
                        <Download className="size-3.5" />
                        Download
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Original email body
        </h2>
        <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-auto max-h-80 whitespace-pre-wrap font-sans">
          {detail.body_text ?? "(empty)"}
        </pre>
      </section>
    </div>
  );
}
