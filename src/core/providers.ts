import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ProviderChoice, ProviderDefinition, ProviderId, ProviderModelProfile, ProviderRunRequest, ProviderRunResult } from "./types";

const CODEX_REASONING = [
  choice("low", "Low"),
  choice("medium", "Medium"),
  choice("high", "High"),
  choice("xhigh", "X High")
];

const CODEX_REASONING_COMPACT = CODEX_REASONING.filter((item) => item.id !== "xhigh");

const CODEX_PERMISSIONS = [
  choice("read-only", "Read Only", "Read files without write access."),
  choice("workspace-write", "Workspace Write", "Read, edit, and run commands inside the workspace sandbox."),
  choice("danger-full-access", "Danger Full Access", "Run without Codex sandboxing; use only in trusted local workspaces.")
];

const CLAUDE_REASONING_FULL = [
  choice("low", "Low"),
  choice("medium", "Medium"),
  choice("high", "High"),
  choice("xhigh", "X High"),
  choice("max", "Max")
];

const CLAUDE_REASONING_SONNET = [
  choice("low", "Low"),
  choice("medium", "Medium"),
  choice("high", "High"),
  choice("max", "Max")
];

const CLAUDE_REASONING_AUTO = [
  choice("auto", "Auto", "Claude Code model default or unsupported effort.")
];

const CLAUDE_PERMISSIONS = [
  choice("default", "Default", "Ask before file edits and commands."),
  choice("acceptEdits", "Accept Edits", "Auto-accept file edits; ask for commands."),
  choice("plan", "Plan", "Planning-only mode."),
  choice("auto", "Auto", "Read/edit/run in the workspace with provider-managed checks."),
  choice("dontAsk", "Don't Ask", "Only pre-approved tools run without asking."),
  choice("bypassPermissions", "Bypass Permissions", "Everything without prompts; use only in isolated containers or VMs.")
];

const GEMINI_THINKING_STANDARD = [
  choice("minimal", "Minimal"),
  choice("low", "Low"),
  choice("medium", "Medium"),
  choice("high", "High")
];

const GEMINI_THINKING_PRO = GEMINI_THINKING_STANDARD.filter((item) => item.id !== "minimal");

const GEMINI_CAPABILITIES = [
  choice("plan", "Plan", "Read-only planning mode."),
  choice("default", "Default", "Ask before tool actions."),
  choice("auto_edit", "Auto Edit", "Auto-approve edit tools."),
  choice("yolo", "YOLO", "Auto-approve all tools.")
];

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "codex",
    label: "Codex",
    shortLabel: "Codex",
    officialExtensionIds: [],
    authProviderIds: [],
    commandCandidates: [
      "codex",
      "/Applications/Codex.app/Contents/Resources/codex"
    ],
    defaultArgs: [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "-C",
      "${workspaceFolder}",
      "--model",
      "${model}",
      "-c",
      "model_reasoning_effort=\"${reasoningLevel}\"",
      "--sandbox",
      "${codexSandbox}",
      "-"
    ],
    docsUrl: "https://developers.openai.com/codex/ide",
    loginUrl: "https://chatgpt.com/",
    modelOptions: [
      modelProfile("gpt-5.5", CODEX_REASONING, CODEX_PERMISSIONS, "high", "workspace-write"),
      modelProfile("gpt-5.4", CODEX_REASONING, CODEX_PERMISSIONS, "high", "workspace-write"),
      modelProfile("gpt-5.4-mini", CODEX_REASONING_COMPACT, CODEX_PERMISSIONS, "medium", "workspace-write")
    ],
    defaultModel: "gpt-5.5"
  },
  {
    id: "claude",
    label: "Claude Code",
    shortLabel: "Claude",
    officialExtensionIds: [],
    authProviderIds: [],
    commandCandidates: ["claude", "npx"],
    defaultArgs: ["-p", "-"],
    docsUrl: "https://code.claude.com/docs/en/vs-code",
    loginUrl: "https://claude.ai/login",
    modelOptions: [
      modelProfile("opus", CLAUDE_REASONING_FULL, CLAUDE_PERMISSIONS, "high", "default"),
      modelProfile("sonnet", CLAUDE_REASONING_SONNET, CLAUDE_PERMISSIONS, "high", "default"),
      modelProfile("haiku", CLAUDE_REASONING_AUTO, CLAUDE_PERMISSIONS.filter((item) => item.id !== "auto" && item.id !== "bypassPermissions"), "auto", "default"),
      modelProfile("fable", CLAUDE_REASONING_FULL, CLAUDE_PERMISSIONS, "high", "default"),
      modelProfile("opusplan", CLAUDE_REASONING_SONNET, CLAUDE_PERMISSIONS, "high", "plan")
    ],
    defaultModel: "opus"
  },
  {
    id: "gemini",
    label: "Gemini",
    shortLabel: "Gemini",
    officialExtensionIds: [],
    authProviderIds: [],
    commandCandidates: ["gemini", "npx"],
    defaultArgs: [
      "--prompt",
      "",
      "--model",
      "${geminiModel}",
      "--approval-mode",
      "${geminiApprovalMode}",
      "--skip-trust"
    ],
    docsUrl: "https://gemini.google.com/",
    loginUrl: "https://gemini.google.com/",
    modelOptions: [
      modelProfile("gemini-3.1-pro-preview", GEMINI_THINKING_PRO, GEMINI_CAPABILITIES, "high", "default"),
      modelProfile("gemini-3.5-flash", GEMINI_THINKING_STANDARD, GEMINI_CAPABILITIES, "medium", "auto_edit"),
      modelProfile("gemini-3-flash-preview", GEMINI_THINKING_STANDARD, GEMINI_CAPABILITIES, "medium", "auto_edit"),
      modelProfile("gemini-3.1-flash-lite", GEMINI_THINKING_STANDARD, GEMINI_CAPABILITIES, "medium", "default")
    ],
    defaultModel: "gemini-3.5-flash"
  }
];

export function getProviderDefinition(providerId: ProviderId): ProviderDefinition {
  const provider = PROVIDERS.find((item) => item.id === providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider;
}

export function getModelProfile(providerId: ProviderId, modelName: string): ProviderModelProfile {
  const provider = getProviderDefinition(providerId);
  return provider.modelOptions.find((item) => item.name === modelName)
    ?? provider.modelOptions.find((item) => item.name === provider.defaultModel)
    ?? provider.modelOptions[0];
}

function modelProfile(
  name: string,
  reasoningLevels: ProviderModelProfile["reasoningLevels"],
  permissions: ProviderModelProfile["permissions"],
  defaultReasoningLevel: ProviderModelProfile["defaultReasoningLevel"],
  defaultPermission: ProviderModelProfile["defaultPermission"]
): ProviderModelProfile {
  return {
    name,
    reasoningLevels,
    permissions,
    defaultReasoningLevel,
    defaultPermission
  };
}

function choice(id: string, label: string, description?: string): ProviderChoice {
  return { id, label, description };
}

export async function resolveExecutable(candidates: readonly string[], envPath = process.env.PATH ?? ""): Promise<string | undefined> {
  for (const candidate of candidates) {
    const resolved = await resolveOneExecutable(candidate, envPath);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

export function expandArgs(args: readonly string[], variables: Record<string, string>): string[] {
  return args.map((arg) => {
    let value = arg;
    for (const [key, replacement] of Object.entries(variables)) {
      value = value.replaceAll(`\${${key}}`, replacement);
    }
    return value;
  });
}

export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

export function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function commandLine(command: string, args: readonly string[]): string {
  return [command, ...args].map(shellQuote).join(" ");
}

export async function runProviderProcess(
  request: ProviderRunRequest,
  command: string,
  args: readonly string[],
  timeoutMs: number
): Promise<ProviderRunResult> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();

  return await new Promise<ProviderRunResult>((resolve) => {
    const child = spawn(command, args, {
      cwd: request.workspaceFolder,
      stdio: ["pipe", "pipe", "pipe"],
      env: providerProcessEnv(request.providerId)
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill("SIGTERM");
      }
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      settled = true;
      clearTimeout(timer);
      const ended = Date.now();
      resolve({
        providerId: request.providerId,
        ok: false,
        stdout,
        stderr,
        startedAt,
        endedAt: new Date(ended).toISOString(),
        durationMs: ended - started,
        estimatedPromptTokens: estimateTokens(request.prompt),
        estimatedOutputTokens: estimateTokens(stdout + stderr),
        commandLine: commandLine(command, args),
        error: error.message
      });
    });

    child.on("close", (exitCode, signal) => {
      settled = true;
      clearTimeout(timer);
      const ended = Date.now();
      const timedOut = signal === "SIGTERM" && ended - started >= timeoutMs;
      resolve({
        providerId: request.providerId,
        ok: exitCode === 0 && !timedOut,
        exitCode,
        signal,
        stdout,
        stderr,
        startedAt,
        endedAt: new Date(ended).toISOString(),
        durationMs: ended - started,
        estimatedPromptTokens: estimateTokens(request.prompt),
        estimatedOutputTokens: estimateTokens(stdout + stderr),
        commandLine: commandLine(command, args),
        error: timedOut ? `Provider timed out after ${timeoutMs}ms` : undefined
      });
    });

    child.stdin.end(request.prompt, "utf8");
  });
}

function providerProcessEnv(providerId: ProviderId): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (
    providerId === "gemini"
    && !env.GEMINI_API_KEY
    && !env.GOOGLE_GENAI_USE_VERTEXAI
    && !env.GOOGLE_GENAI_USE_GCA
  ) {
    env.GOOGLE_GENAI_USE_GCA = "true";
  }
  return env;
}

async function resolveOneExecutable(candidate: string, envPath: string): Promise<string | undefined> {
  if (looksLikePath(candidate)) {
    return await canExecute(candidate) ? candidate : undefined;
  }

  const pathEntries = envPath.split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const fullPath = path.join(entry, `${candidate}${extension}`);
      if (await canExecute(fullPath)) {
        return fullPath;
      }
    }
  }

  const homeBin = path.join(os.homedir(), ".local", "bin", candidate);
  if (await canExecute(homeBin)) {
    return homeBin;
  }

  return undefined;
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || value.includes("\\") || value.startsWith(".");
}

async function canExecute(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
