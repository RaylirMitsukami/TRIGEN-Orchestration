import { writeFile } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { DEFAULT_TRIGEN_DISPLAY_CONFIG } from "../core/rules";
import type {
  AgentRuntimeSettings,
  OrchestrationResult,
  ProviderControlState,
  ProviderHealth,
  ProviderId,
  RuleBundle,
  TrigenDisplayConfig,
  TrigenRulesStatus
} from "../core/types";

const CHAT_THREADS_KEY = "trigen.chatThreads";
const SYSTEM_INTRO_TEXT = [
  "TRIGEN統合窓です。",
  ".TRIGEN-Rulesを優先し、左設定のモデル・権限で各CLIへ渡します。",
  "CLI未設定のエージェントは未実行として表示されます。"
].join("\n");

export interface IntegratedDispatchResult extends OrchestrationResult {
  readonly routeSummary: string;
}

export interface TrigenViewDelegate {
  getControlState(): Promise<readonly ProviderControlState[]>;
  getTrigenRulesStatus(): Promise<TrigenRulesStatus>;
  createTrigenRules(): Promise<TrigenRulesStatus>;
  getDisplayConfig(): Promise<TrigenDisplayConfig>;
  healthCheck(): Promise<readonly ProviderHealth[]>;
  loadRules(): Promise<RuleBundle>;
  login(providerId: ProviderId): Promise<boolean>;
  logout(providerId: ProviderId): Promise<void>;
  updateAgentSettings(providerId: ProviderId, settings: Partial<AgentRuntimeSettings>): Promise<void>;
  dispatchImplicit(prompt: string, attachments: readonly string[]): Promise<IntegratedDispatchResult>;
}

interface SettingsViewState {
  readonly providers: readonly ProviderControlState[];
  readonly ruleStatus?: TrigenRulesStatus;
  readonly busy: boolean;
  readonly message?: string;
}

interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "trigen" | "agent" | "system";
  readonly text: string;
  readonly timestamp: string;
  readonly providerId?: ProviderId;
}

interface ChatThread {
  readonly id: string;
  readonly title: string;
  readonly messages: readonly ChatMessage[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ChatViewState {
  readonly threads: readonly ChatThread[];
  readonly activeThreadId?: string;
  readonly attachments: readonly string[];
  readonly busy: boolean;
  readonly displayConfig: TrigenDisplayConfig;
  readonly message?: string;
}

export class SettingsViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: SettingsViewState = {
    providers: [],
    busy: false
  };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly delegate: TrigenViewDelegate
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    webviewView.webview.html = this.renderHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      void this.handleMessage(message);
    });
    void this.refresh("設定状態を確認しています / Checking settings...");
  }

  async reveal(): Promise<void> {
    await vscode.commands.executeCommand("trigen.settings.focus");
  }

  async refresh(message = "更新しました / Refreshed."): Promise<void> {
    this.setBusy(true, message);
    try {
      const [providers, ruleStatus] = await Promise.all([
        this.delegate.getControlState(),
        this.delegate.getTrigenRulesStatus()
      ]);
      this.state = {
        providers,
        ruleStatus,
        busy: false,
        message
      };
      this.postState();
    } catch (error) {
      this.state = {
        ...this.state,
        busy: false,
        message: errorMessage(error)
      };
      this.postState();
    }
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isSettingsMessage(message)) {
      return;
    }

    if (message.type === "refresh") {
      await this.refresh("状態を更新しました / Status refreshed.");
      return;
    }

    if (message.type === "createRules") {
      this.setBusy(true, ".TRIGEN-Rulesを作成しています / Creating .TRIGEN-Rules...");
      await this.delegate.createTrigenRules();
      await this.refresh(".TRIGEN-Rulesを作成しました / .TRIGEN-Rules created.");
      return;
    }

    if (message.type === "login") {
      this.setBusy(true, "ブラウザでログイン画面を開いています / Opening browser login...");
      const linked = await this.delegate.login(message.providerId);
      await this.refresh(linked
        ? "ログイン連携を記録しました / Login link recorded."
        : "ログイン連携は未変更です / Login link unchanged.");
      return;
    }

    if (message.type === "logout") {
      this.setBusy(true, "ログアウトしています / Logging out...");
      await this.delegate.logout(message.providerId);
      await this.refresh("ログアウトしました / Logged out.");
      return;
    }

    if (message.type === "setting") {
      const patch = settingPatch(message.key, message.value);
      if (!patch) {
        return;
      }
      await this.delegate.updateAgentSettings(message.providerId, patch);
      await this.refresh("設定を保存しました / Settings saved.");
    }
  }

  private setBusy(busy: boolean, message?: string): void {
    this.state = {
      ...this.state,
      busy,
      message: message ?? this.state.message
    };
    this.postState();
  }

  private postState(): void {
    void this.view?.webview.postMessage({
      type: "state",
      state: this.state
    });
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = cryptoNonce();
    const cspSource = webview.cspSource;
    const codiconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "codicon.ttf"));
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>TRIGEN-Orchestration</title>
  <style>
    ${codiconCss(codiconUri)}
    :root {
      --bg: var(--vscode-sideBar-background);
      --panel: var(--vscode-editorWidget-background);
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --accent: var(--vscode-button-background);
      --accentText: var(--vscode-button-foreground);
      --button2: var(--vscode-button-secondaryBackground);
      --button2Text: var(--vscode-button-secondaryForeground);
      --input: var(--vscode-input-background);
      --inputText: var(--vscode-input-foreground);
      --ok: #40c6a3;
      --five: var(--vscode-charts-blue, #4fc1ff);
      --weekly: #40c6a3;
      --warn: #d8a657;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8px;
      background: var(--bg);
      color: var(--text);
      font: 11px/1.35 var(--vscode-font-family);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 6px;
    }
    h1 {
      margin: 0;
      font-size: 13px;
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: 0;
    }
    .en,
    .enInline {
      color: var(--muted);
      font-size: 10px;
      font-weight: 400;
    }
    .statusLine {
      color: var(--muted);
      min-height: 15px;
      margin: 2px 0 6px;
    }
    .agents {
      display: grid;
      gap: 6px;
    }
    .agent {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 7px;
      padding: 7px;
    }
    .agentTop {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px;
      align-items: center;
      margin-bottom: 6px;
    }
    .agentName {
      display: flex;
      align-items: baseline;
      gap: 5px;
      min-width: 0;
      font-size: 12px;
      font-weight: 700;
    }
    .agentActions {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .pill {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 1px 6px;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.5;
      white-space: nowrap;
    }
    .pill.ready,
    .pill.linked { color: var(--ok); }
    .pill.setup { color: var(--warn); }
    button, select {
      font: 11px var(--vscode-font-family);
    }
    button {
      border: 0;
      border-radius: 5px;
      background: var(--button2);
      color: var(--button2Text);
      padding: 4px 7px;
      min-height: 24px;
      cursor: pointer;
    }
    button.primary {
      background: var(--accent);
      color: var(--accentText);
    }
    button:disabled, select:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .fields {
      display: grid;
      gap: 5px;
    }
    label {
      display: grid;
      grid-template-columns: minmax(92px, 38%) 1fr;
      gap: 6px;
      align-items: center;
      color: var(--text);
      font-weight: 600;
    }
    .labelText {
      display: flex;
      gap: 4px;
      align-items: baseline;
      min-width: 0;
      white-space: nowrap;
    }
    select {
      width: 100%;
      min-width: 0;
      color: var(--inputText);
      background: var(--input);
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 5px;
      padding: 4px 5px;
    }
    .meters {
      display: grid;
      gap: 5px;
      margin-top: 6px;
    }
    .meterTop {
      display: flex;
      justify-content: space-between;
      gap: 5px;
      color: var(--muted);
      font-size: 10px;
    }
    progress {
      width: 100%;
      height: 7px;
      border-radius: 999px;
    }
    progress.five { accent-color: var(--five); }
    progress.weekly { accent-color: var(--weekly); }
    .rulesBox {
      margin-top: 9px;
      border-top: 1px solid var(--border);
      padding-top: 8px;
      display: grid;
      gap: 5px;
    }
    .rulesActions {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: space-between;
    }
    .small {
      color: var(--muted);
      font-size: 10px;
      line-height: 1.35;
    }
    .refresh {
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      min-width: 28px;
      width: 32px;
      justify-content: center;
    }
    .rulesButton {
      min-width: 74px;
      border: 1px solid transparent;
    }
    .rulesButton.done:disabled {
      opacity: 1;
      background: var(--button2);
      color: var(--button2Text);
      border-color: var(--border);
    }
    .tokenUnavailable {
      color: var(--muted);
    }
    .meterNote {
      color: var(--muted);
      font-size: 10px;
    }
  </style>
</head>
<body>
  <header>
    <h1>TRIGEN-Orchestration</h1>
    <button id="refresh" class="refresh primary" title="状態を更新 / Refresh" aria-label="Refresh">
      <span class="codicon codicon-refresh" aria-hidden="true"></span>
    </button>
  </header>
  <div id="status" class="statusLine"></div>
  <div id="agents" class="agents"></div>
  <section class="rulesBox">
    <div class="rulesActions">
      <strong>.TRIGEN-Rules</strong>
      <button id="createRules" class="rulesButton primary">自動作成</button>
    </div>
    <div id="rulesHelp" class="small"></div>
  </section>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = { providers: [], busy: false };
    const statusEl = document.getElementById('status');
    const agentsEl = document.getElementById('agents');
    const createRulesButton = document.getElementById('createRules');
    const rulesHelpEl = document.getElementById('rulesHelp');

    document.getElementById('refresh').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });
    createRulesButton.addEventListener('click', () => {
      vscode.postMessage({ type: 'createRules' });
    });

    window.addEventListener('message', event => {
      if (event.data?.type === 'state') {
        state = event.data.state;
        render();
      }
    });

    function render() {
      statusEl.textContent = state.message || '';
      agentsEl.innerHTML = '';
      for (const provider of state.providers) {
        const item = document.createElement('section');
        item.className = 'agent';
        item.innerHTML = \`
          <div class="agentTop">
            <div class="agentName">
              <span>\${escapeHtml(provider.shortLabel)}</span>
              <span class="enInline">\${escapeHtml(provider.label)}</span>
            </div>
            <div class="agentActions">
              <span class="pill \${provider.status}">\${statusLabel(provider.status)}</span>
              <button class="primary" data-action="\${provider.linked ? 'logout' : 'login'}" data-provider="\${provider.id}">
                \${provider.linked ? 'Logout' : 'Login'}
              </button>
            </div>
          </div>
          <div class="fields">
            <label>
              <span class="labelText"><span>動作モデル</span><span class="enInline">Model</span></span>
              <select data-setting="model" data-provider="\${provider.id}">
                \${provider.modelOptions.map(option => \`<option value="\${escapeAttr(option)}" \${option === provider.settings.model ? 'selected' : ''}>\${escapeHtml(option)}</option>\`).join('')}
              </select>
            </label>
            <label>
              <span class="labelText"><span>推論</span><span class="enInline">Reasoning</span></span>
              <select data-setting="reasoningLevel" data-provider="\${provider.id}">
                \${provider.reasoningOptions.map(option => \`<option value="\${escapeAttr(option.id)}" title="\${escapeAttr(option.description || '')}" \${option.id === provider.settings.reasoningLevel ? 'selected' : ''}>\${escapeHtml(option.label)}</option>\`).join('')}
              </select>
            </label>
            <label>
              <span class="labelText"><span>権限</span><span class="enInline">Permission</span></span>
              <select data-setting="permission" data-provider="\${provider.id}">
                \${provider.permissionOptions.map(option => \`<option value="\${escapeAttr(option.id)}" title="\${escapeAttr(option.description || '')}" \${option.id === provider.settings.permission ? 'selected' : ''}>\${escapeHtml(option.label)}</option>\`).join('')}
              </select>
            </label>
          </div>
          <div class="meters">
            \${meter('five', '5時間', '5h', provider.usage.fiveHourRemainingPercent, provider.usage.fiveHourRefreshAt, provider.linked)}
            \${meter('weekly', '週間', 'Weekly', provider.usage.weeklyRemainingPercent, provider.usage.weeklyRefreshAt, provider.linked)}
          </div>
        \`;
        agentsEl.appendChild(item);
      }

      const exists = !!state.ruleStatus?.exists;
      createRulesButton.disabled = !!state.busy || exists;
      createRulesButton.classList.toggle('primary', !exists);
      createRulesButton.classList.toggle('done', exists);
      createRulesButton.textContent = exists ? '作成済み' : '自動作成';
      rulesHelpEl.textContent = exists
        ? '.TRIGEN-Rulesを最優先で読み込みます。エージェント名・色・共通ルールを編集できます。 / Loaded first. Edit agent names, colors, and shared rules.'
        : '.TRIGEN-Rulesをrepo直下に作成します。3エージェント共通の優先ルールを書けます。 / Creates .TRIGEN-Rules at the repo root for shared priority rules.';

      document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', () => {
          vscode.postMessage({ type: button.dataset.action, providerId: button.dataset.provider });
        });
      });
      document.querySelectorAll('[data-setting]').forEach(select => {
        select.addEventListener('change', () => {
          vscode.postMessage({
            type: 'setting',
            providerId: select.dataset.provider,
            key: select.dataset.setting,
            value: select.value
          });
        });
      });
      document.querySelectorAll('button, select').forEach(element => {
        if (element.id !== 'createRules') {
          element.disabled = !!state.busy;
        }
      });
      createRulesButton.disabled = !!state.busy || exists;
    }

    function statusLabel(status) {
      if (status === 'ready') return 'Linked';
      if (status === 'linked') return 'Linked';
      return 'Setup';
    }

    function meter(kind, ja, en, value, refreshAt, linked) {
      const hasValue = Number.isFinite(value);
      const percent = hasValue ? value : 0;
      const label = hasValue ? \`\${value}%\` : linked ? '公式取得口なし' : '未連携';
      const note = refreshAt || (linked ? '公式の安定した残量APIが無い場合は保存しません。' : 'Login後に連携状態を確認します。');
      return \`
        <div>
          <div class="meterTop">
            <span>\${ja} <span class="enInline">\${en}</span></span>
            <span class="\${hasValue ? '' : 'tokenUnavailable'}">\${escapeHtml(label)}</span>
          </div>
          <progress class="\${kind}" max="100" value="\${percent}"></progress>
          <div class="meterNote">\${escapeHtml(note)}</div>
        </div>
      \`;
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function escapeAttr(value) {
      return escapeHtml(value).replaceAll(String.fromCharCode(96), '&#096;');
    }
  </script>
</body>
</html>`;
  }
}

export class UnifiedChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: ChatViewState;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly delegate: TrigenViewDelegate
  ) {
    this.state = {
      threads: this.loadThreads(),
      attachments: [],
      busy: false,
      displayConfig: DEFAULT_TRIGEN_DISPLAY_CONFIG
    };
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    webviewView.webview.html = this.renderHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      void this.handleMessage(message);
    });
    this.state = {
      ...this.state,
      activeThreadId: undefined
    };
    this.postState();
    void this.refreshDisplayConfig();
  }

  async reveal(): Promise<void> {
    this.state = {
      ...this.state,
      activeThreadId: undefined
    };
    this.postState();
    await vscode.commands.executeCommand("trigen.integratedChat.focus");
    await this.refreshDisplayConfig();
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isChatMessage(message)) {
      return;
    }

    if (message.type === "openThread") {
      this.state = {
        ...this.state,
        activeThreadId: message.threadId,
        message: undefined
      };
      this.postState();
      return;
    }

    if (message.type === "backToThreads") {
      this.state = {
        ...this.state,
        activeThreadId: undefined,
        message: undefined
      };
      this.postState();
      return;
    }

    if (message.type === "newThread") {
      this.createThread();
      return;
    }

    if (message.type === "renameThread") {
      await this.renameActiveThread();
      return;
    }

    if (message.type === "exportThread") {
      await this.exportActiveThread();
      return;
    }

    if (message.type === "deleteThread") {
      await this.deleteActiveThread();
      return;
    }

    if (message.type === "attach") {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: true,
        title: "TRIGEN 添付 / Attach files"
      });
      if (uris?.length) {
        this.state = {
          ...this.state,
          attachments: [...this.state.attachments, ...uris.map((uri) => uri.fsPath)]
        };
        this.postState();
      }
      return;
    }

    if (message.type === "clearAttachment") {
      this.state = {
        ...this.state,
        attachments: this.state.attachments.filter((item) => item !== message.path)
      };
      this.postState();
      return;
    }

    if (message.type === "send") {
      await this.sendPrompt(message.prompt);
    }
  }

  private createThread(): void {
    const now = new Date().toISOString();
    const count = this.state.threads.length + 1;
    const thread: ChatThread = {
      id: newId("thread"),
      title: `Thread ${count}`,
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: newId("msg"),
          role: "system",
          text: SYSTEM_INTRO_TEXT,
          timestamp: now
        }
      ]
    };
    this.state = {
      ...this.state,
      threads: [thread, ...this.state.threads],
      activeThreadId: thread.id,
      attachments: [],
      message: undefined
    };
    void this.persistThreads();
    this.postState();
  }

  private async renameActiveThread(): Promise<void> {
    const thread = this.activeThread();
    if (!thread) {
      return;
    }
    const title = await vscode.window.showInputBox({
      title: "スレッド名を変更 / Rename thread",
      value: thread.title,
      ignoreFocusOut: true
    });
    const trimmed = title?.trim();
    if (!trimmed) {
      return;
    }
    this.replaceThread({
      ...thread,
      title: trimmed,
      updatedAt: new Date().toISOString()
    });
    this.state = {
      ...this.state,
      message: "スレッド名を変更しました / Thread renamed."
    };
    this.postState();
  }

  private async exportActiveThread(): Promise<void> {
    const thread = this.activeThread();
    if (!thread) {
      return;
    }
    await this.refreshDisplayConfig(false);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const defaultUri = workspaceFolder
      ? vscode.Uri.file(path.join(workspaceFolder, `${safeFileName(thread.title)}.md`))
      : undefined;
    const uri = await vscode.window.showSaveDialog({
      title: "Markdownに出力 / Export Markdown",
      defaultUri,
      filters: {
        Markdown: ["md"]
      }
    });
    if (!uri) {
      return;
    }
    await writeFile(uri.fsPath, formatMarkdownThread(thread, this.state.displayConfig), "utf8");
    this.state = {
      ...this.state,
      message: "Markdownに出力しました / Markdown exported."
    };
    this.postState();
  }

  private async deleteActiveThread(): Promise<void> {
    const thread = this.activeThread();
    if (!thread) {
      return;
    }
    const confirmation = await vscode.window.showWarningMessage(
      `「${thread.title}」を削除しますか？`,
      { modal: true },
      "スレッドを削除",
      "キャンセル"
    );
    if (confirmation !== "スレッドを削除") {
      return;
    }
    this.state = {
      ...this.state,
      activeThreadId: undefined,
      attachments: [],
      threads: this.state.threads.filter((item) => item.id !== thread.id),
      message: "スレッドを削除しました / Thread deleted."
    };
    void this.persistThreads();
    this.postState();
  }

  private async sendPrompt(prompt: string): Promise<void> {
    let thread = this.activeThread();
    if (!thread) {
      this.createThread();
      thread = this.activeThread();
    }
    if (!thread) {
      return;
    }

    const trimmed = prompt.trim();
    if (!trimmed) {
      this.state = {
        ...this.state,
        message: "入力してください / Enter a message."
      };
      this.postState();
      return;
    }

    const attachments = [...this.state.attachments];
    const userMessage: ChatMessage = {
      id: newId("msg"),
      role: "user",
      text: withAttachments(trimmed, attachments),
      timestamp: new Date().toISOString()
    };
    thread = appendMessages(thread, [userMessage]);
    this.replaceThread(thread, {
      attachments: [],
      busy: true,
      message: "TRIGENが文脈から処理経路を選択しています / TRIGEN is selecting a route from context."
    });

    try {
      await this.refreshDisplayConfig(false);
      const result = await this.delegate.dispatchImplicit(trimmed, attachments);
      const messages: ChatMessage[] = [
        {
          id: newId("msg"),
          role: "trigen",
          text: result.routeSummary,
          timestamp: new Date().toISOString()
        },
        ...result.results.map((item): ChatMessage => ({
          id: newId("msg"),
          role: "agent",
          providerId: item.providerId,
          text: providerResultText(item.ok, item.skipped, item.stdout, item.stderr, item.error),
          timestamp: item.endedAt
        }))
      ];
      this.replaceThread(appendMessages(this.activeThread() ?? thread, messages), {
        busy: false,
        message: "完了しました / Completed."
      });
    } catch (error) {
      this.replaceThread(appendMessages(this.activeThread() ?? thread, [
        {
          id: newId("msg"),
          role: "trigen",
          text: `エラー / Error: ${errorMessage(error)}`,
          timestamp: new Date().toISOString()
        }
      ]), {
        busy: false,
        message: errorMessage(error)
      });
    }
  }

  private activeThread(): ChatThread | undefined {
    return this.state.threads.find((thread) => thread.id === this.state.activeThreadId);
  }

  private replaceThread(thread: ChatThread, patch: Partial<Omit<ChatViewState, "threads">> = {}): void {
    const threads = this.state.threads.map((item) => item.id === thread.id ? thread : item);
    this.state = {
      ...this.state,
      ...patch,
      threads
    };
    void this.persistThreads();
    this.postState();
  }

  private loadThreads(): readonly ChatThread[] {
    const stored = this.context.workspaceState.get<readonly ChatThread[]>(CHAT_THREADS_KEY, []);
    return normalizeThreads(stored);
  }

  private async persistThreads(): Promise<void> {
    await this.context.workspaceState.update(CHAT_THREADS_KEY, this.state.threads);
  }

  private async refreshDisplayConfig(post = true): Promise<void> {
    this.state = {
      ...this.state,
      displayConfig: await this.delegate.getDisplayConfig()
    };
    if (post) {
      this.postState();
    }
  }

  private postState(): void {
    void this.view?.webview.postMessage({
      type: "state",
      state: this.state
    });
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = cryptoNonce();
    const cspSource = webview.cspSource;
    const codiconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "codicon.ttf"));
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>TRIGEN Unified Chat</title>
  <style>
    ${codiconCss(codiconUri)}
    :root {
      --bg: var(--vscode-sideBar-background);
      --panel: var(--vscode-editorWidget-background);
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --input: var(--vscode-input-background);
      --inputText: var(--vscode-input-foreground);
      --accent: var(--vscode-button-background);
      --accentText: var(--vscode-button-foreground);
      --button2: var(--vscode-button-secondaryBackground);
      --button2Text: var(--vscode-button-secondaryForeground);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 12px/1.42 var(--vscode-font-family);
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    #root {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }
    .statusBar {
      height: 36px;
      min-height: 36px;
      border-bottom: 1px solid var(--border);
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
      position: relative;
    }
    .threadsBar {
      grid-template-columns: 1fr auto;
    }
    .title {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
    }
    .statusText {
      padding: 5px 10px;
      color: var(--muted);
      font-size: 11px;
    }
    .threadList {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 8px;
      display: grid;
      align-content: start;
      gap: 6px;
    }
    .threadItem {
      width: 100%;
      text-align: left;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
      border-radius: 7px;
      padding: 8px;
      cursor: pointer;
    }
    .threadItemTitle {
      display: block;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .threadItemMeta,
    .threadItemPreview,
    .empty {
      color: var(--muted);
      font-size: 11px;
    }
    .messages {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 6px;
      display: grid;
      align-content: start;
      gap: 6px;
    }
    .bubble {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 7px;
      padding: 6px 7px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .bubble.user {
      background: var(--input);
      color: var(--inputText);
    }
    .bubble.trigen {
      border-color: var(--accent);
    }
    .bubble.system {
      padding: 4px 6px;
      color: var(--muted);
    }
    .bubble.system .messageHead {
      margin-bottom: 3px;
      font-size: 11px;
    }
    .bubble.system .messageText {
      line-height: 1.34;
    }
    .messageHead {
      margin-bottom: 3px;
      font-size: 11px;
    }
    .messageText {
      line-height: 1.36;
    }
    .messageFooter {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 5px;
      color: var(--muted);
      font-size: 10px;
    }
    .composer {
      border-top: 1px solid var(--border);
      padding: 7px;
      display: grid;
      gap: 5px;
    }
    textarea {
      width: 100%;
      min-height: 34px;
      max-height: 140px;
      resize: none;
      overflow-y: auto;
      color: var(--inputText);
      background: var(--input);
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 9px;
      padding: 8px 10px;
      font: 12px/1.35 var(--vscode-editor-font-family);
    }
    .attachments {
      display: grid;
      gap: 4px;
    }
    .attachment {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px;
      align-items: center;
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 4px 6px;
      font-size: 11px;
    }
    .bar {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 8px;
    }
    .composerBrand {
      color: var(--muted);
      font-size: 10px;
      text-align: center;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    button {
      border: 0;
      border-radius: 7px;
      min-width: 28px;
      min-height: 28px;
      padding: 0 8px;
      background: var(--button2);
      color: var(--button2Text);
      font: 13px var(--vscode-font-family);
      cursor: pointer;
    }
    button.icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: var(--text);
    }
    button.icon:hover:not(:disabled),
    button.icon:focus-visible {
      background: var(--vscode-toolbar-hoverBackground, var(--button2));
      outline: none;
    }
    button.attach {
      border: 1px solid var(--border);
      background: var(--input);
      color: var(--text);
    }
    button.attach:hover:not(:disabled) {
      background: var(--button2);
    }
    button.send {
      background: var(--accent);
      color: var(--accentText);
    }
    button.copy {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      min-height: 22px;
      padding: 0 6px;
    }
    button:disabled, textarea:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .optionMenu {
      display: none;
      position: absolute;
      right: 42px;
      top: 32px;
      z-index: 3;
      min-width: 150px;
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 7px;
      padding: 4px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
    }
    .optionMenu.open {
      display: grid;
      gap: 3px;
    }
    .optionMenu button {
      width: 100%;
      text-align: left;
      border-radius: 5px;
      justify-content: flex-start;
      background: transparent;
      color: var(--text);
      padding: 5px 8px;
      min-height: 26px;
    }
    .optionMenu button:hover {
      background: var(--vscode-list-hoverBackground, var(--button2));
    }
    .optionMenu button.danger {
      color: var(--vscode-errorForeground, #f48771);
    }
    .tooltipButton {
      position: relative;
    }
    .tooltipButton::after {
      content: attr(data-tooltip);
      position: absolute;
      z-index: 5;
      left: 50%;
      top: calc(100% + 5px);
      transform: translateX(-50%);
      opacity: 0;
      pointer-events: none;
      white-space: nowrap;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 3px 6px;
      background: var(--vscode-editorHoverWidget-background, var(--panel));
      color: var(--vscode-editorHoverWidget-foreground, var(--text));
      font-size: 10px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
      transition: opacity 80ms ease;
    }
    .tooltipButton:hover::after,
    .tooltipButton:focus-visible::after {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = { threads: [], attachments: [], busy: false, displayConfig: {} };
    let optionsOpen = false;
    const root = document.getElementById('root');

    window.addEventListener('message', event => {
      if (event.data?.type === 'state') {
        state = event.data.state;
        render();
      }
    });

    function render() {
      const active = state.threads.find(thread => thread.id === state.activeThreadId);
      root.innerHTML = active ? renderThread(active) : renderThreadList();
      bindCommon();
      if (active) {
        bindThread(active);
      } else {
        bindThreadList();
      }
    }

    function renderThreadList() {
      return \`
        <div class="statusBar threadsBar">
          <div class="title">Threads</div>
          <button class="icon tooltipButton" data-action="newThread" data-tooltip="新しいスレッド" title="新しいスレッド / New thread" aria-label="New thread"><span class="codicon codicon-edit" aria-hidden="true"></span></button>
        </div>
        \${state.message ? \`<div class="statusText">\${escapeHtml(state.message)}</div>\` : ''}
        <main class="threadList">
          \${state.threads.length === 0 ? '<div class="empty">スレッドはまだありません。右上のボタンで作成します。<br>No threads yet. Create one from the top-right button.</div>' : ''}
          \${state.threads.map(thread => \`
            <button class="threadItem" data-thread="\${escapeAttr(thread.id)}">
              <span class="threadItemTitle">\${escapeHtml(thread.title)}</span>
              <span class="threadItemMeta">\${escapeHtml(formatFullTime(thread.updatedAt))}</span>
              <span class="threadItemPreview">\${escapeHtml(threadPreview(thread))}</span>
            </button>
          \`).join('')}
        </main>
      \`;
    }

    function renderThread(thread) {
      return \`
        <div class="statusBar">
          <button class="icon tooltipButton" data-action="backToThreads" data-tooltip="戻る" title="戻る / Back" aria-label="Back"><span class="codicon codicon-arrow-left" aria-hidden="true"></span></button>
          <div class="title">\${escapeHtml(thread.title)}</div>
          <button class="icon tooltipButton" id="optionsButton" data-tooltip="オプション" title="オプション / Options" aria-label="Options"><span class="codicon codicon-ellipsis" aria-hidden="true"></span></button>
          <button class="icon tooltipButton" data-action="newThread" data-tooltip="新しいスレッド" title="新しいスレッド / New thread" aria-label="New thread"><span class="codicon codicon-edit" aria-hidden="true"></span></button>
          <div id="optionMenu" class="optionMenu \${optionsOpen ? 'open' : ''}">
            <button data-action="renameThread">スレッド名を変更</button>
            <button data-action="exportThread">Markdownに出力</button>
            <button class="danger" data-action="deleteThread">スレッドを削除</button>
          </div>
        </div>
        \${state.message ? \`<div class="statusText">\${escapeHtml(state.message)}</div>\` : ''}
        <main id="messages" class="messages">
          \${thread.messages.map(message => renderMessage(message)).join('')}
        </main>
        <section class="composer">
          <textarea id="prompt" rows="1" placeholder="Send Message."></textarea>
          <div id="attachments" class="attachments">
            \${state.attachments.map(path => \`
              <div class="attachment"><span>\${escapeHtml(path)}</span><button class="icon tooltipButton" data-tooltip="添付を外す" data-clear="\${escapeAttr(path)}" title="添付を外す / Remove attachment" aria-label="Remove attachment"><span class="codicon codicon-close" aria-hidden="true"></span></button></div>
            \`).join('')}
          </div>
          <div class="bar">
            <button id="attach" class="icon attach tooltipButton" data-tooltip="ファイル添付" title="ファイル添付 / Attach files" aria-label="Attach files"><span class="codicon codicon-add" aria-hidden="true"></span></button>
            <div class="composerBrand">TRIGEN-Orchestration</div>
            <button id="send" class="icon send tooltipButton" data-tooltip="送信" title="送信 / Send" aria-label="Send"><span class="codicon codicon-arrow-up" aria-hidden="true"></span></button>
          </div>
        </section>
      \`;
    }

    function renderMessage(message) {
      const display = message.providerId ? providerDisplay(message.providerId) : undefined;
      const head = display
        ? \`<strong style="color: \${sanitizeColor(display.color)}">\${escapeHtml(display.name)}</strong>\`
        : \`<strong>\${escapeHtml(roleName(message.role))}</strong>\`;
      return \`
        <article class="bubble \${message.role}">
          <div class="messageHead">\${head}</div>
          <div class="messageText">\${escapeHtml(message.text)}</div>
          <div class="messageFooter">
            <span>\${escapeHtml(formatFullTime(message.timestamp))}</span>
            <button class="copy icon tooltipButton" data-tooltip="コピー" data-copy="\${escapeAttr(message.id)}" title="コピー / Copy" aria-label="Copy"><span class="codicon codicon-copy" aria-hidden="true"></span></button>
          </div>
        </article>
      \`;
    }

    function bindCommon() {
      document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', () => {
          optionsOpen = false;
          vscode.postMessage({ type: button.dataset.action });
        });
      });
    }

    function bindThreadList() {
      document.querySelectorAll('[data-thread]').forEach(button => {
        button.addEventListener('click', () => {
          vscode.postMessage({ type: 'openThread', threadId: button.dataset.thread });
        });
      });
    }

    function bindThread(thread) {
      const optionsButton = document.getElementById('optionsButton');
      optionsButton?.addEventListener('click', () => {
        optionsOpen = !optionsOpen;
        render();
      });
      document.getElementById('attach')?.addEventListener('click', () => vscode.postMessage({ type: 'attach' }));
      document.getElementById('send')?.addEventListener('click', send);
      document.querySelectorAll('[data-clear]').forEach(button => {
        button.addEventListener('click', () => {
          vscode.postMessage({ type: 'clearAttachment', path: button.dataset.clear });
        });
      });
      document.querySelectorAll('[data-copy]').forEach(button => {
        button.addEventListener('click', async () => {
          const message = thread.messages.find(item => item.id === button.dataset.copy);
          if (message) {
            await navigator.clipboard.writeText(message.text);
          }
        });
      });
      const prompt = document.getElementById('prompt');
      prompt?.addEventListener('input', resizePrompt);
      prompt?.addEventListener('keydown', event => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          send();
        }
      });
      resizePrompt();
      document.querySelectorAll('button, textarea').forEach(element => {
        element.disabled = !!state.busy;
      });
      const messages = document.getElementById('messages');
      if (messages) {
        messages.scrollTop = messages.scrollHeight;
      }
    }

    function send() {
      const prompt = document.getElementById('prompt');
      vscode.postMessage({ type: 'send', prompt: prompt?.value || '' });
      if (prompt) {
        prompt.value = '';
        resizePrompt();
      }
    }

    function resizePrompt() {
      const prompt = document.getElementById('prompt');
      if (!prompt) return;
      prompt.style.height = '34px';
      prompt.style.height = Math.min(prompt.scrollHeight, 140) + 'px';
    }

    function threadPreview(thread) {
      const message = [...thread.messages].reverse().find(item => item.role !== 'system');
      return message ? message.text.slice(0, 100) : 'New thread';
    }

    function providerDisplay(providerId) {
      return state.displayConfig?.[providerId] || { name: providerName(providerId), color: '#ffffff' };
    }

    function providerName(providerId) {
      if (providerId === 'codex') return 'Codex';
      if (providerId === 'claude') return 'Claude';
      if (providerId === 'gemini') return 'Gemini';
      return providerId;
    }

    function roleName(role) {
      if (role === 'user') return 'User';
      if (role === 'trigen') return 'TRIGEN';
      if (role === 'system') return 'System';
      return 'Agent';
    }

    function formatFullTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const pad = number => String(number).padStart(2, '0');
      return \`\${date.getFullYear()} / \${pad(date.getMonth() + 1)} / \${pad(date.getDate())} / \${pad(date.getHours())} : \${pad(date.getMinutes())} . \${pad(date.getSeconds())}\`;
    }

    function sanitizeColor(value) {
      return /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#ffffff';
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function escapeAttr(value) {
      return escapeHtml(value).replaceAll(String.fromCharCode(96), '&#096;');
    }
  </script>
</body>
</html>`;
  }
}

type SettingsMessage =
  | { type: "refresh" }
  | { type: "createRules" }
  | { type: "login"; providerId: ProviderId }
  | { type: "logout"; providerId: ProviderId }
  | { type: "setting"; providerId: ProviderId; key: keyof AgentRuntimeSettings; value: string };

type ChatWebviewMessage =
  | { type: "openThread"; threadId: string }
  | { type: "backToThreads" }
  | { type: "newThread" }
  | { type: "renameThread" }
  | { type: "exportThread" }
  | { type: "deleteThread" }
  | { type: "attach" }
  | { type: "clearAttachment"; path: string }
  | { type: "send"; prompt: string };

function isSettingsMessage(value: unknown): value is SettingsMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SettingsMessage>;
  if (candidate.type === "refresh" || candidate.type === "createRules") {
    return true;
  }
  if ((candidate.type === "login" || candidate.type === "logout") && isProviderId(candidate.providerId)) {
    return true;
  }
  return candidate.type === "setting"
    && isProviderId(candidate.providerId)
    && (candidate.key === "model" || candidate.key === "reasoningLevel" || candidate.key === "permission")
    && typeof candidate.value === "string";
}

function isChatMessage(value: unknown): value is ChatWebviewMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ChatWebviewMessage>;
  if (
    candidate.type === "backToThreads"
    || candidate.type === "newThread"
    || candidate.type === "renameThread"
    || candidate.type === "exportThread"
    || candidate.type === "deleteThread"
    || candidate.type === "attach"
  ) {
    return true;
  }
  if (candidate.type === "openThread") {
    return typeof candidate.threadId === "string";
  }
  if (candidate.type === "clearAttachment") {
    return typeof candidate.path === "string";
  }
  return candidate.type === "send" && typeof candidate.prompt === "string";
}

function settingPatch(key: keyof AgentRuntimeSettings, value: string): Partial<AgentRuntimeSettings> | undefined {
  if (key === "model") {
    return { model: value };
  }
  if (key === "reasoningLevel") {
    return { reasoningLevel: value };
  }
  if (key === "permission") {
    return { permission: value };
  }
  return undefined;
}

function isProviderId(value: unknown): value is ProviderId {
  return value === "codex" || value === "claude" || value === "gemini";
}

function normalizeThreads(value: readonly ChatThread[]): readonly ChatThread[] {
  return value
    .filter((thread) => typeof thread.id === "string" && typeof thread.title === "string")
    .map((thread) => ({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt || new Date().toISOString(),
      updatedAt: thread.updatedAt || thread.createdAt || new Date().toISOString(),
      messages: Array.isArray(thread.messages)
        ? thread.messages.map((message) => ({
          id: message.id || newId("msg"),
          role: message.role,
          text: String(message.text ?? ""),
          timestamp: message.timestamp || new Date().toISOString(),
          providerId: message.providerId
        })).filter((message) => message.role === "user" || message.role === "trigen" || message.role === "agent" || message.role === "system")
        : []
    }));
}

function appendMessages(thread: ChatThread, messages: readonly ChatMessage[]): ChatThread {
  const now = new Date().toISOString();
  return {
    ...thread,
    messages: [...thread.messages, ...messages],
    updatedAt: now
  };
}

function withAttachments(prompt: string, attachments: readonly string[]): string {
  if (attachments.length === 0) {
    return prompt;
  }
  return `${prompt}\n\n添付 / Attachments:\n${attachments.map((item) => `- ${item}`).join("\n")}`;
}

function providerResultText(
  ok: boolean,
  skipped: boolean | undefined,
  stdout: string,
  stderr: string,
  error?: string
): string {
  const status = ok ? "完了 / OK" : skipped ? "未実行 / Skipped" : "失敗 / Failed";
  const output = stdout.trim() || stderr.trim() || error || "出力なし / No output.";
  return `${status}\n\n${output}`;
}

function formatMarkdownThread(thread: ChatThread, displayConfig: TrigenDisplayConfig): string {
  const lines = [`# ${thread.title}`, ""];
  for (const message of thread.messages) {
    const speaker = message.providerId
      ? displayConfig[message.providerId]?.name ?? message.providerId
      : message.role === "user"
        ? "User"
        : message.role === "trigen"
          ? "TRIGEN"
          : "System";
    lines.push(`## ${speaker}`);
    lines.push("");
    lines.push(`Timestamp: ${formatLocalTimestamp(message.timestamp)}`);
    lines.push("");
    lines.push(message.text);
    lines.push("");
  }
  return lines.join("\n");
}

function formatLocalTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()} / ${pad(date.getMonth() + 1)} / ${pad(date.getDate())} / ${pad(date.getHours())} : ${pad(date.getMinutes())} . ${pad(date.getSeconds())}`;
}

function codiconCss(codiconUri: vscode.Uri): string {
  return `
    @font-face {
      font-family: "codicon";
      src: url("${codiconUri.toString()}") format("truetype");
      font-display: block;
    }
    .codicon {
      display: inline-block;
      font: normal normal normal 16px/1 "codicon";
      text-rendering: auto;
      -webkit-font-smoothing: antialiased;
      text-align: center;
      vertical-align: middle;
    }
    .codicon-add:before { content: "\\ea60"; }
    .codicon-arrow-left:before { content: "\\ea9b"; }
    .codicon-arrow-up:before { content: "\\eaa1"; }
    .codicon-attach:before { content: "\\ec34"; }
    .codicon-check:before { content: "\\eab2"; }
    .codicon-close:before { content: "\\ea76"; }
    .codicon-copy:before { content: "\\ebcc"; }
    .codicon-edit:before { content: "\\ea73"; }
    .codicon-ellipsis:before { content: "\\ea7c"; }
    .codicon-link-external:before { content: "\\eb14"; }
    .codicon-refresh:before { content: "\\eb37"; }
    .codicon-send:before { content: "\\ec0f"; }
  `;
}

function safeFileName(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "trigen-thread";
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cryptoNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
