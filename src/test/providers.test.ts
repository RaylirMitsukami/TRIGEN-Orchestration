import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandArgs, estimateTokens, getModelProfile, getProviderDefinition, shellQuote } from "../core/providers";

describe("providers", () => {
  it("expands workspace variables in command args", () => {
    assert.deepEqual(
      expandArgs(["exec", "-C", "${workspaceFolder}", "-"], { workspaceFolder: "/tmp/repo" }),
      ["exec", "-C", "/tmp/repo", "-"]
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

  it("does not route Gemini through an extension dependency", () => {
    const gemini = getProviderDefinition("gemini");

    assert.equal(gemini.label, "Gemini");
    assert.deepEqual(gemini.officialExtensionIds, []);
    assert.equal(gemini.loginUrl, "https://gemini.google.com/");
  });

  it("uses model-specific reasoning and permission profiles", () => {
    assert.deepEqual(getModelProfile("claude", "Sonnet 4.6").reasoningLevels, ["low", "medium", "high", "max"]);
    assert.deepEqual(getModelProfile("claude", "Opus 4.8").reasoningLevels, ["low", "medium", "high", "extra-high", "max"]);
    assert.deepEqual(getModelProfile("claude", "Haiku 4.5").permissions, ["ask-every-time", "read-only", "workspace-write"]);
  });
});
