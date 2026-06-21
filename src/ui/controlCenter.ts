import * as vscode from "vscode";
import type { DispatchMode, OrchestrationResult, ProviderHealth, ProviderId, RuleBundle } from "../core/types";

export interface ControlCenterDelegate {
  healthCheck(): Promise<readonly ProviderHealth[]>;
  loadRules(): Promise<RuleBundle>;
  dispatch(mode: DispatchMode, providers: readonly ProviderId[], prompt: string): Promise<OrchestrationResult>;
}

interface WebviewState {
  health: readonly ProviderHealth[];
  rules?: RuleBundle;
  transcript?: string;
  busy: boolean;
  message?: string;
}

export class ControlCenterProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: WebviewState = {
    health: [],
    busy: false
  };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly delegate: ControlCenterDelegate
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
    void this.refreshHealth();
  }

  async reveal(): Promise<void> {
    await vscode.commands.executeCommand("trigen.controlCenter.focus");
  }

  async refreshHealth(): Promise<void> {
    this.setBusy(true, "Running provider health check...");
    try {
      this.state = {
        ...this.state,
        health: await this.delegate.healthCheck(),
        message: "Health check complete."
      };
    } finally {
      this.setBusy(false);
    }
  }

  async refreshRules(): Promise<void> {
    this.setBusy(true, "Reloading workspace rules...");
    try {
      const rules = await this.delegate.loadRules();
      this.state = {
        ...this.state,
        rules,
        message: `Loaded ${rules.documents.length} rule file(s).`
      };
    } finally {
      this.setBusy(false);
    }
  }

  async dispatchFromCommand(mode: DispatchMode, prompt: string): Promise<void> {
    const providers = selectedProviderIds(this.state.health);
    await this.dispatch(mode, providers, prompt);
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isWebviewMessage(message)) {
      return;
    }

    if (message.type === "health") {
      await this.refreshHealth();
      return;
    }

    if (message.type === "rules") {
      await this.refreshRules();
      return;
    }

    if (message.type === "dispatch") {
      await this.dispatch(message.mode, message.providers, message.prompt);
    }
  }

  private async dispatch(mode: DispatchMode, providers: readonly ProviderId[], prompt: string): Promise<void> {
    if (!prompt.trim()) {
      this.state = {
        ...this.state,
        message: "Enter a task before dispatch."
      };
      this.postState();
      return;
    }

    this.setBusy(true, `Dispatching ${mode} run...`);
    try {
      const result = await this.delegate.dispatch(mode, providers, prompt);
      this.state = {
        ...this.state,
        transcript: result.transcript,
        message: `Completed ${mode} run with ${result.results.length} provider result(s).`
      };
    } catch (error) {
      this.state = {
        ...this.state,
        message: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.setBusy(false);
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
<html lang="en">
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
      --danger: var(--vscode-errorForeground);
      --ok: #40c6a3;
      --warn: #d8a657;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14px;
      background: var(--bg);
      color: var(--text);
      font: 12px/1.45 var(--vscode-font-family);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .status {
      color: var(--muted);
      min-height: 18px;
      margin-bottom: 10px;
    }
    .providers {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }
    .provider {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 8px;
      padding: 10px;
    }
    .providerTop {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }
    .provider label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 650;
    }
    .pill {
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 11px;
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .pill.ready { color: var(--ok); }
    .pill.missing { color: var(--warn); }
    .notes {
      color: var(--muted);
      white-space: pre-wrap;
    }
    textarea {
      width: 100%;
      min-height: 132px;
      resize: vertical;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 6px;
      padding: 9px;
      font: 12px/1.45 var(--vscode-editor-font-family);
      margin-bottom: 10px;
    }
    .modes, .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    button {
      border: 0;
      border-radius: 6px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      padding: 7px 8px;
      font: 12px var(--vscode-font-family);
      cursor: pointer;
      min-height: 30px;
    }
    button.primary {
      background: var(--accent);
      color: var(--accentText);
    }
    button:disabled {
      opacity: 0.55;
      cursor: default;
    }
    pre {
      margin: 0;
      padding: 10px;
      max-height: 300px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--vscode-textCodeBlock-background);
      color: var(--text);
      font: 11px/1.45 var(--vscode-editor-font-family);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .sectionTitle {
      margin: 14px 0 7px;
      color: var(--muted);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0;
    }
  </style>
</head>
<body>
  <header>
    <h1>TRIGEN</h1>
    <button id="health">Health</button>
  </header>
  <div id="status" class="status"></div>
  <div id="providers" class="providers"></div>
  <textarea id="prompt" placeholder="Describe the coding task for Codex, Claude, and Gemini..."></textarea>
  <div class="modes">
    <button class="primary" data-mode="parallel">Parallel</button>
    <button data-mode="serial">Serial</button>
    <button data-mode="group">Group</button>
    <button data-mode="handoff">Handoff</button>
  </div>
  <div class="actions">
    <button id="rules">Reload Rules</button>
    <button id="clear">Clear</button>
  </div>
  <div class="sectionTitle">Transcript</div>
  <pre id="transcript">No run yet.</pre>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = { health: [], busy: false };
    const providersEl = document.getElementById('providers');
    const statusEl = document.getElementById('status');
    const promptEl = document.getElementById('prompt');
    const transcriptEl = document.getElementById('transcript');

    window.addEventListener('message', event => {
      if (event.data?.type === 'state') {
        state = event.data.state;
        render();
      }
    });

    document.getElementById('health').addEventListener('click', () => {
      vscode.postMessage({ type: 'health' });
    });
    document.getElementById('rules').addEventListener('click', () => {
      vscode.postMessage({ type: 'rules' });
    });
    document.getElementById('clear').addEventListener('click', () => {
      promptEl.value = '';
    });
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => {
        const providers = Array.from(document.querySelectorAll('[data-provider]:checked')).map(input => input.value);
        vscode.postMessage({
          type: 'dispatch',
          mode: button.dataset.mode,
          providers,
          prompt: promptEl.value
        });
      });
    });

    function render() {
      statusEl.textContent = state.busy ? (state.message || 'Working...') : (state.message || '');
      providersEl.innerHTML = '';
      for (const provider of state.health) {
        const item = document.createElement('div');
        item.className = 'provider';
        const checked = provider.ready ? 'checked' : '';
        item.innerHTML = \`
          <div class="providerTop">
            <label><input data-provider type="checkbox" value="\${provider.id}" \${checked}> \${provider.label}</label>
            <span class="pill \${provider.ready ? 'ready' : 'missing'}">\${provider.ready ? 'ready' : 'setup'}</span>
          </div>
          <div class="notes">\${escapeHtml(provider.notes.join('\\n'))}</div>
        \`;
        providersEl.appendChild(item);
      }
      transcriptEl.textContent = state.transcript || 'No run yet.';
      document.querySelectorAll('button, textarea, input').forEach(element => {
        element.disabled = !!state.busy;
      });
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }
  </script>
</body>
</html>`;
  }
}

type WebviewMessage =
  | { type: "health" }
  | { type: "rules" }
  | { type: "dispatch"; mode: DispatchMode; providers: ProviderId[]; prompt: string };

function isWebviewMessage(value: unknown): value is WebviewMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<WebviewMessage>;
  if (candidate.type === "health" || candidate.type === "rules") {
    return true;
  }
  return candidate.type === "dispatch"
    && isMode(candidate.mode)
    && Array.isArray(candidate.providers)
    && candidate.providers.every(isProviderId)
    && typeof candidate.prompt === "string";
}

function isMode(value: unknown): value is DispatchMode {
  return value === "parallel" || value === "serial" || value === "group" || value === "handoff";
}

function isProviderId(value: unknown): value is ProviderId {
  return value === "codex" || value === "claude" || value === "gemini";
}

function selectedProviderIds(health: readonly ProviderHealth[]): ProviderId[] {
  const ready = health.filter((item) => item.ready).map((item) => item.id);
  return ready.length > 0 ? ready : ["codex", "claude", "gemini"];
}

function cryptoNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
