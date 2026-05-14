"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

// Saved searches live in auth.users.user_metadata.saved_searches as
// { [routeKey]: Array<{ name: string; query_string: string }> }.
// No table needed; it's per-user and the data is small.

export type SavedSearch = {
  name: string;
  query_string: string;
};

const SaveSearchSchema = z.object({
  route_key: z.enum(["parts", "customers", "vendors", "quotes"]),
  name: z.string().trim().min(1).max(60),
  query_string: z.string().max(500),
});

const DeleteSearchSchema = z.object({
  route_key: z.enum(["parts", "customers", "vendors", "quotes"]),
  name: z.string().trim().min(1).max(60),
});

type SavedSearchMap = Record<string, SavedSearch[]>;

function readSearches(
  metadata: Record<string, unknown> | undefined,
): SavedSearchMap {
  const raw = metadata?.saved_searches;
  if (!raw || typeof raw !== "object") return {};
  return raw as SavedSearchMap;
}

export async function saveSearch(
  input: z.input<typeof SaveSearchSchema>,
): Promise<ActionResult<void>> {
  const parsed = SaveSearchSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return err("auth", "Not signed in");

    const existing = readSearches(userData.user.user_metadata);
    const list = existing[parsed.data.route_key] ?? [];
    const filtered = list.filter((s) => s.name !== parsed.data.name);
    filtered.push({
      name: parsed.data.name,
      query_string: parsed.data.query_string,
    });
    const next: SavedSearchMap = {
      ...existing,
      [parsed.data.route_key]: filtered.slice(0, 10), // cap at 10 per route
    };

    const { error } = await supabase.auth.updateUser({
      data: {
        ...userData.user.user_metadata,
        saved_searches: next,
      },
    });
    if (error) return err("db_error", error.message);
    revalidatePath(`/${parsed.data.route_key}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteSearch(
  input: z.input<typeof DeleteSearchSchema>,
): Promise<ActionResult<void>> {
  const parsed = DeleteSearchSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return err("auth", "Not signed in");

    const existing = readSearches(userData.user.user_metadata);
    const list = existing[parsed.data.route_key] ?? [];
    const filtered = list.filter((s) => s.name !== parsed.data.name);
    const next: SavedSearchMap = {
      ...existing,
      [parsed.data.route_key]: filtered,
    };

    const { error } = await supabase.auth.updateUser({
      data: {
        ...userData.user.user_metadata,
        saved_searches: next,
      },
    });
    if (error) return err("db_error", error.message);
    revalidatePath(`/${parsed.data.route_key}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function getSavedSearches(
  routeKey: "parts" | "customers" | "vendors" | "quotes",
): Promise<SavedSearch[]> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const all = readSearches(userData.user.user_metadata);
  return all[routeKey] ?? [];
}
