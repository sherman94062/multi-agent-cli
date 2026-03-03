import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envPath = resolve(process.cwd(), ".env");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env not present — rely on shell environment
}

export const CONFIG = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  MODEL: "claude-sonnet-4-6",
  ORCHESTRATOR_MAX_TOKENS: 4096,
  SPECIALIST_MAX_TOKENS: 16000,
  MAX_TOOL_ITERATIONS: 8,
} as const;

if (!CONFIG.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}
