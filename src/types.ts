// ── Agent roles ───────────────────────────────────────────────────────────────

export type AgentRole =
  | "orchestrator"
  | "researcher"
  | "writer"
  | "critic"
  | "synthesizer";

// ── Orchestrator plan ─────────────────────────────────────────────────────────

export interface PipelineStep {
  role: Exclude<AgentRole, "orchestrator">;
  task: string;
  rationale: string;
}

export interface OrchestratorPlan {
  topic: string;
  complexity: "simple" | "moderate" | "complex";
  steps: PipelineStep[];
}

// ── Agent results ─────────────────────────────────────────────────────────────

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  result: string;
  duration_ms: number;
}

export interface AgentResult {
  role: AgentRole;
  task: string;
  text: string;
  tool_calls: ToolCallRecord[];
  usage: { input_tokens: number; output_tokens: number };
  duration_ms: number;
}

// ── Pipeline context ──────────────────────────────────────────────────────────

export interface PipelineContext {
  topic: string;
  results: AgentResult[];
}

// ── Streaming delta callbacks ─────────────────────────────────────────────────

export type DeltaEvent =
  | { type: "thinking";    delta: string }
  | { type: "text";        delta: string }
  | { type: "tool_start";  tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: string; duration_ms: number };

export type DeltaCallback = (event: DeltaEvent) => void;
