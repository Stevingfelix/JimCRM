import { getActiveCredentialsPublic } from "@/lib/gmail/credentials";
import { listReviewQueue } from "./queries";
import { GmailStatus } from "./components/gmail-status";
import { ReviewList } from "./components/review-list";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: { gmail?: string; gmail_error?: string };
}) {
  const [status, rows] = await Promise.all([
    getActiveCredentialsPublic(),
    listReviewQueue(),
  ]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 max-w-7xl">
      {searchParams.gmail === "connected" && (
        <div className="text-sm rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-900 px-3 py-2">
          Gmail connected — the cron will pull new emails on the next tick.
        </div>
      )}
      {searchParams.gmail_error && (
        <div className="text-sm rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950 dark:border-rose-900 px-3 py-2">
          OAuth error: {searchParams.gmail_error}
        </div>
      )}

      <GmailStatus status={status} />

      <ReviewList rows={rows} />
    </div>
  );
}
