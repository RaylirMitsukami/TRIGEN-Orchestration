# Provider Boundaries / プロバイダー境界

TRIGEN-Orchestrationは、Codex、Claude、Geminiの公式利用形態を尊重するVS Code拡張です。
TRIGEN-Orchestration is a VS Code extension that respects the official usage model of Codex, Claude, and Gemini.

## What TRIGEN Does / TRIGENが行うこと

- 各プロバイダーの公式ログイン画面を外部ブラウザで開きます。
  Opens each provider's official login page in an external browser.
- VS Code内でLogin/Logoutの連携状態を記録します。
  Records Login/Logout link state inside VS Code.
- 公式VS Code拡張機能とローカル実行コマンドを検出します。
  Detects official VS Code extensions and local execution commands.
- `.TRIGEN-Rules`を最優先にワークスペースルールを読み込みます。
  Loads workspace rules with `.TRIGEN-Rules` as the highest-priority file.
- 統合チャット文脈を各プロバイダー実行面へ渡します。
  Sends unified chat context to each provider runtime.
- モデル、推論レベル、権限設定をTRIGEN側の実行メタ情報として保持します。
  Stores model, reasoning level, and permission settings as TRIGEN runtime metadata.

## What TRIGEN Does Not Do / TRIGENが行わないこと

- プロバイダーWeb画面をスクレイピングしません。
  It does not scrape provider web pages.
- 他拡張機能のSecret Storageを読みません。
  It does not read another extension's Secret Storage.
- プロバイダーのパスワード、Cookie、セッション情報を保存しません。
  It does not store provider passwords, cookies, or session data.
- 非公開APIや利用規約回避によるトークン残量取得を行いません。
  It does not use private APIs or terms-bypassing methods to fetch token quotas.
- プロバイダーのWeb版メモリをTRIGEN内に複製保存しません。
  It does not duplicate provider web memory inside TRIGEN.

## Account Settings and Memory / アカウント設定とメモリ

プロバイダー側のWeb版設定やメモリは、公式拡張機能や公式ランタイムが利用可能な範囲で使用されます。TRIGENはそれらを直接盗み読むのではなく、各エージェントの公式実行面に統合チャット文脈を渡します。
Provider-side web settings and memory are used only to the extent that the official extension or runtime can use them. TRIGEN does not directly read them; it routes unified chat context into the provider's official runtime.

## Token Meters / トークンメーター

5時間トークン残量と週間トークン残量はUIとして実装されています。プロバイダーが安定した取得面を公開している場合は、その値を表示する設計です。現時点で取得面がない場合は`未取得 / Not reported`として表示します。
5-hour and weekly token meters are implemented in the UI. They are designed to show provider-reported values when a stable provider surface exists. If no supported surface exists, TRIGEN shows `Not reported`.

## Reliable Integration Path / 安定した連携手順

1. 公式Webまたは公式拡張機能で各プロバイダーへログインします。
   Sign in to each provider through the official web or extension surface.
2. 各プロバイダー単体で動作確認します。
   Confirm each provider works by itself.
3. TRIGENの左設定ビューでLoginとモデル設定を行います。
   Use the TRIGEN left settings view for Login and model settings.
4. 右統合チャットから依頼を送ります。
   Send requests from the right unified chat.
