import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ProviderDefinition, ProviderId, ProviderRunRequest, ProviderRunResult } from "./types";

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "codex",
    label: "Codex",
    shortLabel: "Codex",
    officialExtensionIds: ["openai.chatgpt"],
    commandCandidates: [
      "codex",
      "/Applications/Codex.app/Contents/Resources/codex"
    ],
    defaultArgs: ["exec", "--json", "--skip-git-repo-check", "-C", "${workspaceFolder}", "-"],
    docsUrl: "https://developers.openai.com/codex/ide"
  },
  {
    id: "claude",
    label: "Claude Code",
    shortLabel: "Claude",
    officialExtensionIds: ["anthropic.claude-code"],
    commandCandidates: ["claude"],
    defaultArgs: ["-p", "-"],
    docsUrl: "https://code.claude.com/docs/en/vs-code"
  },
  {
    id: "gemini",
    label: "Gemini Code Assist",
    shortLabel: "Gemini",
    officialExtensionIds: ["Google.geminicodeassist", "google.geminicodeassist"],
    commandCandidates: ["gemini"],
    defaultArgs: ["-p", "-"],
    docsUrl: "https://docs.cloud.google.com/gemini/docs/codeassist/set-up-gemini"
  }
];

export function getProviderDefinition(providerId: ProviderId): ProviderDefinition {
  const provider = PROVIDERS.find((item) => item.id === providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider;
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
      env: process.env
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
