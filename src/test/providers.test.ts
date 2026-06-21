import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandArgs, estimateTokens, shellQuote } from "../core/providers";

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
});
