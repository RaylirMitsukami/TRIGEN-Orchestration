# Logo Guidelines / ロゴ規定

TRIGEN-Orchestrationは、2種類のロゴを使います。
TRIGEN-Orchestration uses two logo variants.

## 1. カラーロゴ / Color Logo

用途: VS Code拡張機能検索一覧、Marketplace、README、GitHub上の視覚表示。
Purpose: VS Code extension search results, Marketplace, README, and GitHub visual presentation.

現在の実装パス: `media/trigen-logo-color.png`
Current implementation path: `media/trigen-logo-color.png`

`package.json`では次のように参照します。
It is referenced in `package.json` as:

```json
{
  "icon": "media/trigen-logo-color.png"
}
```

### 推奨仕様 / Recommended Spec

- 形式: PNG
  Format: PNG
- サイズ: 128x128px以上、推奨256x256px
  Size: at least 128x128px, recommended 256x256px
- 背景: 透明または濃淡が安定した単色背景
  Background: transparent or stable solid-color background
- 余白: 小さい表示でも潰れないよう、外周に適度な余白を残す
  Padding: keep enough outer padding so it remains legible at small sizes
- 文字: 小さな文字は避ける
  Text: avoid tiny text
- 配色: Marketplaceの明暗テーマ上で見分けやすいコントラストにする
  Color: use enough contrast for both light and dark Marketplace surfaces

### 差し替え手順 / Replacement Steps

1. 正式カラーロゴを`media/trigen-logo-color.png`として保存します。
   Save the final color logo as `media/trigen-logo-color.png`.
2. ファイル名を変える場合は`package.json`の`icon`も更新します。
   If the filename changes, update `package.json` `icon`.
3. `npm run verify`を実行します。
   Run `npm run verify`.
4. 生成されたVSIXを再インストールして、拡張機能一覧で表示を確認します。
   Reinstall the generated VSIX and check the extension list display.

## 2. 単色ロゴ / Monochrome Logo

用途: 左Activity BarのTRIGENアイコン、右Secondary Side Bar上部のTRIGENアイコン。
Purpose: TRIGEN icon in the left Activity Bar and the right Secondary Side Bar.

現在の実装パス: `media/trigen-mono.svg`
Current implementation path: `media/trigen-mono.svg`

`package.json`では次のように参照します。
It is referenced in `package.json` as:

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "trigen",
          "title": "TRIGEN",
          "icon": "media/trigen-mono.svg"
        }
      ],
      "secondarySidebar": [
        {
          "id": "trigenUnifiedChat",
          "title": "TRIGEN",
          "icon": "media/trigen-mono.svg"
        }
      ]
    }
  }
}
```

### 推奨仕様 / Recommended Spec

- 形式: SVG
  Format: SVG
- viewBox: `0 0 24 24`推奨
  viewBox: `0 0 24 24` recommended
- 色: `currentColor`のみを使う
  Color: use `currentColor` only
- 装飾: グラデーション、影、複数色、細かすぎる文字を使わない
  Decoration: avoid gradients, shadows, multiple colors, and tiny text
- 線幅: 24px表示で潰れない太さにする
  Stroke width: thick enough to remain clear at 24px
- 形状: Activity Barで白黒反転されても意味が残るシルエットにする
  Shape: keep a silhouette that remains meaningful when VS Code recolors it

### SVG例 / SVG Example

```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 5.5H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M12 5.5V19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M6 19L12 9.5L18 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="9.5" r="1.6" fill="currentColor"/>
</svg>
```

### 差し替え手順 / Replacement Steps

1. 正式単色ロゴを`media/trigen-mono.svg`として保存します。
   Save the final monochrome logo as `media/trigen-mono.svg`.
2. SVG内の色指定は`currentColor`だけにします。
   Use only `currentColor` for SVG color.
3. `npm run verify`を実行します。
   Run `npm run verify`.
4. VSIXを再インストールし、左Activity Barと右Secondary Side Barで表示確認します。
   Reinstall the VSIX and verify the icon in the left Activity Bar and right Secondary Side Bar.
