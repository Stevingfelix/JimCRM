import Link from "next/link";
import { ImportClient } from "./components/import-client";

export default function PartsImportPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Paste or upload a CSV to create parts in bulk. Aliases are imported
          in the same pass.
        </p>
        <Link
          href="/parts"
          className="text-sm text-muted-foreground hover:text-foreground shrink-0"
        >
          ← back to Parts
        </Link>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3 text-sm">
        <div className="font-medium">CSV format</div>
        <p className="text-muted-foreground">
          Required column: <code className="text-foreground">internal_pn</code>
          . Optional: <code>short_description</code>, <code>long_description</code>, <code>internal_notes</code>,{" "}
          <code>aliases</code>.
        </p>
        <p className="text-muted-foreground">
          Aliases are pipe-separated triples of{" "}
          <code>alias_pn/source_type/source_name</code>. Source types:{" "}
          <code>customer</code>, <code>manufacturer</code>, <code>vendor</code>,{" "}
          <code>other</code>.
        </p>
        <pre className="bg-muted/40 rounded-md p-3 text-xs overflow-auto">{`internal_pn,short_description,long_description,internal_notes,aliases
CAP-2210,1/4-20 x 1" SHCS,,Source from Fastenal,91251A537/manufacturer/McMaster|ACME-25-1-SHCS/customer/Acme
CAP-1002,Nylon insert lock nut M6,,,FS-NIL-M6/vendor/Fastenal`}</pre>
      </div>

      <ImportClient />
    </div>
  );
}
