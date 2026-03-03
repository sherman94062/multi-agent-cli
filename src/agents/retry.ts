import Anthropic from "@anthropic-ai/sdk";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Wraps any async call with retry logic for rate-limit (429) errors.
 * Waits 65 seconds before retrying — enough to clear the per-minute window.
 */
export async function withRateLimitRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxRetries = 2,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError && attempt < maxRetries) {
        const waitSec = 65;
        process.stdout.write(
          `\n\x1b[90m  [${label}] Rate limit hit — waiting ${waitSec}s before retry (attempt ${attempt + 1}/${maxRetries})…\x1b[0m\n`,
        );
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}
