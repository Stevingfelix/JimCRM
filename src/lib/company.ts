import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type CompanyInfo = {
  id: string;
  company_name: string;
  tagline: string | null;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  tax_id: string | null;
  logo_path: string | null;
  logo_url: string | null;
  pdf_footer_text: string | null;
  brand_color: string | null;
};

const FALLBACK: CompanyInfo = {
  id: "fallback",
  company_name: "My Company",
  tagline: null,
  contact_email: null,
  phone: null,
  website: null,
  address: null,
  tax_id: null,
  logo_path: null,
  logo_url: null,
  pdf_footer_text: null,
  brand_color: null,
};

async function fetchCompanyInfo(): Promise<CompanyInfo> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("company_info")
      .select(
        "id, company_name, tagline, contact_email, phone, website, address, tax_id, logo_path, pdf_footer_text, brand_color",
      )
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return FALLBACK;

    let logo_url: string | null = null;
    if (data.logo_path) {
      const { data: pub } = supabase.storage
        .from("branding")
        .getPublicUrl(data.logo_path);
      logo_url = pub.publicUrl ?? null;
    }

    return {
      id: data.id,
      company_name: data.company_name,
      tagline: data.tagline,
      contact_email: data.contact_email,
      phone: data.phone,
      website: data.website,
      address: data.address,
      tax_id: data.tax_id,
      logo_path: data.logo_path,
      logo_url,
      pdf_footer_text: data.pdf_footer_text,
      brand_color: data.brand_color,
    };
  } catch {
    return FALLBACK;
  }
}

// Cached because every page in the shell + every PDF renders this.
// 60s TTL is short enough that an admin saving the form sees it on the
// next reload without needing manual invalidation.
export const getCompanyInfo = unstable_cache(fetchCompanyInfo, ["company-info"], {
  revalidate: 60,
  tags: ["company-info"],
});
