import { createClient } from "@/lib/supabase/server";
import { QuoteBuilder } from "./components/quote-builder";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: { customer?: string };
}) {
  const supabase = createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(500);

  // Preview the next quote number so Jim sees what it'll become on save.
  // quote_number is assigned at insert time by a trigger; we just compute the
  // current max + 1 for display.
  const { data: latest } = await supabase
    .from("quotes")
    .select("quote_number")
    .order("quote_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previewQuoteNumber = (latest?.quote_number ?? 0) + 1;

  const presetCustomerId =
    searchParams.customer && /^[0-9a-f-]{36}$/.test(searchParams.customer)
      ? searchParams.customer
      : null;

  return (
    <QuoteBuilder
      initialCustomers={customers ?? []}
      previewQuoteNumber={previewQuoteNumber}
      presetCustomerId={presetCustomerId}
    />
  );
}
