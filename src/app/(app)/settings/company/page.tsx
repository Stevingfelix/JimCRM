import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyInfoForm } from "./components/company-info-form";

export const dynamic = "force-dynamic";

export default async function CompanyInfoPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("company_info")
    .select(
      "id, company_name, tagline, contact_email, phone, website, address, tax_id, logo_path, pdf_footer_text, brand_color",
    )
    .eq("is_active", true)
    .maybeSingle();

  if (!data) {
    return (
      <div className="px-8 py-8 max-w-3xl">
        <p className="text-sm text-muted-foreground">
          Company info has not been seeded. Run migration 0017.
        </p>
      </div>
    );
  }

  let logo_url: string | null = null;
  if (data.logo_path) {
    const { data: pub } = supabase.storage
      .from("branding")
      .getPublicUrl(data.logo_path);
    logo_url = pub.publicUrl ?? null;
  }

  return (
    <div className="px-8 py-8 space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          This information appears on quote PDFs, in the sidebar, and on the
          customer-facing portal.
        </p>
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground shrink-0"
        >
          ← back
        </Link>
      </div>

      <CompanyInfoForm
        initial={{
          id: data.id,
          company_name: data.company_name,
          tagline: data.tagline ?? "",
          contact_email: data.contact_email ?? "",
          phone: data.phone ?? "",
          website: data.website ?? "",
          address: data.address ?? "",
          tax_id: data.tax_id ?? "",
          pdf_footer_text: data.pdf_footer_text ?? "",
          brand_color: data.brand_color ?? "",
          logo_url,
        }}
      />
    </div>
  );
}
