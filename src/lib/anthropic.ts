import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return client;
}

export const MODELS = {
  extraction: "claude-sonnet-4-6",
  classification: "claude-haiku-4-5-20251001",
} as const;
