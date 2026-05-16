import { google } from "googleapis";

export type AttachmentRef = {
  filename: string;
  mime_type: string;
  attachment_id: string;
  size: number;
};

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB cap per attachment

const PDF_MIME = "application/pdf";
const EXCEL_MIMES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
]);

type Part = {
  filename?: string | null;
  mimeType?: string | null;
  body?: { attachmentId?: string | null; size?: number | null } | null;
  parts?: Part[];
};

export function isSupportedAttachment(p: Part): boolean {
  const mime = p.mimeType ?? "";
  if (mime === PDF_MIME) return true;
  if (EXCEL_MIMES.has(mime)) return true;
  if (IMAGE_MIMES.has(mime)) return true;
  const fn = (p.filename ?? "").toLowerCase();
  return (
    fn.endsWith(".pdf") ||
    fn.endsWith(".xlsx") ||
    fn.endsWith(".xls") ||
    fn.endsWith(".jpg") ||
    fn.endsWith(".jpeg") ||
    fn.endsWith(".png") ||
    fn.endsWith(".gif") ||
    fn.endsWith(".webp")
  );
}

export function attachmentKind(
  p: Part,
): "pdf" | "excel" | "image" | null {
  const mime = p.mimeType ?? "";
  if (mime === PDF_MIME) return "pdf";
  if (EXCEL_MIMES.has(mime)) return "excel";
  if (IMAGE_MIMES.has(mime)) return "image";
  const fn = (p.filename ?? "").toLowerCase();
  if (fn.endsWith(".pdf")) return "pdf";
  if (fn.endsWith(".xlsx") || fn.endsWith(".xls")) return "excel";
  if (
    fn.endsWith(".jpg") ||
    fn.endsWith(".jpeg") ||
    fn.endsWith(".png") ||
    fn.endsWith(".gif") ||
    fn.endsWith(".webp")
  )
    return "image";
  return null;
}

export function listAttachmentRefs(payload: Part | null | undefined): AttachmentRef[] {
  if (!payload) return [];
  const acc: AttachmentRef[] = [];
  walk(payload, acc);
  return acc.filter(
    (a) => a.size <= MAX_ATTACHMENT_BYTES && a.attachment_id !== "",
  );
}

function walk(p: Part, acc: AttachmentRef[]): void {
  if (
    p.filename &&
    p.body?.attachmentId &&
    isSupportedAttachment(p)
  ) {
    acc.push({
      filename: p.filename,
      mime_type: p.mimeType ?? "application/octet-stream",
      attachment_id: p.body.attachmentId,
      size: p.body.size ?? 0,
    });
  }
  for (const child of p.parts ?? []) walk(child, acc);
}

export async function fetchAttachmentBytes(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  const data = res.data.data;
  if (!data) throw new Error("Empty attachment payload");
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
