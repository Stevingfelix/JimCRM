import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExportProfilesEditor } from "./components/export-profiles-editor";

export const dynamic = "force-dynamic";

const AVAILABLE_KEYS = [
  { key: "quote_number", label: "Quote number (e.g. Q-0042)" },
  { key: "customer_name", label: "Customer name" },
  { key: "customer_id", label: "Customer UUID" },
  { key: "status", label: "Status (draft/sent/won/lost/expired)" },
  { key: "quote_created_at", label: "Quote created at (ISO timestamp)" },
  { key: "quote_sent_at", label: "Quote sent at (ISO timestamp)" },
  { key: "validity_date", label: "Validity date (YYYY-MM-DD)" },
  { key: "line_position", label: "Line position (1, 2, …)" },
  { key: "internal_pn", label: "Internal part number" },
  { key: "description", label: "Part description" },
  { key: "qty", label: "Quantity" },
  { key: "unit_price", label: "Unit price" },
  { key: "line_total", label: "Line total (qty × price)" },
];

export default async function ExportProfilesPage() {
  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("csv_export_profiles")
    .select("id, name, is_default, column_map, columns_order")
    .order("created_at", { ascending: true });

  return (
    <div className="px-8 py-8 space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Configure the column names and order to match Jim&apos;s ERP&apos;s import
          format. The default profile is used when{" "}
          <code>/api/export/csv</code> is called without a <code>?profile=</code>{" "}
          parameter.
        </p>
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground shrink-0"
        >
          ← back
        </Link>
      </div>

      <ExportProfilesEditor
        initialProfiles={
          (profiles ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            is_default: p.is_default,
            column_map: (p.column_map as Record<string, string>) ?? {},
            columns_order: p.columns_order ?? [],
          }))
        }
        availableKeys={AVAILABLE_KEYS}
      />
    </div>
  );
}
