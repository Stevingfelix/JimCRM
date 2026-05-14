import { getPartNamingReference } from "@/lib/part-naming";
import { PartBuilder } from "./components/part-builder";

export const dynamic = "force-dynamic";

export default async function NewPartPage() {
  const reference = await getPartNamingReference();
  return <PartBuilder reference={reference} />;
}
