"use client";

import { useState, useTransition } from "react";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPartWithAlias } from "@/app/(app)/parts/actions";

type Props = {
  // Customer's external PN that triggered the no-match state. Recorded as
  // the new part's alias so the next RFQ for it auto-resolves.
  aliasPn: string;
  // Free-text snippet pulled from the source (raw_text). Used as the
  // suggested description.
  suggestedDescription: string;
  // Where did the alias come from? "customer" for inbound RFQs (default),
  // "vendor" for vendor replies — drives the alias source_type field.
  aliasSourceType: "customer" | "vendor";
  // Optional sender / company name to record as alias_source_name. Helps
  // disambiguate "this is John at Acme's name for it" later.
  aliasSourceName: string | null;
  // Called when the part is created. The row uses it to link the line to
  // the new CAP part (no further search needed).
  onCreated: (part: {
    id: string;
    internal_pn: string;
    description: string | null;
  }) => void;
};

// Inline form that appears in the review queue when an extracted line has
// no matching CAP part. One Save click creates the CAP part AND records
// the external PN as an alias.

export function InlineCreatePart({
  aliasPn,
  suggestedDescription,
  aliasSourceType,
  aliasSourceName,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [internalPn, setInternalPn] = useState("");
  const [description, setDescription] = useState(suggestedDescription);
  const [pending, startTransition] = useTransition();

  function reset() {
    setOpen(false);
    setInternalPn("");
    setDescription(suggestedDescription);
  }

  function copyAliasIntoInternal() {
    setInternalPn(aliasPn);
  }

  function handleSave() {
    if (!internalPn.trim()) {
      toast.error("Pick a CAP internal PN first");
      return;
    }
    startTransition(async () => {
      const res = await createPartWithAlias({
        internal_pn: internalPn.trim(),
        description: description.trim() || null,
        alias_pn: aliasPn,
        alias_source_type: aliasSourceType,
        alias_source_name: aliasSourceName ?? null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      onCreated({
        id: res.data.id,
        internal_pn: res.data.internal_pn,
        description: description.trim() || null,
      });
      toast.success(`Created ${res.data.internal_pn} (alias: ${aliasPn})`);
      reset();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-primary hover:underline"
      >
        <Sparkles className="size-3" />
        Create CAP part + add &ldquo;{aliasPn}&rdquo; as alias
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-primary/30 bg-brand-gradient-soft p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">
          New CAP part — alias{" "}
          <code className="font-mono text-foreground">{aliasPn}</code>
        </span>
        <button
          type="button"
          onClick={reset}
          aria-label="Cancel"
          className="size-5 grid place-items-center rounded text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="grid gap-1.5">
        <div className="flex gap-1.5">
          <Input
            value={internalPn}
            onChange={(e) => setInternalPn(e.target.value)}
            placeholder="CAP internal PN (e.g. HCS 04C-0750G8Y)"
            className="h-8 text-xs font-mono bg-card"
            autoFocus
          />
          <button
            type="button"
            onClick={copyAliasIntoInternal}
            disabled={pending}
            title={`Use "${aliasPn}" as the internal PN`}
            className="shrink-0 inline-flex h-8 items-center rounded-md border border-foreground/10 bg-card px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Same as alias
          </button>
        </div>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="h-8 text-xs bg-card"
        />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={pending}
          className="h-7 text-[11px] rounded-full"
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={pending || !internalPn.trim()}
          className="h-7 text-[11px] rounded-full"
        >
          {pending ? "Creating…" : "Create part"}
        </Button>
      </div>
    </div>
  );
}
