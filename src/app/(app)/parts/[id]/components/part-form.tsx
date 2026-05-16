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
    short_description: string | null;
    long_description: string | null;
    internal_notes: string | null;
    thread_size: string | null;
    length: string | null;
    material: string | null;
    finish: string | null;
    grade: string | null;
    head_type: string | null;
    product_family: string | null;
  };
};

export function PartForm({ initial }: Props) {
  const router = useRouter();
  const [pn, setPn] = useState(initial.internal_pn);
  const [shortDescription, setShortDescription] = useState(initial.short_description ?? "");
  const [longDescription, setLongDescription] = useState(initial.long_description ?? "");
  const [internalNotes, setInternalNotes] = useState(
    initial.internal_notes ?? "",
  );
  const [threadSize, setThreadSize] = useState(initial.thread_size ?? "");
  const [length, setLength] = useState(initial.length ?? "");
  const [material, setMaterial] = useState(initial.material ?? "");
  const [finish, setFinish] = useState(initial.finish ?? "");
  const [grade, setGrade] = useState(initial.grade ?? "");
  const [headType, setHeadType] = useState(initial.head_type ?? "");
  const [productFamily, setProductFamily] = useState(initial.product_family ?? "");
  const [pendingSave, startSave] = useTransition();
  const [pendingDelete, startDelete] = useTransition();

  const dirty =
    pn !== initial.internal_pn ||
    shortDescription !== (initial.short_description ?? "") ||
    longDescription !== (initial.long_description ?? "") ||
    internalNotes !== (initial.internal_notes ?? "") ||
    threadSize !== (initial.thread_size ?? "") ||
    length !== (initial.length ?? "") ||
    material !== (initial.material ?? "") ||
    finish !== (initial.finish ?? "") ||
    grade !== (initial.grade ?? "") ||
    headType !== (initial.head_type ?? "") ||
    productFamily !== (initial.product_family ?? "");

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const result = await updatePart({
        id: initial.id,
        internal_pn: pn,
        short_description: shortDescription || null,
        long_description: longDescription || null,
        internal_notes: internalNotes || null,
        thread_size: threadSize || null,
        length: length || null,
        material: material || null,
        finish: finish || null,
        grade: grade || null,
        head_type: headType || null,
        product_family: productFamily || null,
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
        <Label htmlFor="pn">SKU *</Label>
        <Input
          id="pn"
          value={pn}
          onChange={(e) => setPn(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="short-desc">Short description</Label>
        <Input
          id="short-desc"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="long-desc">Long description</Label>
        <Textarea
          id="long-desc"
          rows={3}
          value={longDescription}
          onChange={(e) => setLongDescription(e.target.value)}
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

      {/* Specifications */}
      <fieldset className="space-y-2 border rounded-md p-4">
        <legend className="text-sm font-semibold px-1">Specifications</legend>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1">
            <Label htmlFor="thread_size">Thread size</Label>
            <Input
              id="thread_size"
              value={threadSize}
              onChange={(e) => setThreadSize(e.target.value)}
              placeholder="#10-32"
              maxLength={120}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="length">Length</Label>
            <Input
              id="length"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder={'3/4"'}
              maxLength={120}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="material">Material</Label>
            <Input
              id="material"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="18-8 SS"
              maxLength={120}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="finish">Finish</Label>
            <Input
              id="finish"
              value={finish}
              onChange={(e) => setFinish(e.target.value)}
              placeholder="zinc"
              maxLength={120}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="grade">Grade</Label>
            <Input
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Grade 8"
              maxLength={120}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="head_type">Head type</Label>
            <Input
              id="head_type"
              value={headType}
              onChange={(e) => setHeadType(e.target.value)}
              placeholder="hex"
              maxLength={120}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="product_family">Product family</Label>
            <Input
              id="product_family"
              value={productFamily}
              onChange={(e) => setProductFamily(e.target.value)}
              placeholder="HCS"
              maxLength={120}
            />
          </div>
        </div>
      </fieldset>

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
