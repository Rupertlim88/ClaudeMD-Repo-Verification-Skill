// The run folder and the state: everything a run needs to go on after a stop, kept outside the repo,
// and every file written whole.
import fs from "node:fs";
import path from "node:path";

export type StepId = "0" | "7" | "tie" | "8" | "9" | "14";

export interface RunPaths {
  root: string; state: string; record: string; questions: string; status: string;
  tables: string; jev: string; checkers: string; packs: string; evidence: string; worktree: string;
}

export const ITEM_STATES = ["not started", "in progress", "done", "passed", "failed", "reopened"] as const;
export type ItemStatus = (typeof ITEM_STATES)[number];

export interface ItemState {
  status: ItemStatus;
  answers: { check: string; by: string; verdict: string; ref: string }[];
}

export interface Finding {
  id: string; where: string; what: string; label: "measured" | "inferred";
  kind: "gap to implement" | "gap to check" | "not testable here" | "extra piece" | "another rule's job" |
    "broken tie" | "classification" | "known failure" | "other";
  group: "A" | "B1" | "B2" | "C" | null; source: string;
}

export interface RunState {
  repo: string; scope: string; startCommit: string; baseline: string; baselineHow: string;
  branch: string; doerModel: string; step: StepId | null; round: number; stepStartCommit: string | null;
  items: Record<string, ItemState>;
  testCommands: { name: string; command: string; exit: number; outputFile: string }[];
  knownFailures: string[];
  budgets: { moneyUsd: number; claudeRuns: number; questionId: string } | null;
  spend: { jevCalls: number; jevInputTokens: number; jevOutputTokens: number; jevUsd: number; claudeRuns: number;
    claudeSeconds: number; claudeListUsd: number };
  open: OpenItem[]; declined: DeclinedItem[];
  agents: { id: string; folder: string; started: string; reported: boolean; note: string }[];
  mistakes: Record<string, number>;
  situation: { guess: "A" | "B" | "C" | "D"; counts: Record<string, number> } | null;
  steps: Partial<Record<StepId, { result: "passed" | "failed" | "failed, continued by user" | "not run"; rounds: number }>>;
}

export interface RunView { paths: RunPaths; state: RunState; copyRoot: string; table<T>(name: string): T | null }

export const REASON_CODES = ["user-unanswered", "user-deferred", "needs-user-only-fact", "budget-refused", "other-owner",
  "continued-by-user", "doer-deferred", "later-version"] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface OpenItem { item: string; code: ReasonCode; evidence: string; needsPutOffQuestion: boolean }

export interface DeclinedItem { item: string; line: string; userWords: string; step: StepId; date: string }

// Whether a value is one of a closed list's members, so that its type narrows to the list's.
export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return (list as readonly unknown[]).includes(value);
}

function pathsOf(root: string): RunPaths {
  const at = (name: string) => path.join(root, name);
  return {
    root, state: at("state.json"), record: at("record.jsonl"), questions: at("questions.jsonl"), status: at("status.md"),
    tables: at("tables"), jev: at("jev"), checkers: at("checkers"), packs: at("packs"), evidence: at("evidence"),
    worktree: at("worktree"),
  };
}

// The real path of a folder, even one that does not exist yet: its nearest existing parent, resolved, plus the rest.
function realPathOf(folder: string): string {
  const parent = path.dirname(folder);
  if (fs.existsSync(folder) || parent === folder) return fs.realpathSync(folder);
  return path.join(realPathOf(parent), path.basename(folder));
}

function freshState(repo: string): RunState {
  return {
    repo, scope: "", startCommit: "", baseline: "", baselineHow: "", branch: "", doerModel: "",
    step: null, round: 0, stepStartCommit: null, items: {}, testCommands: [], knownFailures: [], budgets: null,
    spend: { jevCalls: 0, jevInputTokens: 0, jevOutputTokens: 0, jevUsd: 0, claudeRuns: 0, claudeSeconds: 0, claudeListUsd: 0 },
    open: [], declined: [], agents: [], mistakes: {}, situation: null, steps: {},
  };
}

// Makes the run folder <base>/<repo name>-<start time>, with an empty record, question log and status file,
// and a fresh state. The folder must be outside the repo.
export function createRun(repoName: string, startedAt: Date, base: string, repoRoot: string): RunPaths {
  const repo = fs.realpathSync(repoRoot);
  if ((realPathOf(base) + path.sep).startsWith(repo + path.sep)) {
    throw new Error(`the run folder must be outside the repo: ${base} is inside ${repoRoot}`);
  }
  const startTime = utcSeconds(startedAt).replace(/[-:]/g, "");
  const p = pathsOf(path.join(base, `${repoName}-${startTime}`));
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(p.root);
  for (const folder of [p.tables, p.jev, p.checkers, p.packs, p.evidence]) fs.mkdirSync(folder);
  for (const file of [p.record, p.questions, p.status]) writeWhole(file, "");
  saveState(p, freshState(repo));
  return p;
}

export function openRun(root: string): RunPaths {
  const p = pathsOf(root);
  if (!fs.existsSync(p.state)) throw new Error(`not a run folder (it has no state file): ${root}`);
  return p;
}

// A time in UTC to the second, as every run file writes it: "2026-11-23T05:48:54Z".
export function utcSeconds(time: Date): string {
  return time.toISOString().replace(/\.\d+Z$/, "Z");
}

// Writes to <file>.partial, then renames it over the file, so a stop mid-write leaves the old file whole.
export function writeWhole(file: string, text: string): void {
  fs.writeFileSync(file + ".partial", text);
  fs.renameSync(file + ".partial", file);
}

export function readState(p: RunPaths): RunState {
  return JSON.parse(fs.readFileSync(p.state, "utf8"));
}

export function saveState(p: RunPaths, s: RunState): void {
  writeWhole(p.state, JSON.stringify(s, null, 2) + "\n");
}

export function saveTable(p: RunPaths, name: string, value: unknown): void {
  writeWhole(path.join(p.tables, `${name}.json`), JSON.stringify(value, null, 2) + "\n");
}

export function readTable<T>(p: RunPaths, name: string): T | null {
  const file = path.join(p.tables, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}
