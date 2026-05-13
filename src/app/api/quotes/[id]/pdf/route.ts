import { NextRequest, NextResponse } from "next/server";
import { renderQuotePdf } from "@/lib/pdf/render";

// Force Node.js runtime (react-pdf relies on Node APIs).
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { buffer, filename } = await renderQuotePdf(params.id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
