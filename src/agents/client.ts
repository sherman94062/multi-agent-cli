import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "../config.js";

export const anthropic = new Anthropic({ apiKey: CONFIG.ANTHROPIC_API_KEY });

/**
 * Adaptive thinking — SDK 0.51 types don't include 'adaptive', cast via unknown.
 */
export const THINKING_PARAM = {
  type: "adaptive",
} as unknown as { type: "enabled"; budget_tokens: number };

/**
 * Web search server tool — Anthropic executes this internally.
 * We pass it in tools[] but never receive a tool_use block for it
 * and never send a tool_result back.
 */
export const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
};
