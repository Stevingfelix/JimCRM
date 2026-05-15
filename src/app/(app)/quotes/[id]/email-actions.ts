"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { getActiveCredentials, getValidAccessToken } from "@/lib/gmail/credentials";
import { renderQuotePdf } from "@/lib/pdf/render";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const SendQuoteEmailSchema = z.object({
  quote_id: z.string().uuid(),
  to: z.string().email(),
  cc: z.string().email().optional().or(z.literal("")),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(10000),
});

export async function sendQuoteEmail(
  input: z.input<typeof SendQuoteEmailSchema>,
): Promise<ActionResult<void>> {
  const parsed = SendQuoteEmailSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);

  try {
    const userId = await getCurrentUserId();

    // 1. Render PDF
    const { buffer, filename } = await renderQuotePdf(parsed.data.quote_id);

    // 2. Get Gmail credentials
    const creds = await getActiveCredentials();
    if (!creds) {
      return err("gmail_not_connected", "Gmail is not connected. Connect it in Settings first.");
    }
    const accessToken = await getValidAccessToken(creds);

    // 3. Build MIME multipart message
    const boundary = "boundary_cap_quote_email";
    const pdfBase64 = Buffer.from(buffer).toString("base64");

    const headers = [
      `From: ${creds.email}`,
      `To: ${parsed.data.to}`,
      ...(parsed.data.cc ? [`Cc: ${parsed.data.cc}`] : []),
      `Subject: ${parsed.data.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ].join("\r\n");

    const mimeBody = [
      headers,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      parsed.data.body,
      "",
      `--${boundary}`,
      `Content-Type: application/pdf; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      pdfBase64,
      "",
      `--${boundary}--`,
    ].join("\r\n");

    // 4. URL-safe base64 encode the entire MIME message
    const encodedMessage = Buffer.from(mimeBody)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // 5. Send via Gmail API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    // 6. Update quote status to 'sent'
    const supabase = createClient();
    await supabase
      .from("quotes")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", parsed.data.quote_id);

    revalidatePath(`/quotes/${parsed.data.quote_id}`);
    revalidatePath("/quotes");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
