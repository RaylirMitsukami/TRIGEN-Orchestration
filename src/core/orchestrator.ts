import type {
  DispatchMode,
  OrchestrationRequest,
  OrchestrationResult,
  ProviderId,
  ProviderRunRequest,
  ProviderRunResult,
  ProviderRunner,
  RuleBundle,
  WorkspaceSnapshot
} from "./types";
import { getProviderDefinition } from "./providers";
import { renderRuleBundle } from "./rules";

export async function orchestrate(
  request: OrchestrationRequest,
  runner: ProviderRunner
): Promise<OrchestrationResult> {
  const startedAt = new Date().toISOString();
  const results = await runByMode(request, runner);
  const endedAt = new Date().toISOString();

  return {
    mode: request.mode,
    startedAt,
    endedAt,
    results,
    transcript: renderTranscript(request.mode, results)
  };
}

export function buildProviderPrompt(
  providerId: ProviderId,
  mode: DispatchMode,
  userPrompt: string,
  ruleBundle: RuleBundle,
  snapshot: WorkspaceSnapshot,
  priorResults: readonly ProviderRunResult[] = []
): string {
  const provider = getProviderDefinition(providerId);
  const priorBlock = priorResults.length > 0
    ? priorResults.map(formatPriorResult).join("\n\n")
    : "No prior provider output for this step.";

  return [
    "# TRIGEN-Orchestration Dispatch",
    "",
    `Provider: ${provider.label}`,
    `Mode: ${mode}`,
    `Workspace: ${snapshot.workspaceFolder}`,
    "",
    "## User Request",
    "",
    userPrompt,
    "",
    "## Workspace Rules",
    "",
    renderRuleBundle(ruleBundle),
    "",
    "## Workspace Snapshot",
    "",
    renderSnapshot(snapshot),
    "",
    "## Prior Provider Output",
    "",
    priorBlock,
    "",
    "## Required Response",
    "",
    "Answer as a coding agent working on this repository. Be concrete, cite files when relevant, and separate completed work from risks or required follow-up."
  ].join("\n");
}

export function renderTranscript(mode: DispatchMode, results: readonly ProviderRunResult[]): string {
  const lines = [`# TRIGEN ${mode} transcript`, ""];
  for (const result of results) {
    const status = result.ok ? "ok" : result.skipped ? "skipped" : "failed";
    lines.push(`## ${result.providerId} (${status})`);
    if (result.commandLine) {
      lines.push("", `Command: \`${result.commandLine}\``);
    }
    if (result.error) {
      lines.push("", `Error: ${result.error}`);
    }
    if (result.stdout.trim()) {
      lines.push("", "### stdout", "", fenced(result.stdout.trim()));
    }
    if (result.stderr.trim()) {
      lines.push("", "### stderr", "", fenced(result.stderr.trim()));
    }
    lines.push("");
  }
  return lines.join("\n");
}

function runByMode(request: OrchestrationRequest, runner: ProviderRunner): Promise<readonly ProviderRunResult[]> {
  switch (request.mode) {
    case "parallel":
    case "group":
      return runParallel(request, runner);
    case "serial":
    case "handoff":
      return runSerial(request, runner);
    default:
      assertNever(request.mode);
  }
}

async function runParallel(request: OrchestrationRequest, runner: ProviderRunner): Promise<readonly ProviderRunResult[]> {
  return await Promise.all(request.providers.map((providerId) => {
    const prompt = buildProviderPrompt(providerId, request.mode, request.userPrompt, request.ruleBundle, request.snapshot);
    return runner(toProviderRequest(request, providerId, prompt));
  }));
}

async function runSerial(request: OrchestrationRequest, runner: ProviderRunner): Promise<readonly ProviderRunResult[]> {
  const results: ProviderRunResult[] = [];
  for (const providerId of request.providers) {
    const prompt = buildProviderPrompt(
      providerId,
      request.mode,
      request.userPrompt,
      request.ruleBundle,
      request.snapshot,
      results
    );
    const result = await runner(toProviderRequest(request, providerId, prompt));
    results.push(result);
  }
  return results;
}

function toProviderRequest(
  request: OrchestrationRequest,
  providerId: ProviderId,
  prompt: string
): ProviderRunRequest {
  return {
    providerId,
    mode: request.mode,
    userPrompt: request.userPrompt,
    prompt,
    workspaceFolder: request.workspaceFolder
  };
}

function renderSnapshot(snapshot: WorkspaceSnapshot): string {
  const lines = [
    `Workspace folder: ${snapshot.workspaceFolder}`,
    `Active file: ${snapshot.activeFile ?? "none"}`,
    `Selected text: ${snapshot.selectedText ? `${snapshot.selectedText.length} characters` : "none"}`
  ];
  if (snapshot.selectedText) {
    lines.push("", "### Selected Text", "", fenced(snapshot.selectedText));
  }
  if (snapshot.gitStatus) {
    lines.push("", "### Git Status", "", fenced(snapshot.gitStatus));
  }
  return lines.join("\n");
}

function formatPriorResult(result: ProviderRunResult): string {
  const status = result.ok ? "ok" : result.skipped ? "skipped" : "failed";
  const output = result.stdout.trim() || result.stderr.trim() || result.error || "No output.";
  return `### ${result.providerId} (${status})\n\n${fenced(output)}`;
}

function fenced(value: string): string {
  return `\`\`\`\n${value}\n\`\`\``;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled mode: ${value}`);
}
