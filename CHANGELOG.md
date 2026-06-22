# Changelog

## 0.1.4

- Fixed Codex CLI execution by removing the unsupported `--ask-for-approval` argument from `codex exec` dispatch.
- Added automatic official npm CLI fallback through `npx` for Claude Code and Gemini when `claude` or `gemini` are not on PATH.
- Added a visible Gemini CLI authentication terminal path and `GOOGLE_GENAI_USE_GCA=true` runtime environment for API-key-free Gemini CLI use.
- Added a Gemini CLI compression workaround for Google Code Assist responses and a `trigen.providers.gemini.googleCloudProject` setting for standard-tier project routing.
- Kept token quota meters visible for further experiments while preserving the no-scraping/no-cookie-storage boundary.
- Added thread deletion with confirmation, hover highlighting, and lightweight tooltips for unified chat controls.
- Tightened chat message spacing and made `.TRIGEN-Rules` disabled state look like a disabled button.

## 0.1.3

- Corrected Claude Code effort choices per model: Opus/Fable support `low` through `max`, Sonnet uses `low`, `medium`, `high`, and `max`, and Haiku uses provider default effort.
- Added Claude Code runtime argument mapping for `--model`, `--permission-mode`, and supported `--effort` values when no custom CLI argument template is configured.

## 0.1.2

- Replaced literal toolbar glyphs with bundled VS Code Codicons in the settings and unified chat webviews.
- Removed official VS Code extension dependency checks and switched provider linking to browser-login confirmation without storing cookies or session tokens.
- Updated model, reasoning, and permission profiles for Codex, Claude Code, and Gemini, including `gemini-3.5-flash` and `gemini-3.1-flash-lite`.
- Routed Codex model/reasoning/permission settings into CLI execution arguments.
- Clarified unavailable provider quota reporting without unsupported scraping or credential access.
- Tightened `.TRIGEN-Rules` priority wording in templates and provider dispatch prompts.
- Updated timestamps to `YYYY / MM / DD / hh : mm . ss` format and compacted the unified chat chrome.

## 0.1.1

- Repackaged the refined TRIGEN UI and rules implementation as a distinct installable version so VS Code cannot keep showing the stale 0.1.0 extension.

## 0.1.0

- Initial TRIGEN-Orchestration VS Code extension scaffold.
- Added left-column `TRIGEN-Orchestration` settings view.
- Added right-column `3-Agent Unified Chat` view.
- Added Codex, Claude, and Gemini Login/Logout state, model, reasoning, permission, and token meter UI.
- Added implicit route inference for serial, parallel, group chat, and autonomous handoff.
- Added `.TRIGEN-Rules` as the highest-priority workspace rule file.
- Added `.TRIGEN-Rules` generation, agent display name/color parsing, and the requested workspace rule load order.
- Added compact agent settings, model-specific reasoning/permission choices, and colored 5-hour/weekly token meters.
- Added thread-based unified chat with rename, Markdown export, per-message timestamps, and copy buttons.
