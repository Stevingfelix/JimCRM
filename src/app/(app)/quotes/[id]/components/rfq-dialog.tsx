"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatQuoteNumber } from "@/lib/format";
import {
  createRfq,
  markRfqSent,
  suggestVendorsForRfq,
} from "../rfq-actions";

type Props = {
  quoteId: string;
  quoteNumber: number;
  lines: Array<{
    part_id: string | null;
    part_internal_pn: string | null;
    part_short_description: string | null;
    qty: number;
  }>;
};

type VendorOption = {
  id: string;
  name: string;
  categories: string[];
  contact_emails: string[];
  last_quote_age_days: number | null;
  last_unit_price: number | null;
  matched_part_count: number;
  recommended: boolean;
};

export function RfqDialog({ quoteId, quoteNumber, lines }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedLines, setSelectedLines] = useState<string[]>(() =>
    lines.filter((l) => l.part_id).map((l) => l.part_id as string),
  );
  const [subject, setSubject] = useState(
    `RFQ — ${formatQuoteNumber(quoteNumber)} — ${lines.length} part${lines.length === 1 ? "" : "s"}`,
  );
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    suggestVendorsForRfq({ part_ids: selectedLines }).then((vs) => {
      setVendors(vs);
      // Auto-select recommended vendors (those who've quoted these parts before)
      const recommended = vs.filter((v) => v.recommended).map((v) => v.id);
      if (recommended.length > 0) {
        setSelectedVendors(recommended);
      }
    });
  }, [open, selectedLines]);

  useEffect(() => {
    const lineRows = lines
      .filter((l) => l.part_id && selectedLines.includes(l.part_id))
      .map(
        (l) =>
          `- ${l.part_internal_pn ?? "(no PN)"}${l.part_short_description ? ` (${l.part_short_description})` : ""} — qty ${l.qty}`,
      )
      .join("\n");
    setBody(
      `Hi,\n\nWe'd like pricing on the following:\n\n${lineRows}\n\nPlease reply with unit cost + lead time when convenient.\n\nThanks,\nJim\nCAP Hardware Supply`,
    );
  }, [lines, selectedLines]);

  const toggleVendor = (id: string) =>
    setSelectedVendors((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );

  const toggleLine = (partId: string) =>
    setSelectedLines((prev) =>
      prev.includes(partId)
        ? prev.filter((p) => p !== partId)
        : [...prev, partId],
    );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVendors.length === 0) {
      toast.error("Pick at least one vendor");
      return;
    }
    if (selectedLines.length === 0) {
      toast.error("Pick at least one line");
      return;
    }
    startTransition(async () => {
      // Create one RFQ row per vendor.
      const results = await Promise.all(
        selectedVendors.map((vendor_id) =>
          createRfq({
            quote_id: quoteId,
            vendor_id,
            part_ids: selectedLines,
            subject,
            body,
          }),
        ),
      );
      const fails = results.filter((r) => !r.ok);
      if (fails.length > 0) {
        toast.error(`${fails.length} RFQ${fails.length === 1 ? "" : "s"} failed`);
        return;
      }

      // Open each vendor's email link in a new tab, pre-filled with subject + body.
      // Jim reviews + clicks send manually. (Native Gmail send would require
      // the gmail.send OAuth scope, which is a separate restricted-scope item.)
      let openedAny = false;
      for (const vendorId of selectedVendors) {
        const v = vendors.find((vv) => vv.id === vendorId);
        if (!v?.contact_emails[0]) continue;
        const url = `mailto:${v.contact_emails[0]}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(url);
        openedAny = true;
      }
      if (!openedAny) {
        toast.info(
          "Drafted RFQs saved but no vendor emails on file. Add a vendor contact email to auto-open drafts next time.",
        );
      }

      // Mark all as sent (Jim's about to hit send in his email client).
      await Promise.all(
        results.map((r) => (r.ok ? markRfqSent(r.data.id) : null)),
      );

      toast.success(
        `Drafted ${results.length} RFQ${results.length === 1 ? "" : "s"}`,
      );
      setOpen(false);
      setSelectedVendors([]);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="h-10 rounded-full px-5"
            disabled={lines.filter((l) => l.part_id).length === 0}
          />
        }
      >
        RFQ vendors
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader className="space-y-1.5">
            <DialogTitle>RFQ vendors for {formatQuoteNumber(quoteNumber)}</DialogTitle>
            <DialogDescription>
              Pick which lines to ask about and which vendors to ask. Each
              vendor gets their own draft email; click send in your mail client.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 max-h-[60vh] overflow-auto">
            <div className="space-y-1.5">
              <Label>Lines</Label>
              <div className="rounded-lg border divide-y bg-card">
                {lines
                  .filter((l) => l.part_id)
                  .map((l) => (
                    <label
                      key={l.part_id}
                      className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLines.includes(l.part_id as string)}
                        onChange={() =>
                          toggleLine(l.part_id as string)
                        }
                      />
                      <span className="font-medium">{l.part_internal_pn}</span>
                      <span className="text-muted-foreground truncate flex-1">
                        {l.part_short_description ?? ""}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        qty {l.qty}
                      </span>
                    </label>
                  ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Vendors</Label>
              <div className="rounded-lg border bg-card max-h-72 overflow-auto">
                {vendors.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No vendors configured. Add some in /vendors first.
                  </div>
                ) : (
                  <>
                    {vendors.some((v) => v.recommended) && (
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 border-b">
                        Suggested — previously quoted these parts
                      </div>
                    )}
                    {vendors
                      .filter((v) => v.recommended)
                      .map((v) => (
                        <VendorRow
                          key={v.id}
                          vendor={v}
                          selected={selectedVendors.includes(v.id)}
                          onToggle={() => toggleVendor(v.id)}
                        />
                      ))}
                    {vendors.some((v) => v.recommended) &&
                      vendors.some((v) => !v.recommended) && (
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-y">
                          Other vendors
                        </div>
                      )}
                    {vendors
                      .filter((v) => !v.recommended)
                      .map((v) => (
                        <VendorRow
                          key={v.id}
                          vendor={v}
                          selected={selectedVendors.includes(v.id)}
                          onToggle={() => toggleVendor(v.id)}
                        />
                      ))}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rfq-subject">Subject</Label>
              <Input
                id="rfq-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rfq-body">Body</Label>
              <Textarea
                id="rfq-body"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                pending ||
                selectedVendors.length === 0 ||
                selectedLines.length === 0
              }
              className="h-11 rounded-full w-full text-sm"
            >
              {pending
                ? "Drafting…"
                : `Draft ${selectedVendors.length || ""} RFQ${selectedVendors.length === 1 ? "" : "s"} & open in mail client`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VendorRow({
  vendor: v,
  selected,
  onToggle,
}: {
  vendor: VendorOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer border-b last:border-b-0",
        selected
          ? "bg-emerald-50/40 dark:bg-emerald-950/20"
          : "hover:bg-muted/40",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{v.name}</span>
          {v.recommended && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              Suggested
            </span>
          )}
          {!v.contact_emails[0] && (
            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              No email
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {v.contact_emails[0] && (
            <span>{v.contact_emails[0]}</span>
          )}
          {v.contact_emails[0] && v.categories.length > 0 && " · "}
          {v.categories.join(", ") || (!v.contact_emails[0] ? "no categories" : "")}
        </div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        {v.last_unit_price != null && (
          <div className="text-xs tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
            ${v.last_unit_price.toFixed(4)}
          </div>
        )}
        {v.last_quote_age_days != null && (
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {v.last_quote_age_days}d ago
          </div>
        )}
        {v.recommended && v.matched_part_count > 0 && (
          <div className="text-[10px] text-muted-foreground">
            {v.matched_part_count} part{v.matched_part_count === 1 ? "" : "s"} matched
          </div>
        )}
      </div>
    </label>
  );
}
