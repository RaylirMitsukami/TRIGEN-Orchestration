import * as assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DEFAULT_RULE_FILE_NAMES, loadRuleBundle, renderRuleBundle } from "../core/rules";

describe("rules", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(path.join(os.tmpdir(), "trigen-rules-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("loads configured rule files in order", async () => {
    await writeFile(path.join(workspace, "AGENTS.md"), "alpha", "utf8");
    await mkdir(path.join(workspace, ".github"));
    await writeFile(path.join(workspace, ".github", "copilot-instructions.md"), "beta", "utf8");

    const bundle = await loadRuleBundle(workspace, ["AGENTS.md", ".github/copilot-instructions.md"], 1000);

    assert.equal(bundle.documents.length, 2);
    assert.equal(bundle.documents[0]?.path, "AGENTS.md");
    assert.equal(bundle.documents[1]?.path, path.join(".github", "copilot-instructions.md"));
    assert.match(renderRuleBundle(bundle), /alpha/);
    assert.match(renderRuleBundle(bundle), /beta/);
  });

  it("treats .TRIGEN-Rules as the default highest priority rule file", async () => {
    await writeFile(path.join(workspace, ".TRIGEN-Rules"), "trigen priority", "utf8");
    await writeFile(path.join(workspace, "AGENTS.md"), "agents fallback", "utf8");

    const bundle = await loadRuleBundle(workspace, DEFAULT_RULE_FILE_NAMES, 1000);

    assert.equal(DEFAULT_RULE_FILE_NAMES[0], ".TRIGEN-Rules");
    assert.equal(bundle.documents[0]?.path, ".TRIGEN-Rules");
    assert.equal(bundle.documents[1]?.path, "AGENTS.md");
  });

  it("rejects path traversal entries", async () => {
    const bundle = await loadRuleBundle(workspace, ["../AGENTS.md"], 1000);
    assert.equal(bundle.documents.length, 0);
  });

  it("truncates by byte budget", async () => {
    await writeFile(path.join(workspace, "AGENTS.md"), "1234567890", "utf8");
    const bundle = await loadRuleBundle(workspace, ["AGENTS.md"], 4);
    assert.equal(bundle.documents[0]?.content, "1234");
    assert.equal(bundle.documents[0]?.truncated, true);
  });
});
