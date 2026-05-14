import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
  unitSingular?: string;
  unitPlural?: string;
};

// Shared footer for list cards (Quotes / Parts / Customers / Vendors / etc).
// Renders inside the card, separated by a top border, with the "Showing X to
// Y of Z results" count on the left and Previous / Next pills on the right.
//
// Server-component-friendly: it uses Link with prebuilt hrefs from the
// caller, so no client state is needed.
export function ListFooter({
  page,
  pageSize,
  total,
  buildHref,
  unitSingular = "result",
  unitPlural = "results",
}: Props) {
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const noPrev = page <= 1;
  const noNext = page >= totalPages;
  const unit = total === 1 ? unitSingular : unitPlural;

  return (
    <div className="flex items-center justify-between gap-3 px-6 sm:px-8 py-5 border-t border-foreground/[0.06]">
      <span className="text-sm text-muted-foreground">
        {total === 0 ? (
          `0 ${unit}`
        ) : (
          <>
            Showing{" "}
            <strong className="text-foreground font-medium">
              {firstShown}
            </strong>{" "}
            to{" "}
            <strong className="text-foreground font-medium">{lastShown}</strong>{" "}
            of{" "}
            <strong className="text-foreground font-medium">
              {total.toLocaleString()}
            </strong>{" "}
            {unit}
          </>
        )}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={noPrev ? "#" : buildHref(Math.max(1, page - 1))}
          aria-disabled={noPrev}
          className={cn(
            "inline-flex h-9 items-center rounded-full border border-foreground/10 px-4 text-sm transition-colors",
            noPrev
              ? "pointer-events-none text-muted-foreground/60 opacity-60"
              : "hover:bg-muted text-foreground/80",
          )}
        >
          Previous
        </Link>
        <Link
          href={noNext ? "#" : buildHref(Math.min(totalPages, page + 1))}
          aria-disabled={noNext}
          className={cn(
            "inline-flex h-9 items-center rounded-full border border-foreground/10 px-4 text-sm transition-colors",
            noNext
              ? "pointer-events-none text-muted-foreground/60 opacity-60"
              : "hover:bg-muted text-foreground/80",
          )}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
