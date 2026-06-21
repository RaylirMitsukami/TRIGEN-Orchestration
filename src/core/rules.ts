import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import type { ProviderId, RuleBundle, RuleDocument, TrigenDisplayConfig } from "./types";

export const TRIGEN_RULES_FILE_NAME = ".TRIGEN-Rules";

export const DEFAULT_RULE_FILE_NAMES = [
  TRIGEN_RULES_FILE_NAME,
  "TRIGEN.md",
  "AGENTS.md",
  "CODEX.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".github/copilot-instructions.md"
] as const;

export const DEFAULT_TRIGEN_DISPLAY_CONFIG: TrigenDisplayConfig = {
  codex: { name: "Codex", color: "#ffffff" },
  claude: { name: "Claude", color: "#ffffff" },
  gemini: { name: "Gemini", color: "#ffffff" }
};

export const DEFAULT_TRIGEN_RULES_TEMPLATE = `[ TRIGEN-Orchestration Rules ]

1. Agents Name :
Codex : [ Codex ]
Claude : [ Claude ]
Gemini : [ Gemini ]

2. Agents Color :
Codex : [ #ffffff ]
Claude : [ #ffffff ]
Gemini : [ #ffffff ]

3. TRIGEN-Orchestration Rules :
`;

export async function loadRuleBundle(
  workspaceFolder: string,
  fileNames: readonly string[],
  maxBytes: number
): Promise<RuleBundle> {
  const documents: RuleDocument[] = [];
  let remainingBytes = maxBytes;
  let totalBytes = 0;

  for (const fileName of fileNames) {
    if (remainingBytes <= 0) {
      break;
    }

    const absolutePath = safeWorkspacePath(workspaceFolder, fileName);
    if (!absolutePath) {
      continue;
    }

    const fileStat = await maybeStat(absolutePath);
    if (!fileStat?.isFile()) {
      continue;
    }

    const buffer = await readFile(absolutePath);
    const slice = buffer.subarray(0, remainingBytes);
    const truncated = buffer.length > slice.length;
    const content = slice.toString("utf8");

    documents.push({
      path: path.relative(workspaceFolder, absolutePath),
      content,
      truncated
    });

    totalBytes += slice.length;
    remainingBytes -= slice.length;
  }

  return {
    workspaceFolder,
    documents,
    totalBytes,
    maxBytes
  };
}

export function renderRuleBundle(bundle: RuleBundle): string {
  if (bundle.documents.length === 0) {
    return "No workspace rule files were found.";
  }

  return bundle.documents
    .map((document) => {
      const truncationNote = document.truncated ? "\n[TRIGEN: file truncated by max byte limit]" : "";
      return `## ${document.path}\n\n${document.content}${truncationNote}`;
    })
    .join("\n\n---\n\n");
}

export function parseTrigenDisplayConfig(content: string): TrigenDisplayConfig {
  const next: TrigenDisplayConfig = {
    codex: { ...DEFAULT_TRIGEN_DISPLAY_CONFIG.codex },
    claude: { ...DEFAULT_TRIGEN_DISPLAY_CONFIG.claude },
    gemini: { ...DEFAULT_TRIGEN_DISPLAY_CONFIG.gemini }
  };
  let section: "name" | "color" | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^1\.\s*Agents Name\s*:/i.test(line)) {
      section = "name";
      continue;
    }
    if (/^2\.\s*Agents Color\s*:/i.test(line)) {
      section = "color";
      continue;
    }
    if (/^3\.\s*TRIGEN-Orchestration Rules\s*:/i.test(line)) {
      section = undefined;
      continue;
    }

    const match = /^(Codex|Claude|Gemini)\s*:\s*\[\s*(.*?)\s*\]\s*$/i.exec(line);
    if (!match || !section) {
      continue;
    }
    const providerId = providerIdFromLabel(match[1]);
    const value = match[2]?.trim() ?? "";
    if (!providerId || !value) {
      continue;
    }
    if (section === "name") {
      next[providerId] = {
        ...next[providerId],
        name: value.slice(0, 48)
      };
    } else if (/^#[0-9a-f]{6}$/i.test(value)) {
      next[providerId] = {
        ...next[providerId],
        color: value.toLowerCase()
      };
    }
  }

  return next;
}

function safeWorkspacePath(workspaceFolder: string, fileName: string): string | undefined {
  const absoluteWorkspace = path.resolve(workspaceFolder);
  const resolved = path.resolve(absoluteWorkspace, fileName);
  const relative = path.relative(absoluteWorkspace, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  return resolved;
}

async function maybeStat(filePath: string) {
  try {
    return await stat(filePath);
  } catch {
    return undefined;
  }
}

function providerIdFromLabel(value: string): ProviderId | undefined {
  const normalized = value.toLowerCase();
  if (normalized === "codex") {
    return "codex";
  }
  if (normalized === "claude") {
    return "claude";
  }
  if (normalized === "gemini") {
    return "gemini";
  }
  return undefined;
}
