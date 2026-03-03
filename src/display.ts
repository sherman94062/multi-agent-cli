import type { AgentResult, AgentRole, DeltaEvent, OrchestratorPlan } from "./types.js";
import { CONFIG } from "./config.js";

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  magenta: "\x1b[35m",
  blue:    "\x1b[34m",
  red:     "\x1b[31m",
  gray:    "\x1b[90m",
  white:   "\x1b[37m",
};

const ROLE_COLORS: Record<AgentRole, string> = {
  orchestrator: c.magenta,
  researcher:   c.cyan,
  writer:       c.green,
  critic:       c.yellow,
  synthesizer:  c.blue,
};

const WIDTH = 60;
const line  = (ch = "─") => ch.repeat(WIDTH);

function paint(color: string, text: string): string {
  return `${color}${text}${c.reset}`;
}

function roleLabel(role: AgentRole): string {
  return paint(c.bold + ROLE_COLORS[role], role.toUpperCase());
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

// ── Public display API ────────────────────────────────────────────────────────

export function printBanner(): void {
  console.log();
  console.log(paint(c.bold + c.cyan, "  Claude Multi-Agent Research CLI"));
  console.log(paint(c.gray, `  model : ${CONFIG.MODEL}`));
  console.log(paint(c.gray, `  exit  : type 'exit' or press Ctrl+C`));
  console.log();
}

export function printPrompt(): string {
  return paint(c.bold + c.white, "You: ");
}

export function printOrchestratorPlan(plan: OrchestratorPlan): void {
  console.log();
  console.log(paint(c.gray, line("─")));
  console.log(
    `${paint(c.bold + c.magenta, "  Orchestrator")}  ${paint(c.gray, `complexity: ${plan.complexity}`)}`,
  );

  const roles = plan.steps.map((s) => roleLabel(s.role)).join(paint(c.gray, " → "));
  console.log(`  Pipeline: ${roles}`);
  console.log();

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]!;
    const num = paint(c.gray, `${i + 1}.`);
    const role = roleLabel(step.role).padEnd(20);
    console.log(`  ${num} ${role} ${paint(c.dim, `"${step.task.slice(0, 55)}${step.task.length > 55 ? "…" : ""}"`)}`);
  }

  console.log(paint(c.gray, line("─")));
}

export function printStepHeader(
  role: AgentRole,
  stepIndex: number,
  totalSteps: number,
  task: string,
): void {
  console.log();
  const stepBadge = stepIndex > 0
    ? paint(c.gray, `Step ${stepIndex} / ${totalSteps}  —  `) + roleLabel(role)
    : roleLabel(role);
  console.log(`${paint(c.bold, "▶")} ${stepBadge}`);
  console.log(paint(c.gray, `  Task: ${task}`));
  console.log(paint(c.gray, line("─")));
}

export function handleDelta(event: DeltaEvent): void {
  switch (event.type) {
    case "thinking":
      // Suppress by default — Claude's internal reasoning is verbose
      break;

    case "text":
      process.stdout.write(event.delta);
      break;

    case "tool_start": {
      const inputPreview = Object.values(event.input)
        .map((v) => (typeof v === "string" ? `"${v.slice(0, 50)}"` : String(v)))
        .join(", ");
      process.stdout.write(
        `\n${paint(c.yellow, `  ⚙  ${event.tool}(${inputPreview})`)}\n`,
      );
      break;
    }

    case "tool_result": {
      const snippet = event.result.slice(0, 120).replace(/\n/g, " ");
      process.stdout.write(
        paint(c.gray, `  → ${snippet}${event.result.length > 120 ? "…" : ""}  (${fmtMs(event.duration_ms)})`) + "\n\n",
      );
      break;
    }
  }
}

export function printHandoff(
  fromRole: AgentRole,
  toRole: AgentRole,
  durationMs: number,
): void {
  console.log();
  console.log(
    paint(c.gray, `  ${roleLabel(fromRole)} ${paint(c.gray, "finished in")} ${fmtMs(durationMs)}`),
  );
  console.log(
    `${paint(c.bold + c.gray, "  →")} Handoff to ${roleLabel(toRole)}`,
  );
}

export function printFinalOutput(result: AgentResult): void {
  console.log();
  console.log(paint(c.bold, "═".repeat(WIDTH)));
  console.log(paint(c.bold + c.green, "  Final Output") + paint(c.gray, `  (${roleLabel(result.role)})`));
  console.log(paint(c.bold, "═".repeat(WIDTH)));
  console.log();
  console.log(result.text);
  console.log();
}

export function printPipelineSummary(
  results: AgentResult[],
  totalMs: number,
): void {
  const totalTokens = results.reduce(
    (sum, r) => sum + r.usage.input_tokens + r.usage.output_tokens,
    0,
  );
  const agentCount = results.length;
  const toolCallCount = results.reduce((sum, r) => sum + r.tool_calls.length, 0);

  console.log(paint(c.gray, line("─")));
  console.log(
    paint(
      c.gray,
      `  Pipeline complete · ${agentCount} agents · ${toolCallCount} tool calls · ${fmtMs(totalMs)} · ${totalTokens.toLocaleString()} tokens`,
    ),
  );
  console.log();

  // Per-agent timing breakdown
  for (const r of results) {
    const bar = "▪".repeat(Math.min(Math.round(r.duration_ms / 1000), 30));
    console.log(
      paint(c.gray, `  ${roleLabel(r.role).padEnd(22)} ${fmtMs(r.duration_ms).padStart(6)}  ${paint(c.gray + c.dim, bar)}`),
    );
  }
  console.log();
}

export function printError(message: string): void {
  console.error(paint(c.red, `\n  Error: ${message}\n`));
}
