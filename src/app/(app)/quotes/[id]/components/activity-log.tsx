import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

type QuoteEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  performed_by: string | null;
  created_at: string;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function describe(ev: QuoteEvent): {
  title: string;
  detail: string | null;
} {
  const d = ev.event_data ?? {};
  switch (ev.event_type) {
    case "status_change": {
      const from = (d.from as string) ?? "?";
      const to = (d.to as string) ?? "?";
      const reason = (d.outcome_reason as string | null) ?? null;
      return {
        title: `Status: ${from} → ${to}`,
        detail: reason ? `Reason: ${reason}` : null,
      };
    }
    case "line_created": {
      const qty = d.qty as number | null;
      const price = d.unit_price as number | null;
      return {
        title: "Line added",
        detail: `qty ${qty ?? "—"} · ${formatMoney(price)}`,
      };
    }
    case "line_updated": {
      const changes = (d.changes as Record<string, [unknown, unknown]>) ?? {};
      const bits: string[] = [];
      for (const [field, [oldV, newV]] of Object.entries(changes)) {
        if (field === "unit_price") {
          bits.push(
            `${field}: ${formatMoney(oldV as number | null)} → ${formatMoney(newV as number | null)}`,
          );
        } else {
          bits.push(`${field}: ${oldV ?? "—"} → ${newV ?? "—"}`);
        }
      }
      return {
        title: "Line updated",
        detail: bits.join(" · ") || null,
      };
    }
    case "line_deleted":
      return {
        title: "Line removed",
        detail: `qty ${d.qty ?? "—"} · ${formatMoney((d.unit_price as number | null) ?? null)}`,
      };
    default:
      return { title: ev.event_type, detail: null };
  }
}

export async function ActivityLog({ quoteId }: { quoteId: string }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("quote_events")
    .select("id, event_type, event_data, performed_by, created_at")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(50);

  const events = (data ?? []) as unknown as QuoteEvent[];

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No activity yet — events from this quote will show up here.
      </p>
    );
  }

  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors">
        <div className="text-sm">
          <span className="font-medium">Activity</span>
          <span className="text-muted-foreground ml-2">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </div>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90 [details[open]_&]:rotate-90" />
      </summary>
      <ul className="divide-y border-t">
        {events.map((ev) => {
          const desc = describe(ev);
          return (
            <li key={ev.id} className="px-4 py-2.5 flex items-start gap-3 text-sm">
              <div className="size-1.5 rounded-full bg-brand-gradient mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{desc.title}</div>
                {desc.detail && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {desc.detail}
                  </div>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {timeAgo(ev.created_at)}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
