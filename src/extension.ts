import * as vscode from "vscode";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ControlCenterProvider } from "./ui/controlCenter";
import { expandArgs, getProviderDefinition, PROVIDERS, resolveExecutable, runProviderProcess } from "./core/providers";
import { loadRuleBundle } from "./core/rules";
import { buildProviderPrompt, orchestrate } from "./core/orchestrator";
import type {
  DispatchMode,
  OrchestrationRequest,
  OrchestrationResult,
  ProviderHealth,
  ProviderId,
  ProviderRunRequest,
  ProviderRunResult,
  RuleBundle,
  WorkspaceSnapshot
} from "./core/types";

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("TRIGEN-Orchestration");
  const controller = new TrigenController(output);
  const controlCenter = new ControlCenterProvider(context, controller);

  context.subscriptions.push(
    output,
    vscode.window.registerWebviewViewProvider("trigen.controlCenter", controlCenter),
    vscode.commands.registerCommand("trigen.openConsole", () => controlCenter.reveal()),
    vscode.commands.registerCommand("trigen.runHealthCheck", async () => {
      const health = await controller.healthCheck();
      output.show(true);
      output.appendLine(JSON.stringify(health, null, 2));
      await controlCenter.refreshHealth();
    }),
    vscode.commands.registerCommand("trigen.loadRules", async () => {
      const rules = await controller.loadRules();
      vscode.window.showInformationMessage(`TRIGEN loaded ${rules.documents.length} rule file(s).`);
      await controlCenter.refreshRules();
    }),
    vscode.commands.registerCommand("trigen.dispatchParallel", () => promptAndDispatch(controlCenter, "parallel")),
    vscode.commands.registerCommand("trigen.dispatchSerial", () => promptAndDispatch(controlCenter, "serial")),
    vscode.commands.registerCommand("trigen.dispatchGroup", () => promptAndDispatch(controlCenter, "group")),
    vscode.commands.registerCommand("trigen.dispatchHandoff", () => promptAndDispatch(controlCenter, "handoff"))
  );
}

export function deactivate(): void {
  // No persistent process is started by the extension.
}

class TrigenController {
  constructor(private readonly output: vscode.OutputChannel) {}

  async healthCheck(): Promise<readonly ProviderHealth[]> {
    return await Promise.all(PROVIDERS.map((provider) => this.providerHealth(provider.id)));
  }

  async loadRules(): Promise<RuleBundle> {
    const workspaceFolder = requireWorkspaceFolder();
    const config = vscode.workspace.getConfiguration("trigen");
    const fileNames = config.get<string[]>("rules.fileNames", [
      "AGENTS.md",
      "TRIGEN.md",
      "CLAUDE.md",
      "GEMINI.md",
      ".github/copilot-instructions.md"
    ]);
    const maxBytes = config.get<number>("rules.maxBytes", 120000);
    return await loadRuleBundle(workspaceFolder, fileNames, maxBytes);
  }

  async dispatch(mode: DispatchMode, providers: readonly ProviderId[], userPrompt: string): Promise<OrchestrationResult> {
    const workspaceFolder = requireWorkspaceFolder();
    const ruleBundle = await this.loadRules();
    const snapshot = await this.snapshot(workspaceFolder);
    const request: OrchestrationRequest = {
      mode,
      providers,
      userPrompt,
      workspaceFolder,
      ruleBundle,
      snapshot
    };

    await this.writePromptArtifacts(request);

    const result = await orchestrate(request, (runRequest) => this.runProvider(runRequest));
    this.output.appendLine(result.transcript);
    return result;
  }

  private async providerHealth(providerId: ProviderId): Promise<ProviderHealth> {
    const provider = getProviderDefinition(providerId);
    const config = vscode.workspace.getConfiguration("trigen");
    const configuredCommand = config.get<string>(`providers.${providerId}.command`, "");
    const commandCandidates = configuredCommand.trim()
      ? [configuredCommand.trim()]
      : provider.commandCandidates;
    const cliPath = await resolveExecutable(commandCandidates);
    const extensionId = provider.officialExtensionIds.find((id) => vscode.extensions.getExtension(id));
    const notes: string[] = [];

    notes.push(extensionId ? `Official extension detected: ${extensionId}` : "Official extension not detected.");
    notes.push(cliPath ? `CLI detected: ${cliPath}` : `CLI not detected. Configure trigen.providers.${providerId}.command when installed.`);

    return {
      id: providerId,
      label: provider.label,
      extensionInstalled: Boolean(extensionId),
      extensionId,
      cliPath,
      configuredCommand: configuredCommand || undefined,
      ready: Boolean(cliPath),
      notes
    };
  }

  private async runProvider(request: ProviderRunRequest): Promise<ProviderRunResult> {
    const health = await this.providerHealth(request.providerId);
    const provider = getProviderDefinition(request.providerId);
    if (!health.cliPath) {
      const now = new Date().toISOString();
      return {
        providerId: request.providerId,
        ok: false,
        skipped: true,
        stdout: "",
        stderr: "",
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        estimatedPromptTokens: 0,
        estimatedOutputTokens: 0,
        error: `${provider.label} CLI is not configured or not installed.`
      };
    }

    const config = vscode.workspace.getConfiguration("trigen");
    const configuredArgs = config.get<string[]>(`providers.${request.providerId}.args`, [...provider.defaultArgs]);
    const timeoutMs = config.get<number>("execution.timeoutMs", 600000);
    const args = expandArgs(configuredArgs, {
      workspaceFolder: request.workspaceFolder
    });

    this.output.appendLine(`[TRIGEN] Running ${provider.label}: ${health.cliPath} ${args.join(" ")}`);
    return await runProviderProcess(request, health.cliPath, args, timeoutMs);
  }

  private async snapshot(workspaceFolder: string): Promise<WorkspaceSnapshot> {
    const editor = vscode.window.activeTextEditor;
    const selectedText = editor && !editor.selection.isEmpty
      ? editor.document.getText(editor.selection)
      : undefined;
    const activeFile = editor?.document.uri.scheme === "file" ? editor.document.uri.fsPath : undefined;
    const gitStatus = await getGitStatus(workspaceFolder);
    return {
      workspaceFolder,
      activeFile,
      selectedText,
      gitStatus
    };
  }

  private async writePromptArtifacts(request: OrchestrationRequest): Promise<void> {
    const config = vscode.workspace.getConfiguration("trigen");
    if (!config.get<boolean>("execution.writePromptArtifacts", true)) {
      return;
    }
    const promptDir = path.join(request.workspaceFolder, ".trigen", "prompts");
    await mkdir(promptDir, { recursive: true });
    await Promise.all(request.providers.map(async (providerId) => {
      const prompt = buildProviderPrompt(
        providerId,
        request.mode,
        request.userPrompt,
        request.ruleBundle,
        request.snapshot
      );
      await writeFile(path.join(promptDir, `${providerId}-last.md`), prompt, "utf8");
    }));
  }
}

async function promptAndDispatch(controlCenter: ControlCenterProvider, mode: DispatchMode): Promise<void> {
  const prompt = await vscode.window.showInputBox({
    title: `TRIGEN ${mode}`,
    prompt: "Task for selected providers",
    ignoreFocusOut: true
  });
  if (prompt) {
    await controlCenter.dispatchFromCommand(mode, prompt);
  }
}

function requireWorkspaceFolder(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("Open a workspace folder before using TRIGEN-Orchestration.");
  }
  return folder.uri.fsPath;
}

async function getGitStatus(workspaceFolder: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--short", "--branch"], {
      cwd: workspaceFolder,
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });
    return stdout.trim();
  } catch {
    return undefined;
  }
}
