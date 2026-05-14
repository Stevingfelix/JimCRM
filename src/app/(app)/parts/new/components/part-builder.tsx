"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  FileEdit,
  Pencil,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { PartNamingReference } from "@/lib/part-naming";
import { createPart } from "../../actions";

type Props = { reference: PartNamingReference };

// Convert a length input (decimal "0.75" or fraction "3/4" or mixed "1 1/2")
// into CAP's 4-digit thousandths-of-inch code.
function lengthToCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Mixed fraction "1 1/2" or simple fraction "3/4"
  const fracMatch = trimmed.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const whole = fracMatch[1] ? parseInt(fracMatch[1], 10) : 0;
    const num = parseInt(fracMatch[2], 10);
    const den = parseInt(fracMatch[3], 10);
    if (den === 0) return null;
    const inches = whole + num / den;
    return Math.round(inches * 1000).toString().padStart(4, "0");
  }

  const n = Number(trimmed);
  if (Number.isFinite(n) && n > 0) {
    return Math.round(n * 1000).toString().padStart(4, "0");
  }
  return null;
}

function composePn(parts: {
  family: string | null;
  size: string | null;
  thread: string | null;
  length: string | null;
  attribute: string | null;
}): string | null {
  if (!parts.family || !parts.size) return null;
  const sizeBlock = `${parts.size}${parts.thread ?? ""}`;
  const lengthBlock = parts.length ? `-${parts.length}` : "";
  const attrBlock = parts.attribute ?? "";
  return `${parts.family} ${sizeBlock}${lengthBlock}${attrBlock}`;
}

export function PartBuilder({ reference }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"schema" | "custom">("schema");

  // Schema-mode picks
  const [familyCode, setFamilyCode] = useState<string>("");
  const [sizeId, setSizeId] = useState<string>("");
  const [threadCode, setThreadCode] = useState<string>("");
  const [lengthInput, setLengthInput] = useState("");
  const [attributeCode, setAttributeCode] = useState<string>("");

  // Custom-mode PN
  const [customPn, setCustomPn] = useState("");

  // Shared
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [targetMargin, setTargetMargin] = useState("30");
  const [pending, startTransition] = useTransition();

  const family = useMemo(
    () => reference.families.find((f) => f.code === familyCode) ?? null,
    [familyCode, reference.families],
  );
  const sizeRow = useMemo(
    () => reference.sizes.find((s) => s.id === sizeId) ?? null,
    [sizeId, reference.sizes],
  );

  const lengthCode = lengthToCode(lengthInput);
  const composedPn = composePn({
    family: family?.code ?? null,
    size: sizeRow?.code ?? null,
    thread: family?.requires_thread ? threadCode || null : null,
    length: family?.requires_length ? lengthCode : null,
    attribute: attributeCode || null,
  });

  const previewPn = mode === "schema" ? composedPn : customPn.trim();
  const previewIsReady = !!previewPn && previewPn.length > 0;

  function handleSave(thenOpen: boolean) {
    if (!previewIsReady) {
      toast.error("Compose a valid part number first");
      return;
    }
    if (mode === "schema") {
      if (family?.requires_thread && !threadCode) {
        toast.error("Pick a thread for this family");
        return;
      }
      if (family?.requires_length && !lengthCode) {
        toast.error("Enter a length");
        return;
      }
    }
    startTransition(async () => {
      const res = await createPart({
        internal_pn: previewPn!,
        description: description.trim() || null,
        internal_notes: internalNotes.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Part created");
      if (thenOpen) {
        router.push(`/parts/${res.data.id}`);
      } else {
        router.push("/parts");
      }
    });
  }

  const imperialSizes = reference.sizes.filter((s) => s.system === "imperial");
  const metricSizes = reference.sizes.filter((s) => s.system === "metric");

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/parts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4 mr-1" />
          Back to parts
        </Link>
      </div>

      <div className="space-y-6">
        {/* PART DETAILS */}
        <section className="rounded-2xl border border-foreground/[0.06] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 sm:p-7 space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold tracking-tight">
              Part Details
            </h2>
            <div className="inline-flex rounded-full border border-foreground/10 p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setMode("schema")}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 rounded-full px-3.5 text-xs font-medium transition-colors",
                  mode === "schema"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sparkles className="size-3.5" />
                Build from CAP schema
              </button>
              <button
                type="button"
                onClick={() => setMode("custom")}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 rounded-full px-3.5 text-xs font-medium transition-colors",
                  mode === "custom"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Wand2 className="size-3.5" />
                Custom PN
              </button>
            </div>
          </div>

          {mode === "schema" ? (
            <div className="space-y-5">
              {/* Family + Size row */}
              <div className="grid md:grid-cols-2 gap-5">
                <Field label="Family *">
                  <Select value={familyCode} onValueChange={(v) => setFamilyCode(v ?? "")}>
                    <SelectTrigger className="h-11">
                      {family ? (
                        <span className="flex items-center gap-2 truncate">
                          <span className="font-mono text-xs text-muted-foreground">
                            {family.code}
                          </span>
                          <span className="text-foreground truncate">
                            {family.name}
                          </span>
                        </span>
                      ) : (
                        <SelectValue placeholder="Pick a product family" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {reference.families.map((f) => (
                        <SelectItem key={f.id} value={f.code}>
                          <span className="font-mono text-xs mr-2">
                            {f.code}
                          </span>
                          <span>{f.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Size *">
                  <Select value={sizeId} onValueChange={(v) => setSizeId(v ?? "")}>
                    <SelectTrigger className="h-11">
                      {sizeRow ? (
                        <span className="flex items-center gap-2 truncate">
                          <span className="font-mono text-xs text-muted-foreground">
                            {sizeRow.code}
                          </span>
                          <span className="text-foreground">{sizeRow.label}</span>
                          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">
                            {sizeRow.system}
                          </span>
                        </span>
                      ) : (
                        <SelectValue placeholder="Pick a size" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {imperialSizes.length > 0 && (
                        <SizeGroup label="Imperial" items={imperialSizes} />
                      )}
                      {metricSizes.length > 0 && (
                        <SizeGroup label="Metric" items={metricSizes} />
                      )}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Thread + Length row — conditional on family */}
              <div className="grid md:grid-cols-2 gap-5">
                <Field
                  label={
                    family?.requires_thread
                      ? "Thread *"
                      : "Thread (not required for this family)"
                  }
                >
                  <Select
                    value={threadCode}
                    onValueChange={(v) => setThreadCode(v ?? "")}
                    disabled={!family?.requires_thread}
                  >
                    <SelectTrigger className="h-11">
                      {threadCode ? (
                        (() => {
                          const t = reference.threads.find(
                            (x) => x.code === threadCode,
                          );
                          return t ? (
                            <span className="flex items-center gap-2 truncate">
                              <span className="font-mono text-xs text-muted-foreground">
                                {t.code}
                              </span>
                              <span className="text-foreground">{t.label}</span>
                            </span>
                          ) : (
                            <SelectValue placeholder="—" />
                          );
                        })()
                      ) : (
                        <SelectValue placeholder="—" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {reference.threads.map((t) => (
                        <SelectItem key={t.id} value={t.code}>
                          <span className="font-mono text-xs mr-2">
                            {t.code}
                          </span>
                          <span>{t.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label={
                    family?.requires_length
                      ? "Length (inches) *"
                      : "Length (not required for this family)"
                  }
                  hint={
                    family?.requires_length && lengthInput
                      ? `→ ${lengthCode ?? "(invalid)"}`
                      : 'e.g. "0.75" or "3/4"'
                  }
                >
                  <Input
                    value={lengthInput}
                    onChange={(e) => setLengthInput(e.target.value)}
                    disabled={!family?.requires_length}
                    placeholder="0.75"
                    className="h-11 tabular-nums"
                  />
                </Field>
              </div>

              {/* Attribute */}
              <Field label="Attribute (grade / finish / material — optional)">
                <Select
                  value={attributeCode}
                  onValueChange={(v) => setAttributeCode(v === "__none__" ? "" : (v ?? ""))}
                >
                  <SelectTrigger className="h-11">
                    {attributeCode ? (
                      (() => {
                        const a = reference.attributes.find(
                          (x) => x.code === attributeCode,
                        );
                        return a ? (
                          <span className="flex items-center gap-2 truncate">
                            <span className="font-mono text-xs text-muted-foreground">
                              {a.code}
                            </span>
                            <span className="text-foreground truncate">
                              {a.label}
                            </span>
                            <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">
                              {a.kind}
                            </span>
                          </span>
                        ) : (
                          <SelectValue placeholder="—" />
                        );
                      })()
                    ) : (
                      <SelectValue placeholder="—" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">No attribute</span>
                    </SelectItem>
                    {reference.attributes.map((a) => (
                      <SelectItem key={a.id} value={a.code}>
                        <span className="font-mono text-xs mr-2">{a.code}</span>
                        <span>{a.label}</span>
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {a.kind}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : (
            <Field label="Internal PN *" hint="Type the PN exactly as you want it stored.">
              <Input
                value={customPn}
                onChange={(e) => setCustomPn(e.target.value)}
                placeholder="e.g. CUSTOM-SPEC-001"
                className="h-11 font-mono"
                autoFocus
              />
            </Field>
          )}

          {/* PN preview */}
          <div className="rounded-xl border border-foreground/[0.06] bg-brand-gradient-soft p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Part number preview
              </div>
              <div className="text-xl font-semibold font-mono mt-1 truncate text-foreground">
                {previewIsReady ? previewPn : "—"}
              </div>
            </div>
            {mode === "schema" && family && (
              <div className="text-xs text-muted-foreground text-right shrink-0 hidden sm:block">
                <div>{family.name}</div>
                {sizeRow && <div>{sizeRow.label}</div>}
              </div>
            )}
          </div>
        </section>

        {/* DESCRIPTION + NOTES */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-foreground/[0.06] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 space-y-3">
            <h3 className="text-sm font-semibold">Description</h3>
            <p className="text-[11px] text-muted-foreground -mt-2">
              Customer-facing — printed on quote PDFs.
            </p>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='e.g. "Hex Cap Screw, 1/4-20 x 3/4, Grade 8 Yellow Zinc"'
            />
          </section>

          <section className="rounded-2xl border border-foreground/[0.06] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 space-y-3">
            <h3 className="text-sm font-semibold">Internal notes</h3>
            <p className="text-[11px] text-muted-foreground -mt-2">
              Never shown to customers.
            </p>
            <Textarea
              rows={4}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Reminders for the team…"
            />
          </section>
        </div>

        {/* MARGIN */}
        <section className="rounded-2xl border border-foreground/[0.06] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6">
          <Field
            label="Target margin %"
            hint="Floor used by the AI price suggester. 30 is the default; raise it for higher-margin niches."
          >
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={95}
                step={1}
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
                className="h-11 w-32 tabular-nums"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </Field>
        </section>

        {/* FOOTER ACTIONS */}
        <div className="border-t border-foreground/[0.06] pt-5 pb-8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2">
          <Link
            href="/parts"
            className="inline-flex items-center justify-center h-10 rounded-full border border-foreground/10 bg-background px-5 text-sm hover:bg-muted transition-colors"
          >
            Discard
          </Link>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={pending || !previewIsReady}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-full bg-brand-gradient-soft text-primary px-5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Pencil className="size-4" />
            {pending ? "Saving…" : "Save & back to list"}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={pending || !previewIsReady}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-full bg-brand-gradient text-primary-foreground px-6 text-sm font-medium shadow-sm hover:brightness-105 transition-all disabled:opacity-50"
          >
            <FileEdit className="size-4" />
            {pending ? "Saving…" : "Save & open"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {hint && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function SizeGroup({
  label,
  items,
}: {
  label: string;
  items: PartNamingReference["sizes"];
}) {
  return (
    <>
      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </div>
      {items.map((s) => (
        <SelectItem key={s.id} value={s.id}>
          <span className="font-mono text-xs mr-2">{s.code}</span>
          <span>{s.label}</span>
        </SelectItem>
      ))}
    </>
  );
}
