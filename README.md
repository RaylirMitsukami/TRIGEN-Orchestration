# TRIGEN-Orchestration

TRIGEN-Orchestration is a VS Code extension that coordinates Codex, Claude, and Gemini coding agents from one control surface.

The extension is designed as an orchestration layer, not as a replacement client. It detects official local execution surfaces, loads workspace rule files, builds a shared context bundle, and dispatches prompts through provider adapters.

## Current MVP

- Activity Bar control center for three provider lanes: Codex, Claude, Gemini.
- Provider health checks for official VS Code extensions and local CLIs.
- Workspace rule loading from `AGENTS.md`, `TRIGEN.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`.
- Dispatch modes:
  - Parallel: send one context bundle to all selected providers.
  - Serial: feed each provider result into the next provider.
  - Group: collect a single round from selected providers into one transcript.
  - Handoff: run an ordered provider chain and skip unavailable providers.
- Prompt artifacts under `.trigen/prompts/` for audit and manual reuse.
- Local estimated token accounting per run.

## Provider model

TRIGEN uses provider adapters. Each adapter has:

- Official extension IDs used for detection.
- CLI command candidates used for execution.
- Configurable command and argument templates.
- Stdin prompt delivery.

Codex is supported through `codex exec` when the Codex CLI is available. Claude and Gemini lanes are ready for their CLIs once installed and configured.

## Development

```bash
npm install
npm run compile
npm test
npm run vscode:package
```

Press `F5` in VS Code to launch the Extension Development Host, then open the TRIGEN Activity Bar view.

## Configuration

The most important settings are:

- `trigen.providers.codex.command`
- `trigen.providers.codex.args`
- `trigen.providers.claude.command`
- `trigen.providers.claude.args`
- `trigen.providers.gemini.command`
- `trigen.providers.gemini.args`
- `trigen.rules.fileNames`
- `trigen.execution.timeoutMs`

Use `${workspaceFolder}` inside provider argument arrays when a CLI needs the current workspace path.
