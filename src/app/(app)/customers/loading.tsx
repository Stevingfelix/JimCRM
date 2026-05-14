import { ListPageSkeleton } from "@/components/list-skeleton";

export default function CustomersLoading() {
  return <ListPageSkeleton title="Customers" columnCount={4} />;
}
