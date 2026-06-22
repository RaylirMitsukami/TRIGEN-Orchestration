export type ProviderId = "codex" | "claude" | "gemini";

export type DispatchMode = "parallel" | "serial" | "group" | "handoff";

export type ReasoningLevel = string;

export type ModelPermission = string;

export interface ProviderChoice {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface ProviderModelProfile {
  readonly name: string;
  readonly reasoningLevels: readonly ProviderChoice[];
  readonly permissions: readonly ProviderChoice[];
  readonly defaultReasoningLevel: ReasoningLevel;
  readonly defaultPermission: ModelPermission;
}

export interface ProviderDefinition {
  readonly id: ProviderId;
  readonly label: string;
  readonly shortLabel: string;
  readonly officialExtensionIds: readonly string[];
  readonly authProviderIds: readonly string[];
  readonly commandCandidates: readonly string[];
  readonly defaultArgs: readonly string[];
  readonly docsUrl: string;
  readonly loginUrl: string;
  readonly modelOptions: readonly ProviderModelProfile[];
  readonly defaultModel: string;
}

export interface ProviderHealth {
  readonly id: ProviderId;
  readonly label: string;
  readonly extensionInstalled: boolean;
  readonly extensionId?: string;
  readonly cliPath?: string;
  readonly configuredCommand?: string;
  readonly ready: boolean;
  readonly notes: readonly string[];
}

export interface AgentRuntimeSettings {
  readonly model: string;
  readonly reasoningLevel: ReasoningLevel;
  readonly permission: ModelPermission;
}

export interface ProviderUsageWindow {
  readonly fiveHourRemainingPercent?: number;
  readonly weeklyRemainingPercent?: number;
  readonly fiveHourRefreshAt?: string;
  readonly weeklyRefreshAt?: string;
  readonly source: "provider" | "local" | "unavailable";
}

export interface ProviderControlState {
  readonly id: ProviderId;
  readonly label: string;
  readonly shortLabel: string;
  readonly linked: boolean;
  readonly status: "ready" | "linked" | "setup";
  readonly health: ProviderHealth;
  readonly settings: AgentRuntimeSettings;
  readonly usage: ProviderUsageWindow;
  readonly modelOptions: readonly string[];
  readonly reasoningOptions: readonly ProviderChoice[];
  readonly permissionOptions: readonly ProviderChoice[];
  readonly loginUrl: string;
  readonly docsUrl: string;
  readonly webContextStatus: "available-through-provider" | "link-required";
}

export interface TrigenRulesStatus {
  readonly workspaceFolder: string;
  readonly path: string;
  readonly exists: boolean;
}

export interface RuleDocument {
  readonly path: string;
  readonly content: string;
  readonly truncated: boolean;
}

export interface RuleBundle {
  readonly workspaceFolder: string;
  readonly documents: readonly RuleDocument[];
  readonly totalBytes: number;
  readonly maxBytes: number;
}

export interface TrigenAgentDisplay {
  readonly name: string;
  readonly color: string;
}

export type TrigenDisplayConfig = Record<ProviderId, TrigenAgentDisplay>;

export interface WorkspaceSnapshot {
  readonly workspaceFolder: string;
  readonly activeFile?: string;
  readonly selectedText?: string;
  readonly gitStatus?: string;
}

export interface ProviderRunRequest {
  readonly providerId: ProviderId;
  readonly mode: DispatchMode;
  readonly userPrompt: string;
  readonly prompt: string;
  readonly workspaceFolder: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface ProviderRunResult {
  readonly providerId: ProviderId;
  readonly ok: boolean;
  readonly skipped?: boolean;
  readonly exitCode?: number | null;
  readonly signal?: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly estimatedPromptTokens: number;
  readonly estimatedOutputTokens: number;
  readonly commandLine?: string;
  readonly error?: string;
}

export interface OrchestrationRequest {
  readonly mode: DispatchMode;
  readonly providers: readonly ProviderId[];
  readonly userPrompt: string;
  readonly workspaceFolder: string;
  readonly ruleBundle: RuleBundle;
  readonly snapshot: WorkspaceSnapshot;
}

export interface OrchestrationResult {
  readonly mode: DispatchMode;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly results: readonly ProviderRunResult[];
  readonly transcript: string;
}

export type ProviderRunner = (request: ProviderRunRequest) => Promise<ProviderRunResult>;
