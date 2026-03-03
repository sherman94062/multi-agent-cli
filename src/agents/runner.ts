import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, THINKING_PARAM, WEB_SEARCH_TOOL } from "./client.js";
import { toolRegistry } from "../tools/index.js";
import { CONFIG } from "../config.js";
import type { AgentResult, AgentRole, DeltaCallback, ToolCallRecord } from "../types.js";

/**
 * Runs one agent with a full streaming agentic tool loop.
 * Fires onDelta for every streaming event so the display layer
 * can write to stdout in real time.
 */
export async function runAgent(
  role: AgentRole,
  task: string,
  systemPrompt: string,
  userMessage: string,
  enableWebSearch: boolean,
  onDelta: DeltaCallback,
): Promise<AgentResult> {
  const start = Date.now();
  const toolCalls: ToolCallRecord[] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let finalText = "";

  const tools: Anthropic.Messages.ToolUnion[] = [
    ...(enableWebSearch ? [WEB_SEARCH_TOOL] : []),
    ...toolRegistry.definitions(),
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < CONFIG.MAX_TOOL_ITERATIONS; i++) {
    const stream = anthropic.messages.stream({
      model: CONFIG.MODEL,
      max_tokens: CONFIG.SPECIALIST_MAX_TOKENS,
      thinking: THINKING_PARAM,
      system: systemPrompt,
      tools,
      messages,
    });

    const toolUseAccumulator = new Map<
      number,
      { id: string; name: string; inputJson: string }
    >();

    for await (const event of stream) {
      if (event.type === "message_start") {
        usage.input_tokens += event.message.usage.input_tokens;
      }

      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "tool_use") {
          toolUseAccumulator.set(event.index, {
            id: block.id,
            name: block.name,
            inputJson: "",
          });
        }
      }

      if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "thinking_delta") {
          onDelta({ type: "thinking", delta: delta.thinking });
        }
        if (delta.type === "text_delta") {
          onDelta({ type: "text", delta: delta.text });
        }
        if (delta.type === "input_json_delta") {
          const acc = toolUseAccumulator.get(event.index);
          if (acc) acc.inputJson += delta.partial_json;
        }
      }

      if (event.type === "message_delta") {
        usage.output_tokens += event.usage.output_tokens ?? 0;
      }
    }

    const finalMessage = await stream.finalMessage();

    // Collect final text from this response
    for (const block of finalMessage.content) {
      if (block.type === "text") finalText = block.text;
    }

    if (finalMessage.stop_reason === "end_turn") break;

    if (finalMessage.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: finalMessage.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of finalMessage.content) {
        if (block.type !== "tool_use") continue;

        const input = block.input as Record<string, unknown>;
        onDelta({ type: "tool_start", tool: block.name, input });

        const toolStart = Date.now();
        let result: string;
        try {
          result = (await toolRegistry.execute(block.name, input)).result;
        } catch (err) {
          result = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
        const duration_ms = Date.now() - toolStart;

        onDelta({ type: "tool_result", tool: block.name, result, duration_ms });

        toolCalls.push({ tool: block.name, input, result, duration_ms });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Any other stop reason — exit loop
    break;
  }

  return {
    role,
    task,
    text: finalText,
    tool_calls: toolCalls,
    usage,
    duration_ms: Date.now() - start,
  };
}
