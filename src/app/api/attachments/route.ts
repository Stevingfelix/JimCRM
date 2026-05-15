import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveCredentials,
  getValidAccessToken,
} from "@/lib/gmail/credentials";
import { fetchAttachmentBytes } from "@/lib/gmail/attachments";

/**
 * GET /api/attachments?event_id=<uuid>&filename=<name>
 *
 * Re-fetches an email attachment from Gmail and streams it to the browser.
 * Used for preview/download on the review detail page.
 */
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id");
  const filename = req.nextUrl.searchParams.get("filename");
  if (!eventId || !filename) {
    return NextResponse.json(
      { error: "event_id and filename required" },
      { status: 400 },
    );
  }

  // Auth check — must be a logged-in user
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the email event to get gmail_msg_id and attachment metadata
  const { data: event } = await supabase
    .from("email_events")
    .select("gmail_msg_id, parsed_payload")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  type Meta = {
    filename: string;
    mime_type: string | null;
    attachment_id?: string;
  };
  const payload = event.parsed_payload as {
    attachments_meta?: Meta[];
  } | null;
  const meta = payload?.attachments_meta?.find(
    (a) => a.filename === filename,
  );
  if (!meta?.attachment_id) {
    return NextResponse.json(
      { error: "Attachment not found or missing attachment_id (older email — re-process to enable download)" },
      { status: 404 },
    );
  }

  // Get Gmail credentials and fetch the attachment
  const creds = await getActiveCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: "Gmail not connected" },
      { status: 503 },
    );
  }
  const accessToken = await getValidAccessToken(creds);
  const bytes = await fetchAttachmentBytes(
    accessToken,
    event.gmail_msg_id,
    meta.attachment_id,
  );

  const mimeType = meta.mime_type ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
      "Content-Length": String(bytes.length),
    },
  });
}
