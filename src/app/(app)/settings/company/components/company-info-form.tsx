"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveCompanyInfo,
  uploadCompanyLogo,
  removeCompanyLogo,
} from "../actions";

type Initial = {
  id: string;
  company_name: string;
  tagline: string;
  contact_email: string;
  phone: string;
  website: string;
  address: string;
  tax_id: string;
  pdf_footer_text: string;
  brand_color: string;
  logo_url: string | null;
};

const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

function isAllowedMime(s: string): s is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(s);
}

export function CompanyInfoForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logoPending, setLogoPending] = useState(false);
  const [form, setForm] = useState(initial);
  const [logoUrl, setLogoUrl] = useState(initial.logo_url);
  const fileRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof Initial>(key: K, value: Initial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveCompanyInfo({
        id: form.id,
        company_name: form.company_name,
        tagline: form.tagline,
        contact_email: form.contact_email,
        phone: form.phone,
        website: form.website,
        address: form.address,
        tax_id: form.tax_id,
        pdf_footer_text: form.pdf_footer_text,
        brand_color: form.brand_color,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedMime(file.type)) {
      toast.error("Use PNG, JPEG, WebP, or SVG");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setLogoPending(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const res = await uploadCompanyLogo({
        id: form.id,
        data_url: dataUrl,
        mime_type: file.type,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Logo updated");
      // Cache-bust so the new image shows immediately.
      setLogoUrl(
        dataUrl /* preview from the source bytes — no server round-trip wait */,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLogoPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleLogoRemove() {
    setLogoPending(true);
    startTransition(async () => {
      const res = await removeCompanyLogo(form.id);
      setLogoPending(false);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setLogoUrl(null);
      toast.success("Logo removed");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* LOGO */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Logo</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Appears on quote PDFs and in the sidebar. PNG, JPEG, WebP, or SVG —
            up to 2MB.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="size-20 rounded-lg border bg-muted/30 grid place-items-center overflow-hidden shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="size-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logoPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4 mr-2" />
              {logoUrl ? "Replace" : "Upload"}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={logoPending}
                onClick={handleLogoRemove}
              >
                <Trash2 className="size-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* IDENTITY */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Identity</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Company name *"
            value={form.company_name}
            onChange={(v) => update("company_name", v)}
            placeholder="CAP Hardware Supply"
          />
          <Field
            label="Tagline"
            value={form.tagline}
            onChange={(v) => update("tagline", v)}
            placeholder="Industrial fasteners & hardware"
          />
          <Field
            label="Brand color (hex)"
            value={form.brand_color}
            onChange={(v) => update("brand_color", v)}
            placeholder="#10b981"
            adornment={
              form.brand_color ? (
                <span
                  className="inline-block size-5 rounded border"
                  style={{ backgroundColor: form.brand_color }}
                />
              ) : null
            }
          />
          <Field
            label="Tax / EIN"
            value={form.tax_id}
            onChange={(v) => update("tax_id", v)}
            placeholder="12-3456789"
          />
        </div>
      </section>

      {/* CONTACT */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Contact</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Contact email"
            value={form.contact_email}
            onChange={(v) => update("contact_email", v)}
            placeholder="info@caphardware.com"
            type="email"
          />
          <Field
            label="Phone"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            placeholder="(555) 123-4567"
          />
          <Field
            label="Website"
            value={form.website}
            onChange={(v) => update("website", v)}
            placeholder="https://caphardware.com"
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Address
            </Label>
            <Textarea
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder={"123 Industrial Way\nSuite 200\nCity, ST 00000"}
              rows={4}
            />
          </div>
        </div>
      </section>

      {/* PDF */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">PDF footer</h2>
        <Field
          label="Footer text"
          value={form.pdf_footer_text}
          onChange={(v) => update("pdf_footer_text", v)}
          placeholder="Net 30 · Prices subject to availability"
          hint="Appears centered at the bottom of every quote PDF, below the page numbers."
        />
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={handleSave} disabled={pending} className="rounded-full">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  hint,
  className,
  adornment,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  className?: string;
  adornment?: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          type={type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={adornment ? "pr-10" : undefined}
        />
        {adornment && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {adornment}
          </div>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
