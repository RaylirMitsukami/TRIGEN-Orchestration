# TRIGEN-Orchestration Agent Instructions

This repository is a standalone public VS Code extension project. Do not import REI:FA, PROJECT_REI, or private research assumptions into design, implementation, documentation, or release decisions.

## Product Direction

- Build a practical VS Code extension that orchestrates Codex, Claude, and Gemini coding agents.
- Prefer official provider extensions, official CLIs, and user-configured commands as the execution surface.
- Keep provider credentials outside TRIGEN unless a provider offers a documented integration path.
- Make behavior inspectable: write prompt artifacts, log provider command lines, and show per-provider status clearly.

## Engineering Rules

- Implement real behavior before writing aspirational docs.
- Keep the extension usable when only one provider is installed.
- All provider command arguments must be configurable through VS Code settings.
- Do not scrape another extension's webview, storage, or credentials.
- Add tests for core orchestration, rule loading, and provider command handling.
- Before claiming completion, run `npm test`, `npm audit`, and `npm run vscode:package`.

## Repository Standard

- TypeScript strict mode stays enabled.
- Node built-in `node:test` is preferred over heavier test frameworks.
- Marketplace artifacts must not include source tests, source maps, local prompt artifacts, or dependency folders.
