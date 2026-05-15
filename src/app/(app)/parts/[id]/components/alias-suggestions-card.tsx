"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  acceptAliasSuggestion,
  dismissAliasSuggestion,
} from "../actions";

export type PendingSuggestion = {
  id: string;
  alias_pn: string;
  source_type: string | null;
  source_name: string | null;
  raw_text: string | null;
  reasoning: string | null;
  created_at: string;
};

export function AliasSuggestionsCard({
  partId,
  suggestions,
}: {
  partId: string;
  suggestions: PendingSuggestion[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-900 flex items-center gap-2">
        <Sparkles className="size-4 text-amber-700 dark:text-amber-300" />
        <h3 className="text-sm font-medium">
          Suggested aliases
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            ({suggestions.length} pending — captured when you committed a
            quote where the AI&apos;s PN guess didn&apos;t match this part)
          </span>
        </h3>
      </div>
      <ul className="divide-y divide-amber-200 dark:divide-amber-900">
        {suggestions.map((s) => (
          <SuggestionRow key={s.id} partId={partId} suggestion={s} />
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({
  partId,
  suggestion,
}: {
  partId: string;
  suggestion: PendingSuggestion;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onAccept = () => {
    startTransition(async () => {
      const result = await acceptAliasSuggestion({
        id: suggestion.id,
        part_id: partId,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Added "${suggestion.alias_pn}" as an alias`);
      router.refresh();
    });
  };

  const onDismiss = () => {
    startTransition(async () => {
      const result = await dismissAliasSuggestion({
        id: suggestion.id,
        part_id: partId,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Suggestion dismissed");
      router.refresh();
    });
  };

  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm tabular-nums">
          {suggestion.alias_pn}
          {suggestion.source_type && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              · {suggestion.source_type}
            </span>
          )}
        </div>
        {suggestion.raw_text && (
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            from: <span className="italic">&ldquo;{suggestion.raw_text}&rdquo;</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onAccept}
          disabled={pending}
          className="gap-1"
        >
          <Check className="size-3.5" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          disabled={pending}
          className="gap-1 text-muted-foreground"
        >
          <X className="size-3.5" />
          Dismiss
        </Button>
      </div>
    </li>
  );
}
