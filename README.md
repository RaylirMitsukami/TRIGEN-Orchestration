# TRIGEN-Orchestration

TRIGEN-Orchestrationは、VS Code上でCodex、Claude、Geminiの3エージェントを1つの統合チャットから扱うための拡張機能です。
TRIGEN-Orchestration is a VS Code extension for operating Codex, Claude, and Gemini from one unified 3-agent chat.

この拡張機能は、APIキー前提の独自AIクライアントではありません。各プラットフォームの公式アカウント、公式CLI、公式実行面を尊重し、TRIGEN側ではVS Code内の設定、ルール参照、統合チャット、オーケストレーション経路をまとめます。
This extension is not a custom API-key AI client. It respects each provider's official account, official CLI, and official runtime surface, while TRIGEN provides VS Code settings, rule loading, unified chat, and orchestration routing.

## 画面構成 / Layout

- 左端Activity BarのTRIGENアイコンを開くと、左カラムに`TRIGEN-Orchestration`設定画面が表示されます。
  Opening the TRIGEN icon in the left Activity Bar shows the `TRIGEN-Orchestration` settings view in the left column.
- 右カラム上部のTRIGENアイコンを開くと、まずスレッド一覧が右カラム全体に表示されます。スレッドを選ぶと、そのスレッドの統合チャットへ移動します。
  Opening the TRIGEN icon in the right Secondary Side Bar first shows the thread list. Selecting a thread opens that unified chat thread.
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
- 推論レベル選択。選択中のモデルに応じて、`Low`、`Medium`、`High`、`Extra High`、`Max`などから選べる項目が変わります。
  Reasoning level selection. Available choices such as `Low`, `Medium`, `High`, `Extra High`, and `Max` change by selected model.
- モデル権限設定。選択中のモデルに応じて、`Ask Every Time`、`Read Only`、`Workspace Write`、`Full Access`から選べる項目が変わります。
  Model permission setting. Available choices among `Ask Every Time`, `Read Only`, `Workspace Write`, and `Full Access` change by selected model.
- 5時間トークン残量と週間トークン残量のメーター、リフレッシュタイム表示。
  5-hour and weekly token remaining meters with refresh-time display.
- `.TRIGEN-Rules`自動生成ボタン。repo直下に既に存在する場合は無効化されます。
  `.TRIGEN-Rules` generation button. It is disabled when the file already exists at the repository root.

トークン残量は、プロバイダーが安定した取得手段を公開している場合はその報告値を表示する設計です。公開手段がない場合、TRIGENは未取得として表示し、利用規約を回避する取得は行いません。
Token meters are designed to show provider-reported values when a stable provider surface is available. If no supported surface is available, TRIGEN shows the value as not reported and does not bypass provider terms.

## 統合チャット / Unified Chat

右カラムの`3エージェント統合チャット`は、Codex、Claude、Geminiへ共有する唯一の会話面です。右TRIGENアイコンを開くとスレッド一覧が表示され、スレッドごとに会話、添付、Markdown出力を管理します。
The right-column `3-Agent Unified Chat` is the single conversation surface shared by Codex, Claude, and Gemini. Opening the right TRIGEN icon shows a thread list, and each thread manages conversation, attachments, and Markdown export.

チャット入力欄は、無記入時は一行表示で`Send Message.`を表示します。
The chat composer is one line when empty and shows `Send Message.` as the placeholder.

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

`.TRIGEN-Rules`内の`1. Agents Name`と`2. Agents Color`は、統合チャット内のエージェント表示名と表示色に直接反映されます。
`1. Agents Name` and `2. Agents Color` in `.TRIGEN-Rules` directly control agent display names and colors in the unified chat.

既定の読み込み順は次の通りです。
The default rule loading order is:

1. `.TRIGEN-Rules`
2. `TRIGEN.md`
3. `AGENTS.md`
4. `CODEX.md`
5. `CLAUDE.md`
6. `GEMINI.md`
7. `.github/copilot-instructions.md`

`.TRIGEN-Rules`には、3エージェント連携で必ず優先したい開発方針、禁止事項、出力形式、レビュー基準などを書けます。
Use `.TRIGEN-Rules` for development policies, prohibitions, output formats, review criteria, and any rule that should take priority in 3-agent collaboration.

## 使い方 / How To Use

1. VS Codeで対象repoを開きます。
   Open the target repository in VS Code.
2. 左カラム最下部の自動生成ボタンで、必要ならrepo直下に`.TRIGEN-Rules`を作成します。
   Use the generation button at the bottom of the left column to create `.TRIGEN-Rules` at the repository root when needed.
3. 左Activity BarのTRIGENを開き、Codex、Claude、GeminiのLoginを実行します。
   Open TRIGEN from the left Activity Bar and run Login for Codex, Claude, and Gemini.
4. 各エージェントのモデル、推論レベル、権限を選択します。
   Select each agent's model, reasoning level, and permission.
5. 右Secondary Side BarのTRIGENを開き、スレッドを選ぶか新規作成して、統合チャットに依頼を書いて`↑`で送信します。
   Open TRIGEN in the right Secondary Side Bar, select or create a thread, write a request in the unified chat, and send with `↑`.

## 開発 / Development

```bash
npm install
npm run compile
npm test
npm run vscode:package
```

Press `F5` in VS Code to launch the Extension Development Host.
