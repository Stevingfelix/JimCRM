"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateVendor } from "../../actions";

type Props = {
  initial: {
    id: string;
    name: string;
    categories: string[];
    notes: string | null;
  };
};

export function VendorForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [pending, startTransition] = useTransition();

  const dirty =
    name !== initial.name ||
    notes !== (initial.notes ?? "") ||
    categories.length !== initial.categories.length ||
    categories.some((c, i) => c !== initial.categories[i]);

  const addCategory = () => {
    const v = categoryDraft.trim().toLowerCase();
    if (!v) return;
    if (categories.includes(v)) {
      setCategoryDraft("");
      return;
    }
    setCategories([...categories, v]);
    setCategoryDraft("");
  };

  const removeCategory = (c: string) => {
    setCategories(categories.filter((x) => x !== c));
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateVendor({
        id: initial.id,
        name,
        categories,
        notes: notes || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Categories</Label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border p-2 min-h-9">
          {categories.length === 0 && categoryDraft === "" && (
            <span className="text-sm text-muted-foreground px-1">
              (none — add tags below)
            </span>
          )}
          {categories.map((c) => (
            <Badge
              key={c}
              variant="secondary"
              className="font-normal cursor-default"
            >
              {c}
              <button
                type="button"
                onClick={() => removeCategory(c)}
                className="ml-1.5 text-muted-foreground hover:text-foreground"
                aria-label={`remove ${c}`}
              >
                ×
              </button>
            </Badge>
          ))}
          <Input
            value={categoryDraft}
            onChange={(e) => setCategoryDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addCategory();
              } else if (
                e.key === "Backspace" &&
                categoryDraft === "" &&
                categories.length > 0
              ) {
                setCategories(categories.slice(0, -1));
              }
            }}
            onBlur={addCategory}
            placeholder={categories.length === 0 ? "" : "+ add"}
            className="h-7 border-0 shadow-none focus-visible:ring-0 px-1 flex-1 min-w-[80px]"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
