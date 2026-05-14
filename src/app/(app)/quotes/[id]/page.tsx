import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { getQuoteDetail } from "../queries";
import { QuoteHeader } from "./components/quote-header";
import { LinesEditor } from "./components/lines-editor";
import { NotesSection } from "./components/notes-section";
import { AttachmentsSection } from "./components/attachments-section";
import { ActivityLog } from "./components/activity-log";

export default async function QuoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getQuoteDetail(params.id);
  if (!detail) notFound();

  return (
    <div className="px-6 py-6 space-y-6 max-w-6xl">
      <QuoteHeader quote={detail.quote} templates={detail.templates} />

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
