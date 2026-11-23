// An in-memory repo for the tie check's tests: the given files (path from the repo root -> text); the files on disk
// that git ignores; the files the test runner collects tests from, and those it loads as settings. With the fixtures
// of senior-thesis-research's tie check tests.
import type { ExemptConfig, RepoView } from "../../rules/tie-check.ts";

export function memoryRepo(files: Record<string, string>,
  { ignored = [], collected = [], runnerConfig = [] }: { ignored?: string[]; collected?: string[]; runnerConfig?: string[] } = {}): RepoView {
  return {
    root: "/memory",
    files: Object.keys(files).sort(),
    read(file) {
      if (!(file in files)) throw new Error(`no file ${file}`);
      return files[file];
    },
    ignoredOnDisk: new Set(ignored),
    collected: new Set(collected),
    runnerConfig: new Set(runnerConfig),
  };
}

// A global CLAUDE.md holding what OPENING copies, so that the rule reader can find the copy by its exact text.
export const GLOBAL = "# Global\n\n## What the CLAUDE.md files are\nSummary.\n\n## Rules about the CLAUDE.md files\n\n" +
  "1. **Never change a CLAUDE.md unless the user directly asks you to.** Copied.\n";

export const OPENING = `# Part — rules

## What the CLAUDE.md files are
Summary.

## Rule 1 (from the global CLAUDE.md)

1. **Never change a CLAUDE.md unless the user directly asks you to.** Copied.

## Its rules

`;

// The thesis check's groups, written as patterns.
export const THESIS: ExemptConfig = {
  patterns: [
    { pattern: "**/CLAUDE.md", group: "CLAUDE.md files", reason: "they hold the rules" },
    { pattern: "**/tests/**", group: "tests", reason: "a tests folder" },
    { pattern: "**/test_*.py", group: "tests", reason: "a test file" },
    { pattern: "**/docs/**", group: "docs", reason: "the docs" },
    { pattern: "**/README.md", group: "docs", reason: "a folder's overview" },
    { pattern: "**/.gitignore", group: "tool settings", reason: "git's settings" },
    { pattern: "**/requirements.txt", group: "tool settings", reason: "the dependency list" },
    { pattern: "**/pytest.ini", group: "tool settings", reason: "the test settings" },
    { pattern: "**/__init__.py", group: "empty package file", reason: "it lets other code use the folder's code" },
  ],
  ownSkills: [],
};
