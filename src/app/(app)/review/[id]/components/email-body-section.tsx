"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

type Props = {
  bodyText: string | null;
  bodyHtml: string | null;
  gmailMsgId: string;
};

/** Strip app-generated URLs and angle-bracket wrappers from plain text. */
function cleanBodyText(text: string): string {
  return (
    text
      // Remove app-generated part links: <https://...vercel.app/parts/...>
      .replace(/<https?:\/\/[^>]*vercel\.app\/[^>]*>/g, "")
      // Strip angle brackets around remaining URLs: <https://foo> → https://foo
      .replace(/<(https?:\/\/[^>]+)>/g, "$1")
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export function EmailBodySection({ bodyText, bodyHtml, gmailMsgId }: Props) {
  const [view, setView] = useState<"formatted" | "raw">(
    bodyHtml ? "formatted" : "raw",
  );

  const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${gmailMsgId}`;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">
          Original email
        </h2>
        <div className="flex items-center gap-2">
          {bodyHtml && (
            <div className="inline-flex items-center rounded-md border text-xs">
              <button
                type="button"
                onClick={() => setView("formatted")}
                className={`px-3 py-1 rounded-l-md transition-colors ${
                  view === "formatted"
                    ? "bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                Formatted
              </button>
              <button
                type="button"
                onClick={() => setView("raw")}
                className={`px-3 py-1 rounded-r-md transition-colors ${
                  view === "raw"
                    ? "bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                Raw text
              </button>
            </div>
          )}
          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3" />
            Gmail
          </a>
        </div>
      </div>

      {view === "formatted" && bodyHtml ? (
        <iframe
          srcDoc={bodyHtml}
          sandbox=""
          className="w-full h-[400px] rounded-md border bg-white"
          title="Original email"
        />
      ) : (
        <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-auto max-h-80 whitespace-pre-wrap font-sans">
          {bodyText ? cleanBodyText(bodyText) : "(empty)"}
        </pre>
      )}
    </section>
  );
}
