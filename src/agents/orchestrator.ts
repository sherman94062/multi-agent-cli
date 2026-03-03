import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, THINKING_PARAM } from "./client.js";
import { CONFIG } from "../config.js";
import type { OrchestratorPlan } from "../types.js";

const SYSTEM_PROMPT = `\
You are an orchestrator for a multi-agent research pipeline.
Your ONLY job is to call the create_pipeline_plan tool with a structured execution plan.

Rules for plan construction:
- "simple" task (factual lookup, single-domain question): use [researcher, writer]
- "moderate" task (synthesis across sources, technical explanation): use [researcher, writer, critic]
- "complex" task (deep analysis, competing perspectives, strategic recommendations): use [researcher, writer, critic, synthesizer]

Each step's "task" must be a complete, specific instruction — the specialist receives ONLY their task plus accumulated prior context.
Do not add unnecessary steps. Prefer shorter pipelines for focused questions.`;

const CREATE_PLAN_TOOL: Anthropic.Tool = {
  name: "create_pipeline_plan",
  description: "Outputs a structured multi-agent execution plan for the given research topic.",
  input_schema: {
    type: "object",
    required: ["topic", "complexity", "steps"],
    properties: {
      topic: {
        type: "string",
        description: "The research topic or question as understood by the orchestrator",
      },
      complexity: {
        type: "string",
        enum: ["simple", "moderate", "complex"],
        description: "Assessed complexity level",
      },
      steps: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          required: ["role", "task", "rationale"],
          properties: {
            role: {
              type: "string",
              enum: ["researcher", "writer", "critic", "synthesizer"],
            },
            task: {
              type: "string",
              description: "Complete, specific instruction for this specialist",
            },
            rationale: {
              type: "string",
              description: "Why this step is included in the pipeline",
            },
          },
        },
      },
    },
  },
};

export async function planTask(topic: string): Promise<OrchestratorPlan> {
  const response = await anthropic.messages.create({
    model: CONFIG.MODEL,
    max_tokens: CONFIG.ORCHESTRATOR_MAX_TOKENS,
    thinking: THINKING_PARAM,
    system: SYSTEM_PROMPT,
    tools: [CREATE_PLAN_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: `Research topic: ${topic}` }],
  });

  const toolUseBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Orchestrator did not call create_pipeline_plan");
  }

  return toolUseBlock.input as OrchestratorPlan;
}
