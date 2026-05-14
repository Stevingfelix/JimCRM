import { ListPageSkeleton } from "@/components/list-skeleton";

export default function ReviewLoading() {
  return <ListPageSkeleton title="Review queue" columnCount={5} />;
}
