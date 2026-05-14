import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import { refreshAccessToken } from "./oauth";

type Credentials = {
  id: string;
  email: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  watched_label: string;
  last_polled_at: string | null;
  last_history_id: string | null;
  watch_expiration: string | null;
};

export async function getActiveCredentials(): Promise<Credentials | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("gmail_credentials")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    email: data.email,
    refresh_token: decrypt(data.encrypted_refresh_token),
    access_token: data.encrypted_access_token
      ? decrypt(data.encrypted_access_token)
      : null,
    access_token_expires_at: data.access_token_expires_at,
    watched_label: data.watched_label,
    last_polled_at: data.last_polled_at,
    last_history_id: data.last_history_id ?? null,
    watch_expiration: data.watch_expiration ?? null,
  };
}

export async function getActiveCredentialsPublic(): Promise<{
  connected: boolean;
  email: string | null;
  watched_label: string | null;
  last_polled_at: string | null;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("gmail_credentials")
    .select("email, watched_label, last_polled_at")
    .eq("is_active", true)
    .maybeSingle();
  if (!data) {
    return {
      connected: false,
      email: null,
      watched_label: null,
      last_polled_at: null,
    };
  }
  return {
    connected: true,
    email: data.email,
    watched_label: data.watched_label,
    last_polled_at: data.last_polled_at,
  };
}

export async function saveCredentials(input: {
  email: string;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  // Deactivate any prior row to keep the singleton index honest.
  await supabase
    .from("gmail_credentials")
    .update({ is_active: false })
    .eq("is_active", true);

  const { error } = await supabase.from("gmail_credentials").insert({
    email: input.email,
    encrypted_refresh_token: encrypt(input.refreshToken),
    encrypted_access_token: input.accessToken ? encrypt(input.accessToken) : null,
    access_token_expires_at: input.expiresAt,
    is_active: true,
  });
  if (error) throw new Error(error.message);
}

export async function disconnect(): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("gmail_credentials")
    .update({ is_active: false })
    .eq("is_active", true);
}

export async function getValidAccessToken(
  creds: Credentials,
): Promise<string> {
  const now = Date.now();
  const expiry = creds.access_token_expires_at
    ? Date.parse(creds.access_token_expires_at)
    : 0;
  // Refresh if no token or expiring within 60s
  if (!creds.access_token || expiry - now < 60_000) {
    const refreshed = await refreshAccessToken(creds.refresh_token);
    const supabase = createAdminClient();
    await supabase
      .from("gmail_credentials")
      .update({
        encrypted_access_token: encrypt(refreshed.accessToken),
        access_token_expires_at: refreshed.expiresAt,
      })
      .eq("id", creds.id);
    return refreshed.accessToken;
  }
  return creds.access_token;
}
