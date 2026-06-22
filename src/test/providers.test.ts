import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandArgs, estimateTokens, getModelProfile, getProviderDefinition, PROVIDERS, shellQuote } from "../core/providers";

describe("providers", () => {
  it("expands workspace variables in command args", () => {
    assert.deepEqual(
      expandArgs(["exec", "-C", "${workspaceFolder}", "--model", "${model}", "--sandbox", "${codexSandbox}", "-"], {
        workspaceFolder: "/tmp/repo",
        model: "gpt-5.5",
        codexSandbox: "workspace-write"
      }),
      ["exec", "-C", "/tmp/repo", "--model", "gpt-5.5", "--sandbox", "workspace-write", "-"]
    );
  });

  it("estimates tokens from characters", () => {
    assert.equal(estimateTokens("12345678"), 2);
    assert.equal(estimateTokens(""), 0);
  });

  it("quotes shell values when needed", () => {
    assert.equal(shellQuote("codex"), "codex");
    assert.equal(shellQuote("hello world"), "'hello world'");
  });

  it("does not route providers through official VS Code extension dependencies", () => {
    for (const provider of PROVIDERS) {
      assert.deepEqual(provider.officialExtensionIds, []);
      assert.deepEqual(provider.authProviderIds, []);
    }
  });

  it("uses current Gemini model names", () => {
    const gemini = getProviderDefinition("gemini");
    assert.equal(gemini.label, "Gemini");
    assert.equal(gemini.loginUrl, "https://gemini.google.com/");
    assert.deepEqual(gemini.commandCandidates, ["gemini", "npx"]);
    assert.deepEqual(gemini.modelOptions.map((item) => item.name), [
      "gemini-3.1-pro-preview",
      "gemini-3.5-flash",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite"
    ]);
    assert.equal(gemini.modelOptions.some((item) => item.name === "Gemini 3.1 Flash"), false);
  });

  it("uses model-specific reasoning and permission profiles", () => {
    assert.deepEqual(getModelProfile("claude", "opus").reasoningLevels.map((item) => item.id), ["low", "medium", "high", "xhigh", "max"]);
    assert.deepEqual(getModelProfile("claude", "sonnet").reasoningLevels.map((item) => item.id), ["low", "medium", "high", "max"]);
    assert.deepEqual(getModelProfile("claude", "haiku").reasoningLevels.map((item) => item.id), ["auto"]);
    assert.deepEqual(getModelProfile("gemini", "gemini-3.1-pro-preview").reasoningLevels.map((item) => item.id), ["low", "medium", "high"]);
    assert.deepEqual(getModelProfile("gemini", "gemini-3.5-flash").reasoningLevels.map((item) => item.id), ["minimal", "low", "medium", "high"]);
    assert.deepEqual(getModelProfile("codex", "gpt-5.5").permissions.map((item) => item.id), [
      "read-only",
      "workspace-write",
      "danger-full-access"
    ]);
    assert.deepEqual(getModelProfile("gemini", "gemini-3.5-flash").permissions.map((item) => item.id), [
      "plan",
      "default",
      "auto_edit",
      "yolo"
    ]);
  });
});
