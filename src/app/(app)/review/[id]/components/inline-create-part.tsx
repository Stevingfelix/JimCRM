"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPartWithAlias } from "@/app/(app)/parts/actions";

type Props = {
  aliasPn: string;
  suggestedDescription: string;
  aliasSourceType: "customer" | "vendor";
  aliasSourceName: string | null;
  suggestedThreadSize?: string | null;
  suggestedLength?: string | null;
  suggestedMaterial?: string | null;
  suggestedFinish?: string | null;
  suggestedGrade?: string | null;
  onCreated: (part: {
    id: string;
    internal_pn: string;
    short_description: string | null;
  }) => void;
};

export function InlineCreatePart({
  aliasPn,
  suggestedDescription,
  aliasSourceType,
  aliasSourceName,
  suggestedThreadSize,
  suggestedLength,
  suggestedMaterial,
  suggestedFinish,
  suggestedGrade,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [internalPn, setInternalPn] = useState("");
  // Strip qty + PN from suggested description — use only the descriptive text
  const cleanDescription = suggestedDescription
    .replace(/^\d[\d,]*\s*/, "") // leading qty
    .replace(new RegExp(`^${aliasPn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "") // leading PN
    .trim();
  const [description, setDescription] = useState(cleanDescription);
  const [threadSize, setThreadSize] = useState(suggestedThreadSize ?? "");
  const [length, setLength] = useState(suggestedLength ?? "");
  const [material, setMaterial] = useState(suggestedMaterial ?? "");
  const [finish, setFinish] = useState(suggestedFinish ?? "");
  const [grade, setGrade] = useState(suggestedGrade ?? "");
  const [pending, startTransition] = useTransition();

  function reset() {
    setOpen(false);
    setInternalPn("");
    setDescription(cleanDescription);
    setThreadSize(suggestedThreadSize ?? "");
    setLength(suggestedLength ?? "");
    setMaterial(suggestedMaterial ?? "");
    setFinish(suggestedFinish ?? "");
    setGrade(suggestedGrade ?? "");
  }

  function handleSave() {
    if (!internalPn.trim()) {
      toast.error("Enter a CAP SKU");
      return;
    }
    startTransition(async () => {
      const res = await createPartWithAlias({
        internal_pn: internalPn.trim(),
        short_description: description.trim() || null,
        alias_pn: aliasPn,
        alias_source_type: aliasSourceType,
        alias_source_name: aliasSourceName ?? null,
        thread_size: threadSize.trim() || null,
        length: length.trim() || null,
        material: material.trim() || null,
        finish: finish.trim() || null,
        grade: grade.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      onCreated({
        id: res.data.id,
        internal_pn: res.data.internal_pn,
        short_description: description.trim() || null,
      });
      toast.success(`Created ${res.data.internal_pn} (alias: ${aliasPn})`);
      reset();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-primary hover:underline"
      >
        <Sparkles className="size-3" />
        Create CAP part + add &ldquo;{aliasPn}&rdquo; as alias
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Create new CAP part</DialogTitle>
            <p className="text-sm text-muted-foreground">
              The external PN <code className="font-mono text-foreground">{aliasPn}</code> will
              be saved as an alias so future RFQs auto-match.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* SKU */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">CAP SKU</Label>
              <div className="flex gap-2">
                <Input
                  value={internalPn}
                  onChange={(e) => setInternalPn(e.target.value)}
                  placeholder="e.g. HCS 04C-0750G8Y"
                  className="font-mono"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInternalPn(aliasPn)}
                  className="shrink-0 text-xs"
                >
                  Use alias as SKU
                </Button>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Locking helical insert"
              />
            </div>

            {/* Specs grid */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Specifications (parsed from email)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">Thread</div>
                  <Input
                    value={threadSize}
                    onChange={(e) => setThreadSize(e.target.value)}
                    placeholder="#10-32"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">Length</div>
                  <Input
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder='.380"'
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">Material</div>
                  <Input
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="18-8 SS"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">Finish</div>
                  <Input
                    value={finish}
                    onChange={(e) => setFinish(e.target.value)}
                    placeholder="zinc"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">Grade</div>
                  <Input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="Grade 8"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={reset}
              disabled={pending}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={pending || !internalPn.trim()}
              className="rounded-full"
            >
              {pending ? "Creating..." : "Create part"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
