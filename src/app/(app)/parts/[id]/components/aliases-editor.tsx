"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addAlias, deleteAlias, updateAlias } from "../actions";

type SourceType = "customer" | "manufacturer" | "vendor" | "other";

type Alias = {
  id: string;
  alias_pn: string;
  source_type: SourceType | null;
  source_name: string | null;
};

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "customer", label: "customer" },
  { value: "manufacturer", label: "manufacturer" },
  { value: "vendor", label: "vendor" },
  { value: "other", label: "other" },
];

export function AliasesEditor({
  partId,
  initial,
}: {
  partId: string;
  initial: Alias[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<{
    alias_pn: string;
    source_type: SourceType | "";
    source_name: string;
  }>({ alias_pn: "", source_type: "", source_name: "" });
  const [pending, startTransition] = useTransition();

  const addDisabled = !draft.alias_pn.trim() || pending;

  const onAdd = () => {
    if (addDisabled) return;
    startTransition(async () => {
      const result = await addAlias({
        part_id: partId,
        alias_pn: draft.alias_pn,
        source_type: draft.source_type || null,
        source_name: draft.source_name || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setDraft({ alias_pn: "", source_type: "", source_name: "" });
      router.refresh();
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px]">Alias PN</TableHead>
            <TableHead className="w-[180px]">Source type</TableHead>
            <TableHead>Source name</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {initial.map((alias) => (
            <AliasRow key={alias.id} partId={partId} alias={alias} />
          ))}
          <TableRow>
            <TableCell>
              <Input
                placeholder="add alias…"
                value={draft.alias_pn}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, alias_pn: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAdd();
                  }
                }}
                className="h-8"
              />
            </TableCell>
            <TableCell>
              <Select
                value={draft.source_type || undefined}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, source_type: v as SourceType }))
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Input
                placeholder="optional"
                value={draft.source_name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, source_name: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAdd();
                  }
                }}
                className="h-8"
              />
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="ghost"
                onClick={onAdd}
                disabled={addDisabled}
              >
                add
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function AliasRow({ partId, alias }: { partId: string; alias: Alias }) {
  const router = useRouter();
  const [aliasPn, setAliasPn] = useState(alias.alias_pn);
  const [sourceType, setSourceType] = useState<SourceType | null>(
    alias.source_type,
  );
  const [sourceName, setSourceName] = useState(alias.source_name ?? "");
  const [pending, startTransition] = useTransition();

  const dirty =
    aliasPn !== alias.alias_pn ||
    sourceType !== alias.source_type ||
    sourceName !== (alias.source_name ?? "");

  const persist = () => {
    if (!dirty || !aliasPn.trim()) return;
    startTransition(async () => {
      const result = await updateAlias({
        id: alias.id,
        part_id: partId,
        alias_pn: aliasPn,
        source_type: sourceType,
        source_name: sourceName || null,
      });
      if (!result.ok) toast.error(result.error.message);
      else router.refresh();
    });
  };

  const remove = () => {
    if (!confirm(`Remove alias "${alias.alias_pn}"?`)) return;
    startTransition(async () => {
      const result = await deleteAlias({ id: alias.id, part_id: partId });
      if (!result.ok) toast.error(result.error.message);
      else router.refresh();
    });
  };

  return (
    <TableRow>
      <TableCell>
        <Input
          value={aliasPn}
          onChange={(e) => setAliasPn(e.target.value)}
          onBlur={persist}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Select
          value={sourceType ?? undefined}
          onValueChange={(v) => {
            setSourceType(v as SourceType);
            setTimeout(persist, 0);
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          onBlur={persist}
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="ghost"
          onClick={remove}
          disabled={pending}
        >
          ×
        </Button>
      </TableCell>
    </TableRow>
  );
}
