# TRIGEN-Orchestration ロゴ規定

## カラーロゴ

- 用途: Marketplace、README、GitHub上の表示。
- パス: `media/trigen-logo-color.png`
- 形式: PNG。
- 推奨サイズ: 256x256px。
- 小さい表示でも潰れないよう、外周に余白を残す。
- 明暗テーマのどちらでも見分けられるコントラストにする。
- ファイル名を変える場合は`package.json`の`icon`も更新する。

## 単色ロゴ

- 用途: 左Activity Bar、右Secondary Side BarのTRIGENアイコン。
- パス: `media/trigen-mono.svg`
- 形式: SVG。
- `viewBox="0 0 24 24"`を基本にする。
- 色指定は`currentColor`だけにする。
- グラデーション、影、複数色、細かすぎる文字は使わない。
- ファイル名を変える場合は`package.json`の`viewsContainers`内の`icon`も更新する。

## 確認

1. ロゴを差し替える。
2. `npm run verify`を実行する。
3. 生成されたVSIXを再インストールし、拡張機能一覧、左Activity Bar、右Secondary Side Barで表示を確認する。
