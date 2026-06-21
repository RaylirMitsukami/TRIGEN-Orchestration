import * as assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  DEFAULT_RULE_FILE_NAMES,
  DEFAULT_TRIGEN_RULES_TEMPLATE,
  loadRuleBundle,
  parseTrigenDisplayConfig,
  renderRuleBundle
} from "../core/rules";

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
    await writeFile(path.join(workspace, "TRIGEN.md"), "trigen markdown", "utf8");
    await writeFile(path.join(workspace, "AGENTS.md"), "agents fallback", "utf8");
    await writeFile(path.join(workspace, "CODEX.md"), "codex rules", "utf8");
    await writeFile(path.join(workspace, "CLAUDE.md"), "claude rules", "utf8");
    await writeFile(path.join(workspace, "GEMINI.md"), "gemini rules", "utf8");
    await mkdir(path.join(workspace, ".github"));
    await writeFile(path.join(workspace, ".github", "copilot-instructions.md"), "copilot rules", "utf8");

    const bundle = await loadRuleBundle(workspace, DEFAULT_RULE_FILE_NAMES, 1000);

    assert.deepEqual([...DEFAULT_RULE_FILE_NAMES], [
      ".TRIGEN-Rules",
      "TRIGEN.md",
      "AGENTS.md",
      "CODEX.md",
      "CLAUDE.md",
      "GEMINI.md",
      ".github/copilot-instructions.md"
    ]);
    assert.deepEqual(bundle.documents.map((document) => document.path), [
      ".TRIGEN-Rules",
      "TRIGEN.md",
      "AGENTS.md",
      "CODEX.md",
      "CLAUDE.md",
      "GEMINI.md",
      path.join(".github", "copilot-instructions.md")
    ]);
  });

  it("parses agent display names and colors from .TRIGEN-Rules", () => {
    const display = parseTrigenDisplayConfig(`[ TRIGEN-Orchestration Rules ]

1. Agents Name :
Codex : [ Reipi-Codex ]
Claude : [ Review-Claude ]
Gemini : [ Search-Gemini ]

2. Agents Color :
Codex : [ #ffcc00 ]
Claude : [ #00ffaa ]
Gemini : [ invalid ]

3. TRIGEN-Orchestration Rules :
`);

    assert.equal(display.codex.name, "Reipi-Codex");
    assert.equal(display.codex.color, "#ffcc00");
    assert.equal(display.claude.name, "Review-Claude");
    assert.equal(display.claude.color, "#00ffaa");
    assert.equal(display.gemini.name, "Search-Gemini");
    assert.equal(display.gemini.color, "#ffffff");
  });

  it("keeps the generated .TRIGEN-Rules template minimal and editable", () => {
    assert.match(DEFAULT_TRIGEN_RULES_TEMPLATE, /\[ TRIGEN-Orchestration Rules \]/);
    assert.match(DEFAULT_TRIGEN_RULES_TEMPLATE, /1\. Agents Name :/);
    assert.match(DEFAULT_TRIGEN_RULES_TEMPLATE, /Codex : \[ Codex \]/);
    assert.match(DEFAULT_TRIGEN_RULES_TEMPLATE, /2\. Agents Color :/);
    assert.match(DEFAULT_TRIGEN_RULES_TEMPLATE, /Gemini : \[ #ffffff \]/);
    assert.match(DEFAULT_TRIGEN_RULES_TEMPLATE, /3\. TRIGEN-Orchestration Rules :\n$/);
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
