import { google } from "googleapis";
import { listAttachmentRefs, type AttachmentRef } from "./attachments";

export type GmailHeader = { name?: string | null; value?: string | null };

export type ParsedMessage = {
  id: string;
  thread_id: string;
  internal_date: string; // ISO
  from_email: string | null;
  from_name: string | null;
  to: string | null;
  subject: string | null;
  body_text: string;
  attachments: AttachmentRef[];
};

function gmail(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

export async function findLabelId(
  accessToken: string,
  name: string,
): Promise<string | null> {
  const res = await gmail(accessToken).users.labels.list({ userId: "me" });
  const match = res.data.labels?.find(
    (l) => l.name?.toLowerCase() === name.toLowerCase(),
  );
  return match?.id ?? null;
}

export async function listMessageIds(
  accessToken: string,
  labelId: string,
  options: { maxResults?: number } = {},
): Promise<string[]> {
  const res = await gmail(accessToken).users.messages.list({
    userId: "me",
    labelIds: [labelId],
    maxResults: options.maxResults ?? 25,
  });
  return (res.data.messages ?? []).map((m) => m.id!).filter(Boolean);
}

export async function getMessage(
  accessToken: string,
  id: string,
): Promise<ParsedMessage> {
  const res = await gmail(accessToken).users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
  const m = res.data;
  const headers = (m.payload?.headers ?? []) as GmailHeader[];
  const headerVal = (n: string) =>
    headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? null;

  const fromRaw = headerVal("From") ?? "";
  const fromMatch = fromRaw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  const from_name = fromMatch?.[1]?.trim() || null;
  const from_email = fromMatch?.[2]?.trim()?.toLowerCase() || null;

  return {
    id: m.id!,
    thread_id: m.threadId!,
    internal_date: m.internalDate
      ? new Date(Number(m.internalDate)).toISOString()
      : new Date().toISOString(),
    from_email,
    from_name,
    to: headerVal("To"),
    subject: headerVal("Subject"),
    body_text: extractBodyText(m.payload),
    attachments: listAttachmentRefs(m.payload),
  };
}

type Part = {
  mimeType?: string | null;
  body?: { data?: string | null; size?: number | null } | null;
  parts?: Part[];
};

function extractBodyText(payload: Part | null | undefined): string {
  if (!payload) return "";
  // Prefer text/plain; fall back to text/html stripped of tags.
  const plain = findPart(payload, "text/plain");
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);
  const html = findPart(payload, "text/html");
  if (html?.body?.data) return stripHtml(decodeBase64Url(html.body.data));
  // Single-part: payload itself
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    return payload.mimeType?.includes("html") ? stripHtml(decoded) : decoded;
  }
  return "";
}

function findPart(p: Part, mime: string): Part | null {
  if (p.mimeType === mime) return p;
  for (const child of p.parts ?? []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return null;
}

function decodeBase64Url(b64: string): string {
  return Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
