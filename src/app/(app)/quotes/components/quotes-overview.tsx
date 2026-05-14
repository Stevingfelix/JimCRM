import { Send, Clock, Trophy } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { QuotesOverview } from "../queries";

type Props = { overview: QuotesOverview };

export function QuotesOverviewTiles({ overview }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Tile
        icon={<Send className="size-4" />}
        label="Open"
        amount={formatMoney(overview.open.value)}
        subline={
          overview.open.count === 0
            ? "No quotes awaiting reply"
            : `${overview.open.count} quote${overview.open.count === 1 ? "" : "s"} sent, awaiting reply`
        }
        tone="default"
      />
      <Tile
        icon={<Clock className="size-4" />}
        label="Expiring within 7 days"
        amount={formatMoney(overview.expiring_soon.value)}
        subline={
          overview.expiring_soon.count === 0
            ? "Nothing about to expire"
            : `${overview.expiring_soon.count} quote${overview.expiring_soon.count === 1 ? "" : "s"} with deadline approaching`
        }
        tone={overview.expiring_soon.count > 0 ? "warning" : "default"}
      />
      <Tile
        icon={<Trophy className="size-4" />}
        label="Won (last 30 days)"
        amount={formatMoney(overview.won_30d.value)}
        subline={
          overview.won_30d.count === 0
            ? "No wins in period"
            : `${overview.won_30d.count} quote${overview.won_30d.count === 1 ? "" : "s"} converted`
        }
        tone={overview.won_30d.count > 0 ? "success" : "default"}
      />
    </div>
  );
}

function Tile({
  icon,
  label,
  amount,
  subline,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  amount: string;
  subline: string;
  tone: "default" | "warning" | "success";
}) {
  const iconCls =
    tone === "warning"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "success"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-muted text-muted-foreground border-transparent";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground tracking-wide font-medium uppercase">
          {label}
        </div>
        <div
          className={`inline-flex items-center justify-center size-7 rounded-lg border ${iconCls}`}
        >
          {icon}
        </div>
      </div>
      <div className="text-3xl font-semibold tabular-nums mt-3 tracking-tight">
        {amount}
      </div>
      <div className="text-xs text-muted-foreground mt-1.5">{subline}</div>
    </div>
  );
}
