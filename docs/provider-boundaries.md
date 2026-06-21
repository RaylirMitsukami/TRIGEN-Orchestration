# Provider Boundaries

TRIGEN-Orchestration is built around official local execution surfaces.

## What TRIGEN does

- Detects official provider VS Code extensions when they are installed.
- Detects provider CLIs when they are available on the local machine.
- Sends prompts to configured provider commands through stdin.
- Keeps a local orchestration transcript.
- Lets users choose models through provider-native settings or configurable CLI arguments.

## What TRIGEN does not do

- It does not scrape provider webviews.
- It does not read another extension's secret storage.
- It does not store provider passwords.
- It does not impersonate provider applications.

## Practical integration path

The reliable path is:

1. Install and sign in to each provider's official VS Code extension or CLI.
2. Confirm each provider works on its own.
3. Point TRIGEN's command settings to the working CLI command.
4. Use TRIGEN to build shared context and coordinate dispatch.

This lets TRIGEN provide orchestration without taking over provider authentication internals.
