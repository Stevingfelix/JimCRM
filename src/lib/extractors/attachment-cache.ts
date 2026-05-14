import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { PROMPT_VERSION } from "./prompts";
import type { ExtractionResult } from "./_pattern";

export function hashBytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function readAttachmentCache(
  contentHash: string,
): Promise<ExtractionResult | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("attachment_extractions")
      .select("extraction")
      .eq("content_hash", contentHash)
      .eq("prompt_version", PROMPT_VERSION)
      .maybeSingle();
    if (error || !data) return null;

    // Best-effort: bump hit counter + last_hit_at (fire-and-forget).
    void supabase
      .from("attachment_extractions")
      .update({
        hit_count: 1, // increment handled separately if we want; keep simple for now
        last_hit_at: new Date().toISOString(),
      })
      .eq("content_hash", contentHash)
      .eq("prompt_version", PROMPT_VERSION);

    return data.extraction as unknown as ExtractionResult;
  } catch {
    return null;
  }
}

export async function writeAttachmentCache(
  contentHash: string,
  extraction: ExtractionResult,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    // upsert: if a row exists for this hash+version, replace it (shouldn't
    // happen normally — cache reads check first — but harmless to overwrite).
    await supabase
      .from("attachment_extractions")
      .upsert(
        {
          content_hash: contentHash,
          prompt_version: PROMPT_VERSION,
          extraction: extraction as unknown as Json,
        },
        { onConflict: "content_hash,prompt_version" },
      );
  } catch {
    // never fail the extraction because of a cache write
  }
}
