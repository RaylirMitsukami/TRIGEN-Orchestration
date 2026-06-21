import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import type { RuleBundle, RuleDocument } from "./types";

export const DEFAULT_RULE_FILE_NAMES = [
  ".TRIGEN-Rules",
  "AGENTS.md",
  "TRIGEN.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".github/copilot-instructions.md"
] as const;

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
