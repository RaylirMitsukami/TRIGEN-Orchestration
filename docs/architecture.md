# Architecture

TRIGEN-Orchestration is a VS Code extension that acts as a command router between the workspace and three coding agent surfaces: Codex, Claude, and Gemini.

## Core flow

1. The user enters a task in the TRIGEN control center.
2. TRIGEN loads workspace rule files.
3. TRIGEN captures lightweight workspace context such as the active file, selection, and git status.
4. TRIGEN builds a provider-specific prompt bundle.
5. TRIGEN dispatches the prompt with the selected mode.
6. Results are collected into the local transcript and the output channel.

## Modules

- `src/extension.ts`: VS Code activation, command registration, and controller wiring.
- `src/core/providers.ts`: provider definitions, command resolution, variable expansion, and process runner.
- `src/core/rules.ts`: rule file discovery and bounded reads.
- `src/core/orchestrator.ts`: parallel, serial, group, and handoff execution.
- `src/ui/controlCenter.ts`: Webview UI and message bridge.

## Provider adapters

Each provider adapter has a stable internal ID:

- `codex`
- `claude`
- `gemini`

Adapters are intentionally command-template based. This keeps TRIGEN usable across provider CLI changes without rewriting the extension. The default Codex adapter targets `codex exec --json`.

## Context bundle

The context bundle is explicit and auditable:

- User request
- Workspace folder
- Rule file excerpts
- Active editor file and selected text
- Git status summary
- Previous provider outputs when using serial or handoff mode

Prompt artifacts are written under `.trigen/prompts/` when enabled.
