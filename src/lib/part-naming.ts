import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type PartFamily = {
  id: string;
  code: string;
  name: string;
  requires_thread: boolean;
  requires_length: boolean;
  notes: string | null;
};

export type PartSize = {
  id: string;
  system: "imperial" | "metric";
  code: string;
  label: string;
  diameter_inches: number | null;
};

export type PartThread = {
  id: string;
  code: string;
  label: string;
};

export type PartAttribute = {
  id: string;
  code: string;
  label: string;
  kind: "grade" | "finish" | "material" | "combo";
};

export type PartNamingReference = {
  families: PartFamily[];
  sizes: PartSize[];
  threads: PartThread[];
  attributes: PartAttribute[];
};

async function fetchReference(): Promise<PartNamingReference> {
  const supabase = createAdminClient();
  const [familiesRes, sizesRes, threadsRes, attributesRes] = await Promise.all([
    supabase
      .from("part_naming_families")
      .select("id, code, name, requires_thread, requires_length, notes")
      .order("display_order", { ascending: true }),
    supabase
      .from("part_naming_sizes")
      .select("id, system, code, label, diameter_inches")
      .order("display_order", { ascending: true }),
    supabase
      .from("part_naming_threads")
      .select("id, code, label")
      .order("display_order", { ascending: true }),
    supabase
      .from("part_naming_attributes")
      .select("id, code, label, kind")
      .order("display_order", { ascending: true }),
  ]);

  return {
    families: (familiesRes.data ?? []).map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      requires_thread: r.requires_thread,
      requires_length: r.requires_length,
      notes: r.notes,
    })),
    sizes: (sizesRes.data ?? []).map((r) => ({
      id: r.id,
      system: r.system as "imperial" | "metric",
      code: r.code,
      label: r.label,
      diameter_inches:
        r.diameter_inches != null ? Number(r.diameter_inches) : null,
    })),
    threads: (threadsRes.data ?? []).map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
    })),
    attributes: (attributesRes.data ?? []).map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      kind: r.kind as PartAttribute["kind"],
    })),
  };
}

// Cached: the reference data rarely changes and every extractor + UI
// surface reads it. 5-minute TTL keeps cost negligible while still picking
// up edits from /settings/part-rules within a normal session.
export const getPartNamingReference = unstable_cache(
  fetchReference,
  ["part-naming-reference"],
  { revalidate: 300, tags: ["part-naming"] },
);

// Compact, model-readable rendering used as cached system-prompt context.
// Keep the structure stable — every edit to the wording invalidates the
// Anthropic prompt cache.
export function renderReferenceForPrompt(ref: PartNamingReference): string {
  const families = ref.families
    .map(
      (f) =>
        `  ${f.code} = ${f.name}` +
        (f.requires_thread ? " [thread required]" : "") +
        (f.requires_length ? " [length required]" : ""),
    )
    .join("\n");

  const imperial = ref.sizes
    .filter((s) => s.system === "imperial")
    .map((s) => `  ${s.code} = ${s.label}`)
    .join("\n");
  const metric = ref.sizes
    .filter((s) => s.system === "metric")
    .map((s) => `  ${s.code} = ${s.label}`)
    .join("\n");

  const threads = ref.threads
    .map((t) => `  ${t.code} = ${t.label}`)
    .join("\n");

  const attrs = ref.attributes
    .map((a) => `  ${a.code} = ${a.label} (${a.kind})`)
    .join("\n");

  return [
    "CAP HARDWARE PART NUMBER SCHEMA",
    "Format: PREFIX + size/thread code + '-' + length(4 digits) + attribute code",
    "Example: HCS 04C-0750G8Y = 1/4\"-20 x 3/4\" Grade 8 Yellow Zinc Hex Cap Screw",
    "",
    "FAMILY PREFIXES:",
    families || "  (none configured)",
    "",
    "IMPERIAL SIZE CODES:",
    imperial || "  (none configured)",
    "",
    "METRIC SIZE CODES:",
    metric || "  (none configured)",
    "",
    "THREAD CODES:",
    threads || "  (none configured)",
    "",
    "ATTRIBUTE / GRADE / FINISH CODES:",
    attrs || "  (none configured)",
    "",
    "LENGTH FORMAT:",
    "  4-digit thousandths-of-inch with leading zeros. e.g. 0750 = 3/4\", 1000 = 1\", 2000 = 2\".",
    "",
    "RULES WHEN COMPOSING A CAP PART NUMBER:",
    "  - Identify the product family FIRST.",
    "  - Use ONLY the codes listed above. If the size/thread/attribute isn't in the list, leave the corresponding field null and add the missing piece to missing_fields.",
    "  - Never invent codes or values. Never guess.",
    "  - 'Specials' / aerospace / non-standard parts may not fit this schema — return suggested_pn=null with a reasoning note.",
  ].join("\n");
}
