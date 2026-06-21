import * as vscode from "vscode";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SettingsViewProvider, UnifiedChatViewProvider, type IntegratedDispatchResult } from "./ui/controlCenter";
import { expandArgs, getProviderDefinition, PROVIDERS, resolveExecutable, runProviderProcess } from "./core/providers";
import { DEFAULT_RULE_FILE_NAMES, loadRuleBundle } from "./core/rules";
import { buildProviderPrompt, inferDispatchMode, orchestrate } from "./core/orchestrator";
import type {
  AgentRuntimeSettings,
  DispatchMode,
  ModelPermission,
  OrchestrationRequest,
  OrchestrationResult,
  ProviderControlState,
  ProviderHealth,
  ProviderId,
  ProviderRunRequest,
  ProviderRunResult,
  ProviderUsageWindow,
  ReasoningLevel,
  RuleBundle,
  WorkspaceSnapshot
} from "./core/types";

const execFileAsync = promisify(execFile);
const LINKED_PROVIDERS_KEY = "trigen.linkedProviders";
const AGENT_SETTINGS_KEY = "trigen.agentSettings";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("TRIGEN-Orchestration");
  const controller = new TrigenController(output, context);
  const settingsView = new SettingsViewProvider(context, controller);
  const unifiedChatView = new UnifiedChatViewProvider(context, controller);

  context.subscriptions.push(
    output,
    vscode.window.registerWebviewViewProvider("trigen.settings", settingsView),
    vscode.window.registerWebviewViewProvider("trigen.integratedChat", unifiedChatView),
    vscode.commands.registerCommand("trigen.openSettings", () => settingsView.reveal()),
    vscode.commands.registerCommand("trigen.openIntegratedChat", () => unifiedChatView.reveal()),
    vscode.commands.registerCommand("trigen.openConsole", () => unifiedChatView.reveal()),
    vscode.commands.registerCommand("trigen.runHealthCheck", async () => {
      const health = await controller.healthCheck();
      output.show(true);
      output.appendLine(JSON.stringify(health, null, 2));
      await settingsView.refresh("ヘルスチェック完了 / Health check complete.");
    }),
    vscode.commands.registerCommand("trigen.loadRules", async () => {
      const rules = await controller.loadRules();
      vscode.window.showInformationMessage(`TRIGEN loaded ${rules.documents.length} rule file(s).`);
      await settingsView.refresh("ルールを再読み込みしました / Rules reloaded.");
    })
  );
}

export function deactivate(): void {
  // No persistent process is started by the extension.
}

class TrigenController {
  constructor(
    private readonly output: vscode.OutputChannel,
    private readonly context: vscode.ExtensionContext
  ) {}

  async healthCheck(): Promise<readonly ProviderHealth[]> {
    return await Promise.all(PROVIDERS.map((provider) => this.providerHealth(provider.id)));
  }

  async getControlState(): Promise<readonly ProviderControlState[]> {
    const health = await this.healthCheck();
    const linked = this.linkedProviders();
    const settings = this.agentSettings();

    return PROVIDERS.map((provider) => {
      const providerHealth = health.find((item) => item.id === provider.id);
      if (!providerHealth) {
        throw new Error(`Missing provider health for ${provider.id}`);
      }
      const providerSettings = normalizeSettings(provider.id, settings[provider.id]);
      const isLinked = Boolean(linked[provider.id]);
      return {
        id: provider.id,
        label: provider.label,
        shortLabel: provider.shortLabel,
        linked: isLinked,
        status: providerHealth.ready ? "ready" : isLinked ? "linked" : "setup",
        health: providerHealth,
        settings: providerSettings,
        usage: this.usageWindow(provider.id, isLinked),
        modelOptions: provider.modelOptions,
        loginUrl: provider.loginUrl,
        docsUrl: provider.docsUrl,
        webContextStatus: isLinked ? "available-through-provider" : "link-required"
      };
    });
  }

  async login(providerId: ProviderId): Promise<void> {
    const provider = getProviderDefinition(providerId);
    await vscode.env.openExternal(vscode.Uri.parse(provider.loginUrl));
    await this.setLinked(providerId, true);
  }

  async logout(providerId: ProviderId): Promise<void> {
    await this.setLinked(providerId, false);
  }

  async updateAgentSettings(providerId: ProviderId, settings: Partial<AgentRuntimeSettings>): Promise<void> {
    const current = this.agentSettings();
    const next = {
      ...current,
      [providerId]: normalizeSettings(providerId, {
        ...current[providerId],
        ...settings
      })
    };
    await this.context.globalState.update(AGENT_SETTINGS_KEY, next);
  }

  async loadRules(): Promise<RuleBundle> {
    const workspaceFolder = requireWorkspaceFolder();
    const config = vscode.workspace.getConfiguration("trigen");
    const fileNames = config.get<string[]>("rules.fileNames", [...DEFAULT_RULE_FILE_NAMES]);
    const maxBytes = config.get<number>("rules.maxBytes", 120000);
    return await loadRuleBundle(workspaceFolder, fileNames, maxBytes);
  }

  async dispatchImplicit(prompt: string, attachments: readonly string[]): Promise<IntegratedDispatchResult> {
    const mode = inferDispatchMode(prompt);
    const providers = await this.providersForUnifiedChat();
    const controlState = await this.getControlState();
    const enrichedPrompt = enrichUnifiedPrompt(prompt, attachments, controlState);
    const result = await this.dispatch(mode, providers, enrichedPrompt);
    return {
      ...result,
      routeSummary: routeSummary(mode, providers)
    };
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
    const accountNotes = await this.authenticationNotes(provider.authProviderIds);

    notes.push(extensionId ? `Official extension detected: ${extensionId}` : "Official extension not detected.");
    notes.push(...accountNotes);
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

  private async providersForUnifiedChat(): Promise<readonly ProviderId[]> {
    const state = await this.getControlState();
    const linkedOrReady = state.filter((item) => item.linked || item.health.ready).map((item) => item.id);
    return linkedOrReady.length > 0 ? linkedOrReady : PROVIDERS.map((provider) => provider.id);
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

  private linkedProviders(): Partial<Record<ProviderId, boolean>> {
    return this.context.globalState.get<Partial<Record<ProviderId, boolean>>>(LINKED_PROVIDERS_KEY, {});
  }

  private async setLinked(providerId: ProviderId, linked: boolean): Promise<void> {
    const current = this.linkedProviders();
    await this.context.globalState.update(LINKED_PROVIDERS_KEY, {
      ...current,
      [providerId]: linked
    });
  }

  private agentSettings(): Partial<Record<ProviderId, Partial<AgentRuntimeSettings>>> {
    return this.context.globalState.get<Partial<Record<ProviderId, Partial<AgentRuntimeSettings>>>>(AGENT_SETTINGS_KEY, {});
  }

  private usageWindow(_providerId: ProviderId, linked: boolean): ProviderUsageWindow {
    if (!linked) {
      return { source: "unavailable" };
    }
    return {
      source: "unavailable",
      fiveHourRefreshAt: "Provider reported time unavailable",
      weeklyRefreshAt: "Provider reported time unavailable"
    };
  }

  private async authenticationNotes(authProviderIds: readonly string[]): Promise<readonly string[]> {
    const notes: string[] = [];
    for (const authProviderId of authProviderIds) {
      try {
        const accounts = await vscode.authentication.getAccounts(authProviderId);
        if (accounts.length > 0) {
          notes.push(`Authentication account detected via ${authProviderId}: ${accounts.length}`);
        }
      } catch {
        // Most providers do not expose a stable VS Code Authentication provider.
      }
    }
    return notes;
  }
}

function requireWorkspaceFolder(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("Open a workspace folder before using TRIGEN-Orchestration.");
  }
  return folder.uri.fsPath;
}

function normalizeSettings(providerId: ProviderId, value: Partial<AgentRuntimeSettings> | undefined): AgentRuntimeSettings {
  const provider = getProviderDefinition(providerId);
  const model = value?.model && provider.modelOptions.includes(value.model)
    ? value.model
    : provider.defaultModel;
  return {
    model,
    reasoningLevel: isReasoningLevel(value?.reasoningLevel) ? value.reasoningLevel : "high",
    permission: isModelPermission(value?.permission) ? value.permission : "ask-every-time"
  };
}

function isReasoningLevel(value: unknown): value is ReasoningLevel {
  return value === "low" || value === "medium" || value === "high" || value === "extra-high";
}

function isModelPermission(value: unknown): value is ModelPermission {
  return value === "ask-every-time" || value === "read-only" || value === "workspace-write" || value === "full-access";
}

function enrichUnifiedPrompt(
  prompt: string,
  attachments: readonly string[],
  providers: readonly ProviderControlState[]
): string {
  const lines = [
    prompt,
    "",
    "## TRIGEN Unified Chat Policy",
    "",
    "- This request comes from the single TRIGEN 3-agent unified chat window.",
    "- Do not assume a separate per-agent chat context.",
    "- Use only this unified chat context plus the workspace rule bundle as the shared context.",
    "- Provider-side subscription account settings and memory should be respected through the provider runtime when available.",
    "",
    "## Agent Runtime Selection",
    "",
    ...providers.map((provider) => `- ${provider.shortLabel}: model=${provider.settings.model}; reasoning=${provider.settings.reasoningLevel}; permission=${provider.settings.permission}; linked=${provider.linked}`)
  ];

  if (attachments.length > 0) {
    lines.push("", "## User Attachments", "", ...attachments.map((item) => `- ${item}`));
  }

  return lines.join("\n");
}

function routeSummary(mode: DispatchMode, providers: readonly ProviderId[]): string {
  const labels = providers.map((providerId) => getProviderDefinition(providerId).shortLabel).join(" / ");
  const modeLabel = mode === "parallel"
    ? "並列 / Parallel"
    : mode === "serial"
      ? "直列 / Serial"
      : mode === "handoff"
        ? "自律型ハンドオフ / Autonomous handoff"
        : "グループチャット / Group chat";
  return [
    `文脈から内部処理経路を選択しました: ${modeLabel}`,
    `Internal route selected from context: ${modeLabel}`,
    "",
    `対象エージェント / Target agents: ${labels}`
  ].join("\n");
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
