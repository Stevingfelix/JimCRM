import Link from "next/link";
import { notFound } from "next/navigation";
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
