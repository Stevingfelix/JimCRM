import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { getCompanyInfo } from "@/lib/company";
import { getQuoteDetail } from "../queries";
import { QuoteHeader } from "./components/quote-header";
import { QuoteSummaryCard } from "./components/quote-summary-card";
import { LinesEditor } from "./components/lines-editor";
import { NotesSection } from "./components/notes-section";
import { AttachmentsSection } from "./components/attachments-section";
import { ActivityLog } from "./components/activity-log";
import { PdfPreview } from "./components/pdf-preview";

export default async function QuoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [detail, company] = await Promise.all([
    getQuoteDetail(params.id),
    getCompanyInfo(),
  ]);
  if (!detail) notFound();

  return (
    <div className="px-6 py-6 space-y-6 max-w-6xl">
      <QuoteHeader
        quote={detail.quote}
        templates={detail.templates}
        lines={detail.lines.map((l) => ({
          part_id: l.part_id,
          part_internal_pn: l.part_internal_pn,
          part_description: l.part_description,
          qty: l.qty,
        }))}
        customerContacts={detail.quote.customer_contacts}
      />

      <QuoteSummaryCard
        quote={detail.quote}
        lines={detail.lines}
        company={company}
      />

      <PdfPreview quoteId={detail.quote.id} />

      <Separator />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Lines</h2>
          <span className="text-xs text-muted-foreground">
            Tab to advance · Enter on qty/price to save · ⓘ hover for history
          </span>
        </div>
        <LinesEditor
          quoteId={detail.quote.id}
          initialLines={detail.lines}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Notes</h2>
        <NotesSection quote={detail.quote} />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Attachments</h2>
        <AttachmentsSection
          quoteId={detail.quote.id}
          attachments={detail.attachments}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
        <ActivityLog quoteId={detail.quote.id} />
      </section>
    </div>
  );
}
