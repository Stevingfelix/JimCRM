import { getPartNamingReference } from "@/lib/part-naming";
import { PartRulesEditor } from "@/app/(app)/settings/part-rules/components/part-rules-editor";
import { PartsTabs } from "../components/parts-tabs";

export const dynamic = "force-dynamic";

export default async function PartsRulesPage() {
  const ref = await getPartNamingReference();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 max-w-7xl">
      <PartsTabs />

      <p className="text-sm text-muted-foreground max-w-2xl">
        The part-number schema CAP uses (families, sizes, threads,
        attributes). Edits here flow into the AI extractor automatically
        on the next inbound email or paste.
      </p>

      <PartRulesEditor
        families={ref.families}
        sizes={ref.sizes}
        threads={ref.threads}
        attributes={ref.attributes}
      />
    </div>
  );
}
