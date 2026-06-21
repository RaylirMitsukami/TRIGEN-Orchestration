import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orchestrate } from "../core/orchestrator";
import type { OrchestrationRequest, ProviderRunRequest, ProviderRunResult } from "../core/types";

describe("orchestrator", () => {
  it("runs parallel providers without prior output", async () => {
    const seen: ProviderRunRequest[] = [];
    const result = await orchestrate(baseRequest("parallel"), async (request) => {
      seen.push(request);
      return fakeResult(request.providerId, request.prompt);
    });

    assert.equal(result.results.length, 2);
    assert.equal(seen.length, 2);
    assert.match(seen[0]?.prompt ?? "", /No prior provider output/);
  });

  it("feeds serial output into the next provider prompt", async () => {
    const seen: ProviderRunRequest[] = [];
    await orchestrate(baseRequest("serial"), async (request) => {
      seen.push(request);
      return fakeResult(request.providerId, `${request.providerId} output`);
    });

    assert.equal(seen.length, 2);
    assert.match(seen[1]?.prompt ?? "", /codex output/);
  });
});

function baseRequest(mode: "parallel" | "serial"): OrchestrationRequest {
  return {
    mode,
    providers: ["codex", "claude"],
    userPrompt: "fix the bug",
    workspaceFolder: "/repo",
    ruleBundle: {
      workspaceFolder: "/repo",
      documents: [{ path: "AGENTS.md", content: "rules", truncated: false }],
      totalBytes: 5,
      maxBytes: 1000
    },
    snapshot: {
      workspaceFolder: "/repo",
      gitStatus: "## main"
    }
  };
}

function fakeResult(providerId: "codex" | "claude" | "gemini", stdout: string): ProviderRunResult {
  return {
    providerId,
    ok: true,
    stdout,
    stderr: "",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 0,
    estimatedPromptTokens: 1,
    estimatedOutputTokens: 1
  };
}
