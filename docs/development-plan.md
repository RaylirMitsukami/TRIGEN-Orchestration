# Development Plan / 開発計画

## Phase 1: VS Code Extension Skeleton / 拡張機能の基礎

- VS Code拡張機能としてビルド、テスト、VSIX化できる状態にする。
  Build, test, and package the project as a VS Code extension.
- Codex、Claude、Geminiのプロバイダー定義を持つ。
  Define Codex, Claude, and Gemini providers.
- 公式Webアカウント導線とCLI実行面を使い、公式VS Code拡張機能の有無には依存しない。
  Use official web-account linking and CLI runtime surfaces without depending on official VS Code extension installation.

Status: complete.

## Phase 2: Requested TRIGEN UI / 指定UI

- 左Activity BarのTRIGENアイコンから`TRIGEN-Orchestration`設定画面を開く。
  Open the `TRIGEN-Orchestration` settings view from the left Activity Bar TRIGEN icon.
- 右Secondary Side BarのTRIGENアイコンから`3エージェント統合チャット`を開く。
  Open the `3-Agent Unified Chat` from the right Secondary Side Bar TRIGEN icon.
- 各エージェント専用チャット窓を廃止する。
  Remove dedicated per-agent chat windows.
- 明示モードボタンを廃止し、文脈から内部経路を自動判定する。
  Remove explicit mode buttons and infer internal routes from context.
- `.TRIGEN-Rules`を最優先ルールとして読み込む。
  Load `.TRIGEN-Rules` as the highest-priority rule file.

Status: implemented.

## Phase 3: Provider Runtime Hardening / 実行面の強化

- プロバイダーごとのCLI出力パーサーを追加する。
  Add provider-specific CLI output parsers.
- モデル選択を各プロバイダーの実コマンド引数へ安全に接続する。Codexは実装済みで、Claude/Geminiは公式CLI仕様に合わせて個別強化する。
  Safely map model selection to provider command arguments. Codex is implemented; Claude/Gemini should be hardened per official CLI behavior.
- キャンセル、進捗表示、長時間実行の復旧を追加する。
  Add cancellation, progress, and long-run recovery.
- プロバイダーが公開する安定した取得面があればトークンメーターへ接続する。
  Connect token meters to stable provider-reported quota surfaces when available.

Status: next.

## Phase 4: Public Release / 公開準備

- Marketplace向けスクリーンショットを追加する。
  Add Marketplace screenshots.
- 正式カラーPNGロゴと単色SVGロゴを差し替える。
  Replace the provisional color PNG and monochrome SVG logos.
- GitHub ActionsでVSIXを継続パッケージ化する。
  Package VSIX artifacts through GitHub Actions.
- Marketplace公開手順を整える。
  Prepare Marketplace publishing.

Status: pending.
