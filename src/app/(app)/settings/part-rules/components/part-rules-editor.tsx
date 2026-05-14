"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  PartFamily,
  PartSize,
  PartThread,
  PartAttribute,
} from "@/lib/part-naming";
import {
  saveFamily,
  deleteFamily,
  saveSize,
  deleteSize,
  saveThread,
  deleteThread,
  saveAttribute,
  deleteAttribute,
} from "../actions";

type Props = {
  families: PartFamily[];
  sizes: PartSize[];
  threads: PartThread[];
  attributes: PartAttribute[];
};

export function PartRulesEditor({
  families,
  sizes,
  threads,
  attributes,
}: Props) {
  return (
    <div className="space-y-6">
      <FamiliesCard families={families} />
      <SizesCard sizes={sizes} />
      <ThreadsCard threads={threads} />
      <AttributesCard attributes={attributes} />
    </div>
  );
}

// ─── Section shell ─────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="px-5 py-4 border-b">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="divide-y">{children}</div>
    </section>
  );
}

function ConfirmDeleteButton({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (armed) onDelete();
        else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
      title={armed ? "Click again to confirm" : "Delete"}
      className={cn(
        "size-8 rounded-md grid place-items-center transition-colors",
        armed
          ? "bg-destructive text-destructive-foreground"
          : "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
      )}
      aria-label={armed ? "Confirm delete" : "Delete"}
    >
      {armed ? (
        <Check className="size-4" />
      ) : (
        <Trash2 className="size-4" />
      )}
    </button>
  );
}

// ─── Families ──────────────────────────────────────────────────────────

function FamiliesCard({ families }: { families: PartFamily[] }) {
  return (
    <SectionCard
      title="Families"
      subtitle="Product family prefixes (e.g. HCS = Hex Cap Screw). Toggle whether the family requires a thread / length code in the part number."
    >
      <AddFamilyRow />
      {families.map((f) => (
        <FamilyRow key={f.id} family={f} />
      ))}
    </SectionCard>
  );
}

function AddFamilyRow() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [thread, setThread] = useState(true);
  const [length, setLength] = useState(true);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCode("");
    setName("");
    setThread(true);
    setLength(true);
  }

  function add() {
    if (!code.trim() || !name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    startTransition(async () => {
      const res = await saveFamily({
        code,
        name,
        requires_thread: thread,
        requires_length: length,
        notes: "",
        display_order: 999,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Family added");
      reset();
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-[110px_1fr_auto_auto_auto] gap-2 items-end bg-muted/20">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="HCS"
        className="h-9 font-mono uppercase"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Hex Cap Screw"
        className="h-9"
      />
      <ToggleChip label="Thread" value={thread} onChange={setThread} />
      <ToggleChip label="Length" value={length} onChange={setLength} />
      <Button
        type="button"
        size="sm"
        onClick={add}
        disabled={pending}
        className="rounded-full"
      >
        <Plus className="size-3.5 mr-1" />
        Add
      </Button>
    </div>
  );
}

function FamilyRow({ family }: { family: PartFamily }) {
  const router = useRouter();
  const [code, setCode] = useState(family.code);
  const [name, setName] = useState(family.name);
  const [thread, setThread] = useState(family.requires_thread);
  const [length, setLength] = useState(family.requires_length);
  const [pending, startTransition] = useTransition();

  const dirty =
    code !== family.code ||
    name !== family.name ||
    thread !== family.requires_thread ||
    length !== family.requires_length;

  function save() {
    startTransition(async () => {
      const res = await saveFamily({
        id: family.id,
        code,
        name,
        requires_thread: thread,
        requires_length: length,
        notes: family.notes ?? "",
        display_order: 999,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteFamily(family.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Removed ${family.code}`);
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-[110px_1fr_auto_auto_auto_auto] gap-2 items-center">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="h-9 font-mono uppercase"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9"
      />
      <ToggleChip label="Thread" value={thread} onChange={setThread} />
      <ToggleChip label="Length" value={length} onChange={setLength} />
      <Button
        type="button"
        size="sm"
        variant={dirty ? "default" : "outline"}
        onClick={save}
        disabled={pending || !dirty}
        className="rounded-full"
      >
        Save
      </Button>
      <ConfirmDeleteButton onDelete={remove} />
    </div>
  );
}

function ToggleChip({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        value
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground hover:bg-muted",
      )}
      aria-pressed={value}
    >
      <span className={cn("size-1.5 rounded-full", value ? "bg-primary-foreground" : "bg-muted-foreground")} />
      {label}
    </button>
  );
}

// ─── Sizes ─────────────────────────────────────────────────────────────

function SizesCard({ sizes }: { sizes: PartSize[] }) {
  return (
    <SectionCard
      title="Sizes"
      subtitle="Diameter codes — imperial (04 = 1/4″, 000 = #2) or metric (M6, M8)."
    >
      <AddSizeRow />
      {sizes.map((s) => (
        <SizeRow key={s.id} size={s} />
      ))}
    </SectionCard>
  );
}

function AddSizeRow() {
  const router = useRouter();
  const [system, setSystem] = useState<"imperial" | "metric">("imperial");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [diameter, setDiameter] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setCode("");
    setLabel("");
    setDiameter("");
  }

  function add() {
    if (!code.trim() || !label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    startTransition(async () => {
      const res = await saveSize({
        system,
        code,
        label,
        diameter_inches: diameter ? Number(diameter) : null,
        display_order: 999,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Size added");
      reset();
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-[120px_120px_1fr_120px_auto] gap-2 items-end bg-muted/20">
      <div>
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
          System
        </Label>
        <Select
          value={system}
          onValueChange={(v) => setSystem((v as "imperial" | "metric") ?? "imperial")}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="imperial">Imperial</SelectItem>
            <SelectItem value="metric">Metric</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={system === "imperial" ? "04" : "M6"}
        className="h-9 font-mono"
      />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={system === "imperial" ? "1/4\"" : "M6"}
        className="h-9"
      />
      <Input
        value={diameter}
        onChange={(e) => setDiameter(e.target.value)}
        placeholder="dia (in)"
        type="number"
        step="0.001"
        className="h-9 tabular-nums"
      />
      <Button
        type="button"
        size="sm"
        onClick={add}
        disabled={pending}
        className="rounded-full"
      >
        <Plus className="size-3.5 mr-1" />
        Add
      </Button>
    </div>
  );
}

function SizeRow({ size }: { size: PartSize }) {
  const router = useRouter();
  const [code, setCode] = useState(size.code);
  const [label, setLabel] = useState(size.label);
  const [diameter, setDiameter] = useState(
    size.diameter_inches != null ? String(size.diameter_inches) : "",
  );
  const [pending, startTransition] = useTransition();

  const dirty =
    code !== size.code ||
    label !== size.label ||
    diameter !== (size.diameter_inches != null ? String(size.diameter_inches) : "");

  function save() {
    startTransition(async () => {
      const res = await saveSize({
        id: size.id,
        system: size.system,
        code,
        label,
        diameter_inches: diameter ? Number(diameter) : null,
        display_order: 999,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteSize(size.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Removed ${size.code}`);
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-2.5 grid grid-cols-2 md:grid-cols-[120px_120px_1fr_120px_auto_auto] gap-2 items-center">
      <span className="text-xs tracking-wider uppercase text-muted-foreground">
        {size.system}
      </span>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="h-9 font-mono"
      />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-9"
      />
      <Input
        value={diameter}
        onChange={(e) => setDiameter(e.target.value)}
        type="number"
        step="0.001"
        className="h-9 tabular-nums"
      />
      <Button
        type="button"
        size="sm"
        variant={dirty ? "default" : "outline"}
        onClick={save}
        disabled={pending || !dirty}
        className="rounded-full"
      >
        Save
      </Button>
      <ConfirmDeleteButton onDelete={remove} />
    </div>
  );
}

// ─── Threads ───────────────────────────────────────────────────────────

function ThreadsCard({ threads }: { threads: PartThread[] }) {
  return (
    <SectionCard
      title="Threads"
      subtitle="Thread codes appended to the size code (e.g. C = coarse → 04C)."
    >
      <AddThreadRow />
      {threads.map((t) => (
        <ThreadRow key={t.id} thread={t} />
      ))}
    </SectionCard>
  );
}

function AddThreadRow() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!code.trim() || !label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    startTransition(async () => {
      const res = await saveThread({ code, label, display_order: 999 });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Thread added");
      setCode("");
      setLabel("");
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 items-end bg-muted/20">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="C"
        className="h-9 font-mono uppercase"
      />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Coarse"
        className="h-9"
      />
      <Button
        type="button"
        size="sm"
        onClick={add}
        disabled={pending}
        className="rounded-full"
      >
        <Plus className="size-3.5 mr-1" />
        Add
      </Button>
    </div>
  );
}

function ThreadRow({ thread }: { thread: PartThread }) {
  const router = useRouter();
  const [code, setCode] = useState(thread.code);
  const [label, setLabel] = useState(thread.label);
  const [pending, startTransition] = useTransition();
  const dirty = code !== thread.code || label !== thread.label;

  function save() {
    startTransition(async () => {
      const res = await saveThread({
        id: thread.id,
        code,
        label,
        display_order: 999,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteThread(thread.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Removed ${thread.code}`);
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-[120px_1fr_auto_auto] gap-2 items-center">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="h-9 font-mono uppercase"
      />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-9"
      />
      <Button
        type="button"
        size="sm"
        variant={dirty ? "default" : "outline"}
        onClick={save}
        disabled={pending || !dirty}
        className="rounded-full"
      >
        Save
      </Button>
      <ConfirmDeleteButton onDelete={remove} />
    </div>
  );
}

// ─── Attributes ────────────────────────────────────────────────────────

function AttributesCard({ attributes }: { attributes: PartAttribute[] }) {
  return (
    <SectionCard
      title="Attributes"
      subtitle="Trailing codes for grade / finish / material — e.g. G8Y = Grade 8 Yellow Zinc."
    >
      <AddAttributeRow />
      {attributes.map((a) => (
        <AttributeRow key={a.id} attribute={a} />
      ))}
    </SectionCard>
  );
}

function AddAttributeRow() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<PartAttribute["kind"]>("combo");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!code.trim() || !label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    startTransition(async () => {
      const res = await saveAttribute({
        code,
        label,
        kind,
        display_order: 999,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Attribute added");
      setCode("");
      setLabel("");
      setKind("combo");
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-[120px_1fr_140px_auto] gap-2 items-end bg-muted/20">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="G8Y"
        className="h-9 font-mono uppercase"
      />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Grade 8 Yellow Zinc"
        className="h-9"
      />
      <Select
        value={kind}
        onValueChange={(v) => setKind((v as PartAttribute["kind"]) ?? "combo")}
      >
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="grade">Grade</SelectItem>
          <SelectItem value="finish">Finish</SelectItem>
          <SelectItem value="material">Material</SelectItem>
          <SelectItem value="combo">Combo</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        onClick={add}
        disabled={pending}
        className="rounded-full"
      >
        <Plus className="size-3.5 mr-1" />
        Add
      </Button>
    </div>
  );
}

function AttributeRow({ attribute }: { attribute: PartAttribute }) {
  const router = useRouter();
  const [code, setCode] = useState(attribute.code);
  const [label, setLabel] = useState(attribute.label);
  const [kind, setKind] = useState<PartAttribute["kind"]>(attribute.kind);
  const [pending, startTransition] = useTransition();
  const dirty =
    code !== attribute.code ||
    label !== attribute.label ||
    kind !== attribute.kind;

  function save() {
    startTransition(async () => {
      const res = await saveAttribute({
        id: attribute.id,
        code,
        label,
        kind,
        display_order: 999,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteAttribute(attribute.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Removed ${attribute.code}`);
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-[120px_1fr_140px_auto_auto] gap-2 items-center">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="h-9 font-mono uppercase"
      />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-9"
      />
      <Select
        value={kind}
        onValueChange={(v) => setKind((v as PartAttribute["kind"]) ?? "combo")}
      >
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="grade">Grade</SelectItem>
          <SelectItem value="finish">Finish</SelectItem>
          <SelectItem value="material">Material</SelectItem>
          <SelectItem value="combo">Combo</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant={dirty ? "default" : "outline"}
        onClick={save}
        disabled={pending || !dirty}
        className="rounded-full"
      >
        Save
      </Button>
      <ConfirmDeleteButton onDelete={remove} />
    </div>
  );
}
