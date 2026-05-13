"use client";

import { useState } from "react";
import Link from "next/link";
import { getPartHistoryAction } from "../../lookups";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import type { PartHistoryRow, VendorRecommendation } from "../../queries";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ready";
      history: PartHistoryRow[];
      latest_vendor: VendorRecommendation | null;
    };

export function LineHistoryPopover({ partId }: { partId: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [open, setOpen] = useState(false);

  const onShow = async () => {
    setOpen(true);
    if (state.kind === "ready" || state.kind === "loading") return;
    setState({ kind: "loading" });
    const data = await getPartHistoryAction(partId);
    setState({
      kind: "ready",
      history: data.history,
      latest_vendor: data.latest_vendor,
    });
  };

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={onShow}
        onMouseLeave={() => setOpen(false)}
        onFocus={onShow}
        onBlur={() => setOpen(false)}
        className="text-xs text-muted-foreground hover:text-foreground rounded-full px-1.5 py-0.5 border ml-1"
        aria-label="Show part history"
      >
        ⓘ
      </button>
      {open && (
        <div className="absolute z-40 top-full left-0 mt-1 w-[440px] rounded-md border bg-popover shadow-md p-3 text-xs">
          {state.kind !== "ready" ? (
            <div className="text-muted-foreground py-2 text-center">
              Loading…
            </div>
          ) : (
            <>
              <div className="font-medium mb-1.5 text-foreground">
                Last 5 quotes
              </div>
              {state.history.length === 0 ? (
                <div className="text-muted-foreground py-1">
                  No prior quotes for this part.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left font-normal py-0.5 pr-2">
                        Date
                      </th>
                      <th className="text-left font-normal py-0.5 pr-2">
                        Customer
                      </th>
                      <th className="text-right font-normal py-0.5 pr-2">
                        Qty
                      </th>
                      <th className="text-right font-normal py-0.5 pr-2">
                        Price
                      </th>
                      <th className="text-right font-normal py-0.5">Q#</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.history.map((h) => (
                      <tr key={h.quote_line_id}>
                        <td className="tabular-nums pr-2">
                          {formatDate(h.created_at)}
                        </td>
                        <td className="truncate max-w-[140px] pr-2">
                          {h.customer_name}
                        </td>
                        <td className="text-right tabular-nums pr-2">
                          {h.qty}
                        </td>
                        <td className="text-right tabular-nums pr-2">
                          {formatMoney(h.unit_price)}
                        </td>
                        <td className="text-right tabular-nums">
                          <Link
                            href={`/quotes/${h.quote_id}`}
                            className="hover:underline text-muted-foreground"
                          >
                            {formatQuoteNumber(h.quote_number)}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {state.latest_vendor && (
                <div className="mt-2 pt-2 border-t text-muted-foreground">
                  Vendor cost (latest):{" "}
                  <span className="text-foreground font-medium">
                    {state.latest_vendor.vendor_name}
                  </span>{" "}
                  {formatMoney(state.latest_vendor.unit_price)}
                  {state.latest_vendor.lead_time_days != null && (
                    <> · {state.latest_vendor.lead_time_days}d lead</>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </span>
  );
}
