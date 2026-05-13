export function formatQuoteNumber(n: number): string {
  return `Q-${String(n).padStart(4, "0")}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export function formatMoney(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
