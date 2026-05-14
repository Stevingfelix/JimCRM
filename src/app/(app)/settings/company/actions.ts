"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const CompanySchema = z.object({
  id: z.string().uuid(),
  company_name: z.string().trim().min(1, "Company name is required").max(120),
  tagline: z.string().trim().max(200).optional().or(z.literal("")),
  contact_email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  tax_id: z.string().trim().max(60).optional().or(z.literal("")),
  pdf_footer_text: z.string().trim().max(200).optional().or(z.literal("")),
  brand_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #10b981")
    .optional()
    .or(z.literal("")),
});

function emptyToNull(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t === "" ? null : t;
}

export async function saveCompanyInfo(
  input: z.input<typeof CompanySchema>,
): Promise<ActionResult<void>> {
  const parsed = CompanySchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("company_info")
      .update({
        company_name: parsed.data.company_name,
        tagline: emptyToNull(parsed.data.tagline),
        contact_email: emptyToNull(parsed.data.contact_email),
        phone: emptyToNull(parsed.data.phone),
        website: emptyToNull(parsed.data.website),
        address: emptyToNull(parsed.data.address),
        tax_id: emptyToNull(parsed.data.tax_id),
        pdf_footer_text: emptyToNull(parsed.data.pdf_footer_text),
        brand_color: emptyToNull(parsed.data.brand_color),
        updated_by: userId,
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);

    revalidateTag("company-info");
    revalidatePath("/settings/company");
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

const UploadLogoSchema = z.object({
  id: z.string().uuid(),
  // base64-encoded data URL of the image
  data_url: z
    .string()
    .startsWith("data:image/")
    .max(3_500_000), // ~2MB image -> ~2.7MB base64
  mime_type: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
});

export async function uploadCompanyLogo(
  input: z.input<typeof UploadLogoSchema>,
): Promise<ActionResult<{ logo_path: string }>> {
  const parsed = UploadLogoSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const admin = createAdminClient();

    // Strip prefix and decode.
    const comma = parsed.data.data_url.indexOf(",");
    if (comma < 0) return err("validation", "Malformed image data");
    const b64 = parsed.data.data_url.slice(comma + 1);
    const buffer = Buffer.from(b64, "base64");
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return err("validation", "Logo must be under 2MB");
    }

    const ext =
      parsed.data.mime_type === "image/png"
        ? "png"
        : parsed.data.mime_type === "image/jpeg"
          ? "jpg"
          : parsed.data.mime_type === "image/webp"
            ? "webp"
            : "svg";
    const filename = `logo-${Date.now()}.${ext}`;

    // Get current logo_path so we can clean it up after.
    const { data: existing } = await admin
      .from("company_info")
      .select("logo_path")
      .eq("id", parsed.data.id)
      .maybeSingle();

    const { error: uploadErr } = await admin.storage
      .from("branding")
      .upload(filename, buffer, {
        contentType: parsed.data.mime_type,
        upsert: false,
      });
    if (uploadErr) return err("upload_error", uploadErr.message);

    const userId = await getCurrentUserId();
    const { error: updateErr } = await admin
      .from("company_info")
      .update({ logo_path: filename, updated_by: userId })
      .eq("id", parsed.data.id);
    if (updateErr) return err(updateErr.code ?? "db_error", updateErr.message);

    if (existing?.logo_path && existing.logo_path !== filename) {
      // Best-effort cleanup; storage retains old logos otherwise.
      await admin.storage.from("branding").remove([existing.logo_path]);
    }

    revalidateTag("company-info");
    revalidatePath("/settings/company");
    revalidatePath("/", "layout");
    return ok({ logo_path: filename });
  } catch (e) {
    return fromException(e);
  }
}

export async function removeCompanyLogo(
  id: string,
): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(id).success) {
    return err("validation", "Invalid id");
  }
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("company_info")
      .select("logo_path")
      .eq("id", id)
      .maybeSingle();
    if (existing?.logo_path) {
      await admin.storage.from("branding").remove([existing.logo_path]);
    }
    const userId = await getCurrentUserId();
    await admin
      .from("company_info")
      .update({ logo_path: null, updated_by: userId })
      .eq("id", id);
    revalidateTag("company-info");
    revalidatePath("/settings/company");
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
