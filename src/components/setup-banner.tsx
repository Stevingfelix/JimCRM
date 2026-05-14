"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket, X } from "lucide-react";

type Props = {
  missing: string[];
};

const DISMISS_KEY = "cap-setup-banner-dismissed-v1";

// Shown on the dashboard until either:
//   1) the user clicks the X (per-browser, localStorage), or
//   2) company_info is fully populated (banner self-hides server-side).
export function SetupBanner({ missing }: Props) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed || missing.length === 0) return null;

  const label =
    missing.length === 1
      ? `Add your ${missing[0]}`
      : `${missing.length} steps left: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`;

  return (
    <div className="rounded-xl border border-primary/20 bg-brand-gradient-soft p-5 flex items-start gap-4">
      <div className="size-10 rounded-full bg-card text-primary grid place-items-center shrink-0 shadow-sm">
        <Rocket className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold">Complete your business setup</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add your company details, logo, and contact info so quote PDFs go out
          branded and your portal looks polished. {label}.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/settings/company"
          className="inline-flex items-center h-9 rounded-full bg-primary text-primary-foreground px-4 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go to Settings
        </Link>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          aria-label="Dismiss"
          className="size-8 rounded-full grid place-items-center text-muted-foreground hover:bg-card transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
