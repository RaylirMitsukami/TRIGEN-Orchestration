# Marketplace Description / Marketplace紹介文

## Short Description / 短い説明

Codex、Claude、GeminiをVS Code右カラムの3エージェント統合チャットで扱うオーケストレーション拡張。
A VS Code orchestration extension that operates Codex, Claude, and Gemini from a right-column 3-agent unified chat.

## Main Description / 詳細説明

TRIGEN-Orchestrationは、Codex、Claude、Geminiの3エージェントを1つのVS Codeワークスペースで扱うための拡張機能です。左カラムには簡潔なエージェント設定画面、右カラムには3エージェント統合チャットを配置します。
TRIGEN-Orchestration is a VS Code extension for operating Codex, Claude, and Gemini in one workspace. The left column contains concise agent settings, while the right column contains the 3-agent unified chat.

各エージェント専用チャット窓は持ちません。共有文脈は右カラムの統合チャットだけに集約されます。
It does not create dedicated per-agent chat windows. Shared context is centralized only in the right-column unified chat.

TRIGEN内部には、直列、並列、グループチャット、自律型ハンドオフの実行経路があります。ただし、ユーザーが明示的にモードを選ぶUIではありません。統合チャット内の指示や文脈から、TRIGENが内部処理経路を選択します。
TRIGEN internally supports serial, parallel, group chat, and autonomous handoff routes. The user does not select these through explicit mode buttons. TRIGEN chooses the internal route from the unified chat instruction and context.

左カラムの`TRIGEN-Orchestration`設定画面では、Codex、Claude、Geminiを上から順に表示します。各カードにはLogin/Logout、Linked/Setupステータス、モデル選択、推論レベル、権限設定、5時間/週間トークン残量メーターを配置します。
The left-column `TRIGEN-Orchestration` settings view lists Codex, Claude, and Gemini in order. Each card includes Login/Logout, Linked/Setup status, model selection, reasoning level, permission settings, and 5-hour/weekly token meters.

右カラムの統合チャット入力欄は、上段が入力欄、下段左端がVS Code標準アイコンの添付ボタン、下段中央が`TRIGEN-Orchestration`表示、下段右端がVS Code標準アイコンの送信ボタンです。チャット入力欄にはモデル選択や権限選択を置かず、エージェント設定に集約します。
The right-column chat composer has a top message input, a lower-left VS Code-standard attachment icon button, a lower-center `TRIGEN-Orchestration` label, and a lower-right VS Code-standard send icon button. Model and permission selectors are not placed in the chat input; they are centralized in the agent settings.

ワークスペースrepo内に`.TRIGEN-Rules`を置くと、TRIGENはそれを3エージェント連携の最優先ルールとして読み込みます。
If `.TRIGEN-Rules` exists in the workspace repository, TRIGEN loads it as the highest-priority rule file for 3-agent orchestration.

TRIGENは、各プロバイダーの公式アカウントと公式ランタイムの境界を尊重します。パスワード、Cookie、他拡張機能のSecret Storageを読みません。
TRIGEN respects provider boundaries for official accounts and official runtimes. It does not read passwords, cookies, or another extension's Secret Storage.

## Feature List / 機能一覧

- 左カラム設定ビュー / Left-column settings view
- 右カラム3エージェント統合チャット / Right-column 3-agent unified chat
- Codex、Claude、GeminiのLogin/Logout状態管理 / Login/Logout state management for Codex, Claude, and Gemini
- モデル、推論レベル、権限設定 / Model, reasoning level, and permission settings
- 5時間/週間トークン残量メーターUI / 5-hour and weekly token meter UI
- `.TRIGEN-Rules`優先読み込み / Priority loading for `.TRIGEN-Rules`
- 文脈による内部経路自動選択 / Context-based internal route selection
- VSIXパッケージ化とテスト / VSIX packaging and tests
