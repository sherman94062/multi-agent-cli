#!/usr/bin/env tsx
import * as readline from "readline";
import { planTask } from "./agents/orchestrator.js";
import { runAgent } from "./agents/runner.js";
import { SPECIALIST_CONFIGS } from "./agents/specialists.js";
import * as display from "./display.js";
import type { PipelineContext } from "./types.js";

// ── Context accumulation ──────────────────────────────────────────────────────

// Max characters per prior agent output included in context (~5k tokens each).
const MAX_CONTEXT_CHARS_PER_AGENT = 6000;

function buildContextBlock(ctx: PipelineContext, currentTask: string): string {
  const sections = ctx.results
    .map((r) => {
      const text =
        r.text.length > MAX_CONTEXT_CHARS_PER_AGENT
          ? r.text.slice(0, MAX_CONTEXT_CHARS_PER_AGENT) + "\n\n[…truncated for brevity]"
          : r.text;
      return `## ${r.role.toUpperCase()} OUTPUT\n${text}`;
    })
    .join("\n\n");

  return sections
    ? `<prior_context>\n${sections}\n</prior_context>\n\nYour task:\n${currentTask}`
    : `Your task:\n${currentTask}`;
}

// ── Pipeline runner ───────────────────────────────────────────────────────────

async function runPipeline(topic: string): Promise<void> {
  const pipelineStart = Date.now();

  // Step 0: Orchestrator plans the pipeline (non-streaming)
  display.printStepHeader("orchestrator", 0, 0, topic);
  process.stdout.write(display.printPrompt().replace("You: ", "  Planning… "));

  let plan;
  try {
    plan = await planTask(topic);
  } catch (err) {
    process.stdout.write("\n");
    display.printError(`Orchestrator failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  process.stdout.write("\n");
  display.printOrchestratorPlan(plan);

  const ctx: PipelineContext = { topic, results: [] };
  const totalSteps = plan.steps.length;

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]!;
    const config = SPECIALIST_CONFIGS[step.role];
    const stepNum = i + 1;

    display.printStepHeader(step.role, stepNum, totalSteps, step.task);

    try {
      const result = await runAgent(
        step.role,
        step.task,
        config.systemPrompt,
        buildContextBlock(ctx, step.task),
        config.enableWebSearch,
        (evt) => display.handleDelta(evt),
      );

      ctx.results.push(result);

      if (i < plan.steps.length - 1) {
        const nextRole = plan.steps[i + 1]!.role;
        display.printHandoff(step.role, nextRole, result.duration_ms);
      }
    } catch (err) {
      display.printError(
        `${step.role} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
  }

  const lastResult = ctx.results[ctx.results.length - 1];
  if (lastResult) {
    display.printFinalOutput(lastResult);
    display.printPipelineSummary(ctx.results, Date.now() - pipelineStart);
  }
}

// ── REPL ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  display.printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const EXIT_COMMANDS = new Set(["exit", "quit", ":q"]);

  const prompt = (): void => {
    rl.question(display.printPrompt(), async (input) => {
      const message = input.trim();

      if (!message) {
        prompt();
        return;
      }

      if (EXIT_COMMANDS.has(message.toLowerCase())) {
        console.log("\x1b[90m\n  Goodbye.\n\x1b[0m");
        rl.close();
        process.exit(0);
      }

      try {
        await runPipeline(message);
      } catch (err) {
        display.printError(err instanceof Error ? err.message : String(err));
      }

      prompt();
    });
  };

  rl.on("close", () => {
    console.log("\x1b[90m\n  Goodbye.\n\x1b[0m");
    process.exit(0);
  });

  prompt();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
