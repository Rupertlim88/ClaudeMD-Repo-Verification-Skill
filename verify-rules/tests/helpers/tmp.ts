// Test helpers: temporary folders and small git repos, removed when the test process ends.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const made: string[] = [];
process.on("exit", () => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

export function tmpDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  made.push(dir);
  return dir;
}

// Runs git in a folder as a fixed test identity, with no email address.
export function git(dir: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=verify-rules-test", "-c", "user.email=", ...args], {
    cwd: dir,
    encoding: "utf8",
  });
}

// A new git repo holding the given files (path from the repo root -> text), in one commit.
export function makeRepo(files: Record<string, string>): string {
  const repo = tmpDir("repo");
  git(repo, "init", "-q", "-b", "main");
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
    fs.writeFileSync(path.join(repo, name), text);
  }
  git(repo, "add", "--", ...Object.keys(files));
  git(repo, "commit", "-q", "-m", "first commit");
  return repo;
}
