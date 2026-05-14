"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

export type ImportRowPreview = {
  row_number: number;
  internal_pn: string;
  description: string | null;
  internal_notes: string | null;
  aliases: Array<{ alias_pn: string; source_type: string | null; source_name: string | null }>;
  status: "ready" | "duplicate" | "error";
  error: string | null;
};

const RowSchema = z.object({
  internal_pn: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  internal_notes: z.string().trim().max(2000).optional().nullable(),
  aliases: z
    .array(
      z.object({
        alias_pn: z.string().trim().min(1).max(120),
        source_type: z.string().trim().max(40).nullable(),
        source_name: z.string().trim().max(120).nullable(),
      }),
    )
    .max(20),
});

const ALLOWED_SOURCE_TYPES = new Set([
  "customer",
  "manufacturer",
  "vendor",
  "other",
]);

// Parses a CSV string into preview rows. Expected columns (case-insensitive):
//   internal_pn (required)
//   description
//   internal_notes
//   aliases — pipe-separated list of "pn|source_type|source_name" triples
// Anything we can't parse is flagged as an error row so the UI can show what's
// broken without committing anything.
export async function parsePartsCsv(
  csv: string,
): Promise<ActionResult<{ rows: ImportRowPreview[] }>> {
  if (!csv.trim()) return err("validation", "Empty file");
  try {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return err("validation", "Need a header row + at least 1 data row");
    }

    const header = parseCsvLine(lines[0]).map((h) =>
      h.toLowerCase().trim().replace(/\s+/g, "_"),
    );
    const colIdx = (name: string) => header.indexOf(name);
    const pnIdx = colIdx("internal_pn");
    if (pnIdx < 0) {
      return err("validation", `Missing required column: internal_pn. Headers seen: ${header.join(", ")}`);
    }
    const descIdx = colIdx("description");
    const notesIdx = colIdx("internal_notes");
    const aliasIdx = colIdx("aliases");

    const seenPns = new Set<string>();
    const supabase = createClient();

    // Pre-fetch existing internal_pns to detect dupes before commit.
    const proposedPns = lines
      .slice(1)
      .map((l) => parseCsvLine(l)[pnIdx]?.trim())
      .filter(Boolean) as string[];
    let existing = new Set<string>();
    if (proposedPns.length > 0) {
      const { data: dbExisting } = await supabase
        .from("parts")
        .select("internal_pn")
        .in("internal_pn", proposedPns);
      existing = new Set((dbExisting ?? []).map((r) => r.internal_pn));
    }

    const rows: ImportRowPreview[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const pn = (cells[pnIdx] ?? "").trim();
      const desc = descIdx >= 0 ? (cells[descIdx] ?? "").trim() || null : null;
      const notes =
        notesIdx >= 0 ? (cells[notesIdx] ?? "").trim() || null : null;
      const aliasesRaw = aliasIdx >= 0 ? (cells[aliasIdx] ?? "").trim() : "";

      const aliases = aliasesRaw
        ? aliasesRaw.split("|").map((triple) => {
            const [aliasPn = "", sourceType = "", sourceName = ""] = triple
              .split("/")
              .map((s) => s.trim());
            return {
              alias_pn: aliasPn,
              source_type:
                sourceType && ALLOWED_SOURCE_TYPES.has(sourceType.toLowerCase())
                  ? sourceType.toLowerCase()
                  : null,
              source_name: sourceName || null,
            };
          })
        : [];

      let status: ImportRowPreview["status"] = "ready";
      let error: string | null = null;
      if (!pn) {
        status = "error";
        error = "Missing internal_pn";
      } else if (existing.has(pn)) {
        status = "duplicate";
        error = `Internal PN "${pn}" already exists`;
      } else if (seenPns.has(pn)) {
        status = "error";
        error = `Duplicate within file: ${pn}`;
      } else {
        seenPns.add(pn);
        const checked = RowSchema.safeParse({
          internal_pn: pn,
          description: desc,
          internal_notes: notes,
          aliases: aliases.filter((a) => a.alias_pn),
        });
        if (!checked.success) {
          status = "error";
          error = checked.error.issues[0].message;
        }
      }

      rows.push({
        row_number: i + 1,
        internal_pn: pn,
        description: desc,
        internal_notes: notes,
        aliases,
        status,
        error,
      });
    }

    return ok({ rows });
  } catch (e) {
    return fromException(e);
  }
}

const CommitSchema = z.object({
  rows: z.array(
    z.object({
      internal_pn: z.string().min(1).max(120),
      description: z.string().nullable(),
      internal_notes: z.string().nullable(),
      aliases: z.array(
        z.object({
          alias_pn: z.string().min(1).max(120),
          source_type: z.string().nullable(),
          source_name: z.string().nullable(),
        }),
      ),
    }),
  ),
});

export async function commitPartsImport(
  input: z.input<typeof CommitSchema>,
): Promise<ActionResult<{ created: number }>> {
  const parsed = CommitSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();

    // Insert all parts in a single batch.
    const partsPayload = parsed.data.rows.map((r) => ({
      internal_pn: r.internal_pn,
      description: r.description,
      internal_notes: r.internal_notes,
      created_by: userId,
      updated_by: userId,
    }));

    const { data: inserted, error: pErr } = await supabase
      .from("parts")
      .insert(partsPayload)
      .select("id, internal_pn");
    if (pErr) return err(pErr.code ?? "db_error", pErr.message);

    // Map back to find which part_id each row's aliases belong to.
    const byPn = new Map((inserted ?? []).map((p) => [p.internal_pn, p.id]));
    const aliasPayload: Array<{
      part_id: string;
      alias_pn: string;
      source_type: string | null;
      source_name: string | null;
      created_by: string | null;
      updated_by: string | null;
    }> = [];
    for (const r of parsed.data.rows) {
      const partId = byPn.get(r.internal_pn);
      if (!partId) continue;
      for (const a of r.aliases) {
        if (!a.alias_pn) continue;
        aliasPayload.push({
          part_id: partId,
          alias_pn: a.alias_pn,
          source_type: a.source_type,
          source_name: a.source_name,
          created_by: userId,
          updated_by: userId,
        });
      }
    }
    if (aliasPayload.length > 0) {
      const { error: aErr } = await supabase
        .from("part_aliases")
        .insert(aliasPayload);
      if (aErr) return err(aErr.code ?? "db_error", aErr.message);
    }

    revalidatePath("/parts");
    return ok({ created: inserted?.length ?? 0 });
  } catch (e) {
    return fromException(e);
  }
}

// Minimal RFC-4180-ish CSV line parser. Handles quoted fields, escaped quotes,
// trailing whitespace. Not a full implementation — sufficient for hand-curated
// part list CSVs without weird embedded newlines.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  let cur = "";
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 2;
      } else if (c === '"') {
        inQuotes = false;
        i++;
      } else {
        cur += c;
        i++;
      }
    } else {
      if (c === ",") {
        out.push(cur);
        cur = "";
        i++;
      } else if (c === '"' && cur === "") {
        inQuotes = true;
        i++;
      } else {
        cur += c;
        i++;
      }
    }
  }
  out.push(cur);
  return out;
}
