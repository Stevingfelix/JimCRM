"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { softDeletePart, updatePart } from "../actions";

type Props = {
  initial: {
    id: string;
    internal_pn: string;
    description: string | null;
    internal_notes: string | null;
  };
};

export function PartForm({ initial }: Props) {
  const router = useRouter();
  const [pn, setPn] = useState(initial.internal_pn);
  const [description, setDescription] = useState(initial.description ?? "");
  const [internalNotes, setInternalNotes] = useState(
    initial.internal_notes ?? "",
  );
  const [pendingSave, startSave] = useTransition();
  const [pendingDelete, startDelete] = useTransition();

  const dirty =
    pn !== initial.internal_pn ||
    description !== (initial.description ?? "") ||
    internalNotes !== (initial.internal_notes ?? "");

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const result = await updatePart({
        id: initial.id,
        internal_pn: pn,
        description: description || null,
        internal_notes: internalNotes || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  };

  const onDelete = () => {
    if (
      !confirm(
        `Soft-delete part "${initial.internal_pn}"? It will be hidden from lists but recoverable.`,
      )
    )
      return;
    startDelete(async () => {
      const result = await softDeletePart(initial.id);
      if (result && !result.ok) {
        toast.error(result.error.message);
      }
    });
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="pn">Internal PN *</Label>
        <Input
          id="pn"
          value={pn}
          onChange={(e) => setPn(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="desc">Description</Label>
        <Textarea
          id="desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="notes">
          Internal notes{" "}
          <span className="text-xs text-muted-foreground">
            (never on customer PDFs)
          </span>
        </Label>
        <Textarea
          id="notes"
          rows={3}
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          disabled={pendingDelete}
        >
          {pendingDelete ? "Deleting…" : "Delete"}
        </Button>
        <Button type="submit" disabled={!dirty || pendingSave}>
          {pendingSave ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
