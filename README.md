# TRIGEN-Orchestration

TRIGEN-Orchestrationは、VS Code上でCodex、Claude、Geminiの3エージェントを1つの統合チャットから扱うための拡張機能です。
TRIGEN-Orchestration is a VS Code extension for operating Codex, Claude, and Gemini from one unified 3-agent chat.

この拡張機能は、APIキー前提の独自AIクライアントではありません。各プラットフォームの公式アカウント、公式拡張機能、公式CLIなどの実行面を尊重し、TRIGEN側ではVS Code内の設定、ルール参照、統合チャット、オーケストレーション経路をまとめます。
This extension is not a custom API-key AI client. It respects each provider's official account, official extension, and official runtime surface, while TRIGEN provides VS Code settings, rule loading, unified chat, and orchestration routing.

## 画面構成 / Layout

- 左端Activity BarのTRIGENアイコンを開くと、左カラムに`TRIGEN-Orchestration`設定画面が表示されます。
  Opening the TRIGEN icon in the left Activity Bar shows the `TRIGEN-Orchestration` settings view in the left column.
- 右カラム上部のTRIGENアイコンを開くと、右カラム全体に`3エージェント統合チャット`が表示されます。
  Opening the TRIGEN icon in the right Secondary Side Bar shows the `3-Agent Unified Chat` in the right column.
- 統合チャットは右カラム内で完結します。中央エディタ領域にはチャット画面を表示しません。
  The unified chat stays in the right column and does not occupy the central editor area.
- 各エージェント専用チャット窓は廃止され、共有文脈は統合チャット窓だけに集約されます。
  Dedicated per-agent chat windows are removed; shared context is centralized only in the unified chat.

## 設定画面 / Settings View

設定画面には、上から`Codex`、`Claude`、`Gemini`の順番でエージェントカードが並びます。
The settings view lists agent cards in this order: `Codex`, `Claude`, `Gemini`.

各カードには次の項目があります。
Each card contains:

- `Login` / `Logout`ボタン。Loginは各プロバイダーの公式ログイン画面を外部ブラウザで開きます。
  `Login` / `Logout` button. Login opens the provider's official login page in an external browser.
- `Ready` / `Linked` / `Setup`ステータス。実行面が検出できる場合はReady、アカウント連携済みの場合はLinked、未設定の場合はSetupです。
  `Ready` / `Linked` / `Setup` status. Ready means a runtime is detected, Linked means account linking is recorded, and Setup means configuration is still needed.
- 動作モデル選択。例: `GPT-5.5`、`Opus 4.8`、`Gemini 3.1 Pro`。
  Model selection, for example `GPT-5.5`, `Opus 4.8`, and `Gemini 3.1 Pro`.
- 推論レベル選択。`Low`、`Medium`、`High`、`Extra High`。
  Reasoning level selection: `Low`, `Medium`, `High`, `Extra High`.
- モデル権限設定。`Ask Every Time`、`Read Only`、`Workspace Write`、`Full Access`。
  Model permission setting: `Ask Every Time`, `Read Only`, `Workspace Write`, `Full Access`.
- 5時間トークン残量と週間トークン残量のメーター、リフレッシュタイム表示。
  5-hour and weekly token remaining meters with refresh-time display.

トークン残量は、プロバイダーが安定した取得手段を公開している場合はその報告値を表示する設計です。公開手段がない場合、TRIGENは未取得として表示し、利用規約を回避する取得は行いません。
Token meters are designed to show provider-reported values when a stable provider surface is available. If no supported surface is available, TRIGEN shows the value as not reported and does not bypass provider terms.

## 統合チャット / Unified Chat

右カラムの`3エージェント統合チャット`は、Codex、Claude、Geminiへ共有する唯一の会話面です。
The right-column `3-Agent Unified Chat` is the single conversation surface shared by Codex, Claude, and Gemini.

チャット入力欄は上下二段構成です。
The chat composer uses a two-level layout.

- 上段: チャット入力欄。
  Upper area: message input.
- 下段左端: `＋`ファイル添付ボタン。
  Lower left: `+` file attachment button.
- 下段右端: `↑`送信ボタン。
  Lower right: `↑` send button.

チャット入力欄にはモデル選択や権限選択を置きません。モデルや権限は左カラムのエージェント設定に集約します。
The chat input does not contain model or permission selectors. Model and permission settings are centralized in the left settings view.

## オーケストレーション / Orchestration

TRIGEN内部には、直列、並列、グループチャット、自律型ハンドオフの実行経路があります。ただし、ユーザーが明示的にモードボタンを選ぶ構造ではありません。統合チャット内の指示や文脈から、TRIGENが内部処理経路を自動選択します。
TRIGEN internally supports serial, parallel, group chat, and autonomous handoff routes. The user does not choose these through explicit mode buttons. TRIGEN selects the internal route from the unified chat instruction and context.

## ワークスペースルール / Workspace Rules

VS Codeで開いているプロジェクトのrepo内に`.TRIGEN-Rules`を配置すると、TRIGENはこのファイルを3エージェント連携の最優先ルールとして読み込みます。
If a `.TRIGEN-Rules` file exists in the repository opened by VS Code, TRIGEN loads it as the highest-priority rule file for 3-agent orchestration.

既定の読み込み順は次の通りです。
The default rule loading order is:

1. `.TRIGEN-Rules`
2. `AGENTS.md`
3. `TRIGEN.md`
4. `CLAUDE.md`
5. `GEMINI.md`
6. `.github/copilot-instructions.md`

`.TRIGEN-Rules`には、3エージェント連携で必ず優先したい開発方針、禁止事項、出力形式、レビュー基準などを書けます。
Use `.TRIGEN-Rules` for development policies, prohibitions, output formats, review criteria, and any rule that should take priority in 3-agent collaboration.

## 使い方 / How To Use

1. VS Codeで対象repoを開きます。
   Open the target repository in VS Code.
2. 必要ならrepo直下に`.TRIGEN-Rules`を作成します。
   Create `.TRIGEN-Rules` at the repository root if needed.
3. 左Activity BarのTRIGENを開き、Codex、Claude、GeminiのLoginを実行します。
   Open TRIGEN from the left Activity Bar and run Login for Codex, Claude, and Gemini.
4. 各エージェントのモデル、推論レベル、権限を選択します。
   Select each agent's model, reasoning level, and permission.
5. 右Secondary Side BarのTRIGENを開き、統合チャットに依頼を書いて`↑`で送信します。
   Open TRIGEN in the right Secondary Side Bar, write a request in the unified chat, and send with `↑`.

## 開発 / Development

```bash
npm install
npm run compile
npm test
npm run vscode:package
```

Press `F5` in VS Code to launch the Extension Development Host.
