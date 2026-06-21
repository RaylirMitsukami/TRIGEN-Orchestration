import * as vscode from "vscode";
import type {
  AgentRuntimeSettings,
  DispatchMode,
  ModelPermission,
  OrchestrationResult,
  ProviderControlState,
  ProviderHealth,
  ProviderId,
  ReasoningLevel,
  RuleBundle
} from "../core/types";

export interface IntegratedDispatchResult extends OrchestrationResult {
  readonly routeSummary: string;
}

export interface TrigenViewDelegate {
  getControlState(): Promise<readonly ProviderControlState[]>;
  healthCheck(): Promise<readonly ProviderHealth[]>;
  loadRules(): Promise<RuleBundle>;
  login(providerId: ProviderId): Promise<void>;
  logout(providerId: ProviderId): Promise<void>;
  updateAgentSettings(providerId: ProviderId, settings: Partial<AgentRuntimeSettings>): Promise<void>;
  dispatchImplicit(prompt: string, attachments: readonly string[]): Promise<IntegratedDispatchResult>;
}

interface SettingsViewState {
  providers: readonly ProviderControlState[];
  busy: boolean;
  message?: string;
}

interface ChatMessage {
  readonly role: "user" | "trigen" | "agent" | "system";
  readonly text: string;
  readonly timestamp: string;
  readonly providerId?: ProviderId;
}

interface ChatViewState {
  readonly messages: readonly ChatMessage[];
  readonly attachments: readonly string[];
  readonly busy: boolean;
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
      this.state = {
        providers: await this.delegate.getControlState(),
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

    if (message.type === "login") {
      this.setBusy(true, "ブラウザでログイン画面を開いています / Opening browser login...");
      await this.delegate.login(message.providerId);
      await this.refresh("ログイン連携を記録しました / Login link recorded.");
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
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>TRIGEN-Orchestration</title>
  <style>
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
      --warn: #d8a657;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      background: var(--bg);
      color: var(--text);
      font: 12px/1.45 var(--vscode-font-family);
    }
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0;
      font-size: 15px;
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: 0;
    }
    .en {
      display: block;
      color: var(--muted);
      font-size: 11px;
      font-weight: 400;
      margin-top: 2px;
    }
    .statusLine {
      color: var(--muted);
      min-height: 18px;
      margin: 4px 0 10px;
    }
    .agents {
      display: grid;
      gap: 8px;
    }
    .agent {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 8px;
      padding: 10px;
    }
    .agentTop {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: start;
      margin-bottom: 8px;
    }
    .agentName {
      font-size: 13px;
      font-weight: 700;
    }
    .agentActions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .pill {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 2px 7px;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.4;
      white-space: nowrap;
    }
    .pill.ready { color: var(--ok); }
    .pill.linked { color: var(--ok); }
    .pill.setup { color: var(--warn); }
    button, select {
      font: 12px var(--vscode-font-family);
    }
    button {
      border: 0;
      border-radius: 6px;
      background: var(--button2);
      color: var(--button2Text);
      padding: 5px 8px;
      min-height: 26px;
      cursor: pointer;
    }
    button.primary {
      background: var(--accent);
      color: var(--accentText);
    }
    button:disabled, select:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .fields {
      display: grid;
      gap: 7px;
    }
    label {
      display: grid;
      gap: 3px;
      color: var(--text);
      font-weight: 600;
    }
    select {
      width: 100%;
      color: var(--inputText);
      background: var(--input);
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 6px;
      padding: 5px 6px;
    }
    .meters {
      display: grid;
      gap: 7px;
      margin-top: 8px;
    }
    .meterTop {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      color: var(--muted);
      font-size: 11px;
    }
    progress {
      width: 100%;
      height: 7px;
      accent-color: var(--ok);
    }
    .context {
      color: var(--muted);
      margin-top: 8px;
      font-size: 11px;
    }
    .refresh {
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <header>
    <h1>TRIGEN-Orchestration<span class="en">Agent account settings</span></h1>
    <button id="refresh" class="refresh">更新<span class="en">Refresh</span></button>
  </header>
  <div id="status" class="statusLine"></div>
  <div id="agents" class="agents"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = { providers: [], busy: false };
    const statusEl = document.getElementById('status');
    const agentsEl = document.getElementById('agents');

    document.getElementById('refresh').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
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
            <div>
              <div class="agentName">\${escapeHtml(provider.shortLabel)}</div>
              <span class="en">\${escapeHtml(provider.label)}</span>
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
              動作モデル
              <span class="en">Model</span>
              <select data-setting="model" data-provider="\${provider.id}">
                \${provider.modelOptions.map(option => \`<option value="\${escapeAttr(option)}" \${option === provider.settings.model ? 'selected' : ''}>\${escapeHtml(option)}</option>\`).join('')}
              </select>
            </label>
            <label>
              推論レベル
              <span class="en">Reasoning level</span>
              <select data-setting="reasoningLevel" data-provider="\${provider.id}">
                \${reasoningOptions(provider.settings.reasoningLevel)}
              </select>
            </label>
            <label>
              モデル権限
              <span class="en">Model permission</span>
              <select data-setting="permission" data-provider="\${provider.id}">
                \${permissionOptions(provider.settings.permission)}
              </select>
            </label>
          </div>
          <div class="meters">
            \${meter('5時間トークン残量', '5-hour token remaining', provider.usage.fiveHourRemainingPercent, provider.usage.fiveHourRefreshAt, provider.linked)}
            \${meter('週間トークン残量', 'Weekly token remaining', provider.usage.weeklyRemainingPercent, provider.usage.weeklyRefreshAt, provider.linked)}
          </div>
          <div class="context">
            \${provider.webContextStatus === 'available-through-provider'
              ? 'Web版設定・メモリは公式ランタイム側で使用 / Web settings and memory are used through the provider runtime.'
              : 'Loginで公式アカウント連携を開始 / Login starts official account linking.'}
          </div>
        \`;
        agentsEl.appendChild(item);
      }

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
        element.disabled = !!state.busy;
      });
    }

    function statusLabel(status) {
      if (status === 'ready') return 'Ready';
      if (status === 'linked') return 'Linked';
      return 'Setup';
    }

    function reasoningOptions(selected) {
      return [
        ['low', 'Low'],
        ['medium', 'Medium'],
        ['high', 'High'],
        ['extra-high', 'Extra High']
      ].map(([value, label]) => \`<option value="\${value}" \${value === selected ? 'selected' : ''}>\${label}</option>\`).join('');
    }

    function permissionOptions(selected) {
      return [
        ['ask-every-time', 'Ask Every Time'],
        ['read-only', 'Read Only'],
        ['workspace-write', 'Workspace Write'],
        ['full-access', 'Full Access']
      ].map(([value, label]) => \`<option value="\${value}" \${value === selected ? 'selected' : ''}>\${label}</option>\`).join('');
    }

    function meter(ja, en, value, refreshAt, linked) {
      const percent = Number.isFinite(value) ? value : 0;
      const label = Number.isFinite(value)
        ? \`\${value}%\`
        : linked ? '未取得 / Not reported' : '未連携 / Not linked';
      const refresh = refreshAt || (linked ? '公式側の報告待ち / Waiting for provider' : 'Login後に更新 / Refresh after login');
      return \`
        <div>
          <div class="meterTop">
            <span>\${ja}<span class="en">\${en}</span></span>
            <span>\${escapeHtml(label)}</span>
          </div>
          <progress max="100" value="\${percent}"></progress>
          <span class="en">Refresh: \${escapeHtml(refresh)}</span>
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
  private state: ChatViewState = {
    messages: [
      {
        role: "system",
        text: "3エージェント統合チャットです。Codex / Claude / Gemini は、この窓の文脈だけを共有します。\nThis is the 3-agent unified chat. Codex, Claude, and Gemini share only this chat context.",
        timestamp: new Date().toISOString()
      }
    ],
    attachments: [],
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
    this.postState();
  }

  async reveal(): Promise<void> {
    await vscode.commands.executeCommand("trigen.integratedChat.focus");
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isChatMessage(message)) {
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

  private async sendPrompt(prompt: string): Promise<void> {
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
    this.state = {
      ...this.state,
      attachments: [],
      busy: true,
      message: "TRIGENが文脈から処理経路を選択しています / TRIGEN is selecting a route from context.",
      messages: [
        ...this.state.messages,
        {
          role: "user",
          text: withAttachments(trimmed, attachments),
          timestamp: new Date().toISOString()
        }
      ]
    };
    this.postState();

    try {
      const result = await this.delegate.dispatchImplicit(trimmed, attachments);
      this.state = {
        ...this.state,
        busy: false,
        message: "完了しました / Completed.",
        messages: [
          ...this.state.messages,
          {
            role: "trigen",
            text: result.routeSummary,
            timestamp: new Date().toISOString()
          },
          ...result.results.map((item): ChatMessage => ({
            role: "agent",
            providerId: item.providerId,
            text: providerResultText(item.providerId, item.ok, item.skipped, item.stdout, item.stderr, item.error),
            timestamp: item.endedAt
          }))
        ]
      };
    } catch (error) {
      this.state = {
        ...this.state,
        busy: false,
        message: errorMessage(error),
        messages: [
          ...this.state.messages,
          {
            role: "trigen",
            text: `エラー / Error: ${errorMessage(error)}`,
            timestamp: new Date().toISOString()
          }
        ]
      };
    }
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
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>TRIGEN Unified Chat</title>
  <style>
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
    html, body {
      height: 100%;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 12px/1.45 var(--vscode-font-family);
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    header {
      padding: 10px 12px 8px;
      border-bottom: 1px solid var(--border);
    }
    h1 {
      margin: 0;
      font-size: 14px;
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: 0;
    }
    .en {
      display: block;
      color: var(--muted);
      font-size: 11px;
      font-weight: 400;
      margin-top: 2px;
    }
    .status {
      padding: 6px 12px;
      color: var(--muted);
      min-height: 26px;
      border-bottom: 1px solid var(--border);
    }
    .messages {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 10px 10px 12px;
      display: grid;
      align-content: start;
      gap: 8px;
    }
    .bubble {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 8px;
      padding: 9px;
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
    .meta {
      color: var(--muted);
      font-size: 11px;
      margin-bottom: 5px;
    }
    .composer {
      border-top: 1px solid var(--border);
      padding: 8px;
      display: grid;
      gap: 6px;
    }
    textarea {
      width: 100%;
      min-height: 82px;
      max-height: 180px;
      resize: vertical;
      color: var(--inputText);
      background: var(--input);
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 8px;
      padding: 8px;
      font: 12px/1.45 var(--vscode-editor-font-family);
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
    }
    .bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    button {
      border: 0;
      border-radius: 7px;
      min-width: 30px;
      min-height: 30px;
      padding: 0 9px;
      background: var(--button2);
      color: var(--button2Text);
      font: 14px var(--vscode-font-family);
      cursor: pointer;
    }
    button.send {
      background: var(--accent);
      color: var(--accentText);
      font-weight: 700;
    }
    button:disabled, textarea:disabled {
      opacity: 0.55;
      cursor: default;
    }
  </style>
</head>
<body>
  <header>
    <h1>3エージェント統合チャット<span class="en">3-Agent Unified Chat</span></h1>
  </header>
  <div id="status" class="status"></div>
  <main id="messages" class="messages"></main>
  <section class="composer">
    <textarea id="prompt" placeholder="Codex / Claude / Gemini に共有する依頼を入力...&#10;Enter a request shared by Codex, Claude, and Gemini..."></textarea>
    <div id="attachments" class="attachments"></div>
    <div class="bar">
      <button id="attach" title="ファイル添付 / Attach files">＋</button>
      <button id="send" class="send" title="送信 / Send">↑</button>
    </div>
  </section>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = { messages: [], attachments: [], busy: false };
    const statusEl = document.getElementById('status');
    const messagesEl = document.getElementById('messages');
    const attachmentsEl = document.getElementById('attachments');
    const promptEl = document.getElementById('prompt');
    const attachButton = document.getElementById('attach');
    const sendButton = document.getElementById('send');

    attachButton.addEventListener('click', () => vscode.postMessage({ type: 'attach' }));
    sendButton.addEventListener('click', send);
    promptEl.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        send();
      }
    });

    window.addEventListener('message', event => {
      if (event.data?.type === 'state') {
        state = event.data.state;
        render();
      }
    });

    function send() {
      vscode.postMessage({ type: 'send', prompt: promptEl.value });
      promptEl.value = '';
    }

    function render() {
      statusEl.textContent = state.message || '';
      messagesEl.innerHTML = '';
      for (const message of state.messages) {
        const item = document.createElement('article');
        item.className = \`bubble \${message.role}\`;
        const name = message.providerId ? providerName(message.providerId) : roleName(message.role);
        item.innerHTML = \`
          <div class="meta">\${escapeHtml(name)} · \${escapeHtml(formatTime(message.timestamp))}</div>
          <div>\${escapeHtml(message.text)}</div>
        \`;
        messagesEl.appendChild(item);
      }
      attachmentsEl.innerHTML = '';
      for (const path of state.attachments) {
        const row = document.createElement('div');
        row.className = 'attachment';
        row.innerHTML = \`<span>\${escapeHtml(path)}</span><button data-clear="\${escapeAttr(path)}">×</button>\`;
        attachmentsEl.appendChild(row);
      }
      document.querySelectorAll('[data-clear]').forEach(button => {
        button.addEventListener('click', () => {
          vscode.postMessage({ type: 'clearAttachment', path: button.dataset.clear });
        });
      });
      document.querySelectorAll('button, textarea').forEach(element => {
        element.disabled = !!state.busy;
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function roleName(role) {
      if (role === 'user') return '博士 / User';
      if (role === 'trigen') return 'TRIGEN';
      if (role === 'system') return 'System';
      return 'Agent';
    }

    function providerName(providerId) {
      if (providerId === 'codex') return 'Codex';
      if (providerId === 'claude') return 'Claude';
      if (providerId === 'gemini') return 'Gemini';
      return providerId;
    }

    function formatTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  | { type: "login"; providerId: ProviderId }
  | { type: "logout"; providerId: ProviderId }
  | { type: "setting"; providerId: ProviderId; key: keyof AgentRuntimeSettings; value: string };

type ChatWebviewMessage =
  | { type: "attach" }
  | { type: "clearAttachment"; path: string }
  | { type: "send"; prompt: string };

function isSettingsMessage(value: unknown): value is SettingsMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SettingsMessage>;
  if (candidate.type === "refresh") {
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
  if (candidate.type === "attach") {
    return true;
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
  if (key === "reasoningLevel" && isReasoningLevel(value)) {
    return { reasoningLevel: value };
  }
  if (key === "permission" && isModelPermission(value)) {
    return { permission: value };
  }
  return undefined;
}

function isReasoningLevel(value: string): value is ReasoningLevel {
  return value === "low" || value === "medium" || value === "high" || value === "extra-high";
}

function isModelPermission(value: string): value is ModelPermission {
  return value === "ask-every-time" || value === "read-only" || value === "workspace-write" || value === "full-access";
}

function isProviderId(value: unknown): value is ProviderId {
  return value === "codex" || value === "claude" || value === "gemini";
}

function withAttachments(prompt: string, attachments: readonly string[]): string {
  if (attachments.length === 0) {
    return prompt;
  }
  return `${prompt}\n\n添付 / Attachments:\n${attachments.map((item) => `- ${item}`).join("\n")}`;
}

function providerResultText(
  providerId: ProviderId,
  ok: boolean,
  skipped: boolean | undefined,
  stdout: string,
  stderr: string,
  error?: string
): string {
  const status = ok ? "完了 / OK" : skipped ? "未実行 / Skipped" : "失敗 / Failed";
  const output = stdout.trim() || stderr.trim() || error || "出力なし / No output.";
  return `${providerId}: ${status}\n\n${output}`;
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
