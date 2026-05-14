"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  commitPartsImport,
  parsePartsCsv,
  type ImportRowPreview,
} from "../actions";

export function ImportClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportRowPreview[] | null>(null);
  const [parsing, startParse] = useTransition();
  const [committing, startCommit] = useTransition();

  const readableRows = preview?.filter((r) => r.status === "ready") ?? [];
  const dupeRows = preview?.filter((r) => r.status === "duplicate") ?? [];
  const errorRows = preview?.filter((r) => r.status === "error") ?? [];

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsv(text);
      onParse(text);
    };
    reader.readAsText(file);
  };

  const onParse = (text: string = csv) => {
    if (!text.trim()) {
      toast.error("Paste a CSV or upload a file first");
      return;
    }
    startParse(async () => {
      const result = await parsePartsCsv(text);
      if (!result.ok) {
        toast.error(result.error.message);
        setPreview(null);
        return;
      }
      setPreview(result.data.rows);
    });
  };

  const onCommit = () => {
    if (readableRows.length === 0) return;
    startCommit(async () => {
      const result = await commitPartsImport({
        rows: readableRows.map((r) => ({
          internal_pn: r.internal_pn,
          description: r.description,
          internal_notes: r.internal_notes,
          aliases: r.aliases,
        })),
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        `Imported ${result.data.created} part${result.data.created === 1 ? "" : "s"}`,
      );
      router.push("/parts");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
        >
          Upload .csv
        </Button>
        <span className="text-xs text-muted-foreground">
          or paste the file contents below
        </span>
      </div>

      <Textarea
        rows={10}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder="internal_pn,description,internal_notes,aliases
CAP-2210,1/4-20 SHCS,,
…"
        className="font-mono text-xs"
      />

      <div className="flex items-center gap-2">
        <Button onClick={() => onParse()} disabled={parsing || !csv.trim()}>
          {parsing ? "Parsing…" : "Preview"}
        </Button>
        {preview && (
          <Button
            variant="outline"
            onClick={() => {
              setPreview(null);
              setCsv("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-emerald-700 font-medium">
              {readableRows.length} ready
            </span>
            {dupeRows.length > 0 && (
              <span className="text-amber-700">
                · {dupeRows.length} duplicate{dupeRows.length === 1 ? "" : "s"}
              </span>
            )}
            {errorRows.length > 0 && (
              <span className="text-rose-700">
                · {errorRows.length} error{errorRows.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 w-12">#</th>
                  <th className="px-3 py-2">Internal PN</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Aliases</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.map((r) => (
                  <tr
                    key={r.row_number}
                    className={cn(
                      r.status === "duplicate" && "bg-amber-50/50",
                      r.status === "error" && "bg-rose-50/50",
                    )}
                  >
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {r.row_number}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.internal_pn}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[300px]">
                      {r.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.aliases.length === 0
                        ? "—"
                        : r.aliases.map((a) => a.alias_pn).join(", ")}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.status === "ready" && (
                        <span className="text-emerald-700">ready</span>
                      )}
                      {r.status === "duplicate" && (
                        <span className="text-amber-700">
                          dup — {r.error}
                        </span>
                      )}
                      {r.status === "error" && (
                        <span className="text-rose-700">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={onCommit}
              disabled={committing || readableRows.length === 0}
              className="h-11 rounded-full px-6"
            >
              {committing
                ? "Importing…"
                : `Import ${readableRows.length} part${readableRows.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
