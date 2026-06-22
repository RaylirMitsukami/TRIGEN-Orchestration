import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";

describe("control center UI source", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "ui", "controlCenter.ts"), "utf8");

  it("uses VS Code Codicons for compact toolbar controls", () => {
    for (const icon of [
      "codicon-add",
      "codicon-arrow-left",
      "codicon-arrow-up",
      "codicon-copy",
      "codicon-edit",
      "codicon-ellipsis",
      "codicon-refresh"
    ]) {
      assert.match(source, new RegExp(icon));
    }
  });

  it("includes hover tooltips and guarded thread deletion", () => {
    assert.match(source, /tooltipButton/);
    assert.match(source, /deleteThread/);
    assert.match(source, /showWarningMessage/);
    assert.match(source, /スレッドを削除/);
    assert.equal(source.includes('"キャンセル"'), false);
  });

  it("renders provider status logs outside the chat transcript", () => {
    assert.match(source, /Status Info/);
    assert.match(source, /copyStatusLog/);
    assert.match(source, /cleanProviderOutput/);
    assert.match(source, /extractCodexAgentText/);
  });

  it("does not render old literal text controls or dead quota labels", () => {
    for (const fragment of [
      ">＋<",
      ">↑<",
      ">←<",
      ">…<",
      ">□<",
      "□🖊️",
      "Web版設定",
      "Not reported",
      "Provider reported time unavailable",
      "公式の安定した残量APIが無い場合は保存しません。",
      "gemini-3.5-flash"
    ]) {
      assert.equal(source.includes(fragment), false, fragment);
    }
  });
});
