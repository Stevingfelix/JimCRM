import type { ComponentType } from "react";
import { CapBrandedTemplate } from "./cap-branded";
import { BlindTemplate } from "./blind";
import type { QuotePdfProps } from "./types";

// Add new templates here by registering their component_key.
// New templates plug in as a single new file + this one-line entry.
// Make sure to also insert a row into pdf_templates (see migrations) so the
// picker on the quote builder surfaces it.
export const TEMPLATE_REGISTRY: Record<string, ComponentType<QuotePdfProps>> = {
  "cap-branded": CapBrandedTemplate,
  blind: BlindTemplate,
};

export function getTemplate(
  key: string | null | undefined,
): ComponentType<QuotePdfProps> {
  if (key && TEMPLATE_REGISTRY[key]) return TEMPLATE_REGISTRY[key];
  return TEMPLATE_REGISTRY["cap-branded"];
}
