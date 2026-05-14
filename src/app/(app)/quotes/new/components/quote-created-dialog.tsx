"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Mail,
  MessageCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generatePublicLink, updateQuoteStatus } from "../../actions";

type Props = {
  quoteId: string;
  displayNumber: string;
  customerName: string;
  initialPublicToken: string | null;
  onClose: () => void;
};

// Modal shown right after a quote is created. The decision to "Open in
// builder" or "back to list" lives in the footer; the body offers quick
// outbound actions that keep Jim in this surface instead of bouncing him to
// the detail page just to send.
export function QuoteCreatedDialog({
  quoteId,
  displayNumber,
  customerName,
  initialPublicToken,
  onClose,
}: Props) {
  const router = useRouter();
  const [markSent, setMarkSent] = useState(true);
  const [publicToken, setPublicToken] = useState<string | null>(
    initialPublicToken,
  );
  const [linking, setLinking] = useState(false);
  const [statusPending, startStatusTransition] = useTransition();

  async function ensurePublicLink(): Promise<string | null> {
    if (publicToken) return buildShareUrl(publicToken);
    setLinking(true);
    try {
      const res = await generatePublicLink({ id: quoteId });
      if (!res.ok) {
        toast.error(res.error.message);
        return null;
      }
      setPublicToken(res.data.token);
      return buildShareUrl(res.data.token);
    } finally {
      setLinking(false);
    }
  }

  async function handleCopyLink() {
    const url = await ensurePublicLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Couldn't copy — try again");
    }
  }

  async function handleEmail() {
    const url = await ensurePublicLink();
    if (!url) return;
    const subject = `Quote ${displayNumber} from CAP Hardware Supply`;
    const body =
      `Hi ${customerName},\n\n` +
      `Your quote ${displayNumber} is ready. You can review it here:\n${url}\n\n` +
      `Reply to this email with any questions.\n`;
    window.location.href = `mailto:?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  async function handleWhatsApp() {
    const url = await ensurePublicLink();
    if (!url) return;
    const text = `Quote ${displayNumber} for ${customerName}: ${url}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function handlePdf() {
    window.open(`/api/quotes/${quoteId}/pdf`, "_blank", "noopener,noreferrer");
  }

  function handleOpenQuote() {
    if (markSent) {
      startStatusTransition(async () => {
        await updateQuoteStatus({
          id: quoteId,
          status: "sent",
          outcome_reason: null,
        });
        router.push(`/quotes/${quoteId}`);
      });
    } else {
      router.push(`/quotes/${quoteId}`);
    }
  }

  function handleDone() {
    if (markSent) {
      startStatusTransition(async () => {
        await updateQuoteStatus({
          id: quoteId,
          status: "sent",
          outcome_reason: null,
        });
        router.push("/quotes");
      });
    } else {
      router.push("/quotes");
    }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3 items-center text-center">
          <div className="size-14 rounded-full bg-brand-gradient-soft text-primary grid place-items-center">
            <CheckCircle2 className="size-7" strokeWidth={2.25} />
          </div>
          <DialogTitle className="text-xl">Quote Created!</DialogTitle>
          <p className="text-sm text-muted-foreground">
            What would you like to do with this quote?
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {/* Mark as Sent toggle row */}
          <button
            type="button"
            onClick={() => setMarkSent((v) => !v)}
            className="w-full flex items-center justify-between rounded-xl border bg-card px-4 py-3 hover:bg-muted/40 transition-colors text-left"
            aria-pressed={markSent}
          >
            <div>
              <div className="text-sm font-medium">Mark as Sent</div>
              <div className="text-xs text-muted-foreground">
                Flip the quote out of draft once you&apos;re done.
              </div>
            </div>
            <span
              className={cn(
                "h-6 w-11 rounded-full transition-colors relative shrink-0",
                markSent ? "bg-primary" : "bg-muted-foreground/25",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all",
                  markSent ? "left-[22px]" : "left-0.5",
                )}
              />
            </span>
          </button>

          {/* Outbound action buttons */}
          <div className="space-y-2">
            <ActionRow
              icon={<Mail className="size-4" />}
              label="Send via Email"
              onClick={handleEmail}
              disabled={linking}
            />
            <ActionRow
              icon={<MessageCircle className="size-4" />}
              label="WhatsApp"
              onClick={handleWhatsApp}
              disabled={linking}
            />
            <ActionRow
              icon={
                linking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Copy className="size-4" />
                )
              }
              label="Copy share link"
              onClick={handleCopyLink}
              disabled={linking}
            />
            <ActionRow
              icon={<Download className="size-4" />}
              label="Download PDF"
              onClick={handlePdf}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleDone}
            disabled={statusPending}
            className="rounded-full"
          >
            {statusPending ? "Saving…" : "Done"}
          </Button>
          <Button
            type="button"
            onClick={handleOpenQuote}
            disabled={statusPending}
            className="rounded-full"
          >
            <Check className="size-4 mr-1.5" />
            {statusPending ? "Saving…" : "Open quote"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildShareUrl(token: string): string {
  if (typeof window === "undefined") return `/q/${token}`;
  return `${window.location.origin}/q/${token}`;
}

function ActionRow({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors text-left disabled:opacity-50"
    >
      <span className="size-8 rounded-full bg-brand-gradient-soft text-primary grid place-items-center shrink-0">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}
