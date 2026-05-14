import { Skeleton } from "@/components/ui/skeleton";

// Dashboard loading skeleton — 4 KPI tiles + 2 activity feeds.
export default function DashboardLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 max-w-7xl">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-32 mb-2" />
            {Array.from({ length: 4 }).map((__, j) => (
              <div key={j} className="flex items-center gap-3 py-2 border-t">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
