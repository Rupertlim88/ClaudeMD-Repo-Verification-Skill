// Python's adapter, the TypeScript side: it runs python_ast.py under the repo's own interpreter, once per batch of
// files, isolated, in an empty temporary folder, and reads its JSON answer.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FileFacts, Language } from "./language.ts";

const HELPER = fileURLToPath(new URL("./python_ast.py", import.meta.url));

function runHelper(interpreter: string, command: string, input: unknown): unknown {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "verify-rules-python-"));
  try {
    const run = spawnSync(interpreter, ["-I", HELPER, command],
      { cwd, input: JSON.stringify(input), encoding: "utf8", maxBuffer: 1 << 30 });
    if (run.error !== undefined) throw run.error;
    if (run.status !== 0) throw new Error(`python_ast.py ${command} failed with exit ${run.status}: ${run.stderr}`);
    return JSON.parse(run.stdout);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

export function pythonLanguage(interpreter: string): Language {
  return {
    name: "Python",
    extensions: [".py"],
    facts: (files) => new Map(Object.entries(runHelper(interpreter, "facts", files) as Record<string, FileFacts>)),
  };
}
