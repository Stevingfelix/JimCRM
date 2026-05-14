import Link from "next/link";
import { getPartNamingReference } from "@/lib/part-naming";
import { PartRulesEditor } from "./components/part-rules-editor";

export const dynamic = "force-dynamic";

export default async function PartRulesPage() {
  const ref = await getPartNamingReference();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          The part-number schema CAP uses (families, sizes, threads,
          attributes). Edits here flow into the AI extractor automatically
          on the next inbound email or paste. New codes are picked up
          within ~5 minutes.
        </p>
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground shrink-0"
        >
          ← back
        </Link>
      </div>

      <PartRulesEditor
        families={ref.families}
        sizes={ref.sizes}
        threads={ref.threads}
        attributes={ref.attributes}
      />
    </div>
  );
}
