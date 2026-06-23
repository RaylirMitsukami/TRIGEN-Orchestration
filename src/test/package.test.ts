import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";

interface PackageManifest {
  readonly version: string;
  readonly main: string;
  readonly activationEvents?: readonly string[];
  readonly contributes?: {
    readonly commands?: readonly { readonly command: string; readonly title: string }[];
    readonly views?: Record<string, readonly { readonly id: string; readonly type?: string }[]>;
  };
}

describe("extension manifest", () => {
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as PackageManifest;

  it("activates explicitly for TRIGEN views and commands", () => {
    assert.deepEqual(new Set(manifest.activationEvents), new Set([
      "onStartupFinished",
      "onView:trigen.settings",
      "onView:trigen.integratedChat",
      "onCommand:trigen.openSettings",
      "onCommand:trigen.openIntegratedChat",
      "onCommand:trigen.openConsole",
      "onCommand:trigen.runHealthCheck",
      "onCommand:trigen.loadRules",
      "onCommand:trigen.openGeminiCloudApiActivation"
    ]));
  });

  it("contributes every command registered by the extension", () => {
    const commandIds = new Set(manifest.contributes?.commands?.map((command) => command.command));
    for (const commandId of [
      "trigen.openSettings",
      "trigen.openIntegratedChat",
      "trigen.openConsole",
      "trigen.runHealthCheck",
      "trigen.loadRules",
      "trigen.openGeminiCloudApiActivation"
    ]) {
      assert.equal(commandIds.has(commandId), true, commandId);
    }
  });

  it("contributes both webview IDs registered by the extension", () => {
    const views = manifest.contributes?.views ?? {};
    assert.equal(views.trigen?.some((view) => view.id === "trigen.settings" && view.type === "webview"), true);
    assert.equal(views.trigenUnifiedChat?.some((view) => view.id === "trigen.integratedChat" && view.type === "webview"), true);
  });
});
