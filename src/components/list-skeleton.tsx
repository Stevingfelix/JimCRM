import { Skeleton } from "@/components/ui/skeleton";

// Reusable skeleton for list pages (Parts / Customers / Vendors / Quotes).
export function ListPageSkeleton({
  title,
  columnCount = 4,
  rowCount = 8,
}: {
  title: string;
  columnCount?: number;
  rowCount?: number;
}) {
  return (
    <div className="px-8 py-8 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>

      <Skeleton className="h-11 w-full max-w-md rounded-xl" />

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-4 py-3 flex gap-4">
          {Array.from({ length: columnCount }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className="border-b last:border-0 px-4 py-3 flex gap-4 items-center"
          >
            {Array.from({ length: columnCount }).map((__, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Reusable skeleton for detail pages (Part / Customer / Vendor / Quote).
export function DetailPageSkeleton({
  sectionCount = 3,
}: {
  sectionCount?: number;
}) {
  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <span className="text-muted-foreground">›</span>
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>

      {Array.from({ length: sectionCount }).map((_, i) => (
        <div key={i} className="space-y-2 pt-4 border-t">
          <Skeleton className="h-4 w-32" />
          <div className="rounded-xl border bg-card divide-y">
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="px-4 py-3 flex gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
