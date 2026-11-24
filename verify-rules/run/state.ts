// The run folder and the state: everything a run needs to go on after a stop, kept outside the repo,
// every file written whole, and every read-modify-write done while holding the run folder's lock.
import fs from "node:fs";
import path from "node:path";

// The steps version 1 runs, in order.
export const STEP_IDS = ["0", "7", "tie", "8", "9", "14"] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface RunPaths {
  root: string; state: string; record: string; questions: string; status: string; lock: string;
  tables: string; jev: string; checkers: string; packs: string; evidence: string; worktree: string;
}

export const ITEM_STATES = ["not started", "in progress", "done", "passed", "failed", "reopened"] as const;
export type ItemStatus = (typeof ITEM_STATES)[number];

// One checker's answer on one of an item's checks.
export interface Answer { check: string; by: string; verdict: string }

// An item's answers each name the record entry that holds them, by its chain hash, so the gate can check them.
export interface ItemState {
  status: ItemStatus;
  answers: (Answer & { entry: string })[];
}

export const FINDING_LABELS = ["measured", "inferred"] as const;
export const FINDING_KINDS = ["gap to implement", "gap to check", "not testable here", "extra piece", "another rule's job",
  "broken tie", "classification", "known failure", "other"] as const;
export const FINDING_GROUPS = ["A", "B1", "B2", "C"] as const;

export interface Finding {
  id: string; where: string; what: string; label: (typeof FINDING_LABELS)[number]; kind: (typeof FINDING_KINDS)[number];
  group: (typeof FINDING_GROUPS)[number] | null; source: string;
}

export const SITUATIONS = ["A", "B", "C", "D"] as const;
export const STEP_RESULTS = ["passed", "failed", "failed, continued by user", "not run"] as const;

export interface RunState {
  repo: string; scope: string; startCommit: string; baseline: string; baselineHow: string;
  branch: string; doerModel: string; step: StepId | null; round: number; stepStartCommit: string | null;
  items: Record<string, ItemState>;
  testCommands: { name: string; command: string; exit: number; outputFile: string }[];
  knownFailures: string[];
  budgets: { moneyUsd: number; claudeRuns: number; computeHours: number | null; questionId: string } | null;
  spend: { jevCalls: number; jevInputTokens: number; jevOutputTokens: number; jevUsd: number; claudeRuns: number;
    claudeSeconds: number; claudeListUsd: number };
  open: OpenItem[]; declined: DeclinedItem[];
  agents: { id: string; folder: string; started: string; reported: boolean; note: string }[];
  mistakes: Record<string, number>;
  situation: { guess: (typeof SITUATIONS)[number]; counts: Record<string, number> } | null;
  steps: Partial<Record<StepId, { result: (typeof STEP_RESULTS)[number]; rounds: number }>>;
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
    lock: at("lock"), tables: at("tables"), jev: at("jev"), checkers: at("checkers"), packs: at("packs"), evidence: at("evidence"),
    worktree: at("worktree"),
  };
}

// A name the run folder uses as one folder or file name: never empty, never holding a path separator.
function oneName(name: string, what: string): string {
  if (name === "" || /[/\\]/.test(name)) throw new Error(`${what} must be one folder or file name: "${name}"`);
  return name;
}

// Whether a path is the folder itself or inside it, once both are resolved.
export function within(folder: string, file: string): boolean {
  return (path.resolve(file) + path.sep).startsWith(path.resolve(folder) + path.sep);
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
  const startTime = utcSeconds(startedAt).replace(/[-:]/g, "");
  const p = pathsOf(path.join(base, `${oneName(repoName, "the repo's name")}-${startTime}`));
  if (within(repo, realPathOf(p.root))) {
    throw new Error(`the run folder must be outside the repo: ${p.root} is inside ${repoRoot}`);
  }
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(p.root);
  for (const folder of [p.tables, p.jev, p.checkers, p.packs, p.evidence]) fs.mkdirSync(folder);
  for (const file of [p.record, p.questions, p.status]) writeWhole(file, "");
  writeWhole(p.state, stateText(freshState(repo)));
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

// Writes to <file>.<process id>.partial, flushes it to disk, then renames it over the file, so a stop mid-write
// leaves the old file whole, and writers in other processes never touch this one's partial file.
export function writeWhole(file: string, text: string): void {
  const partial = `${file}.${process.pid}.partial`;
  const fd = fs.openSync(partial, "w");
  try {
    fs.writeFileSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(partial, file);
}

export function readState(p: RunPaths): RunState {
  return JSON.parse(fs.readFileSync(p.state, "utf8"));
}

const stateText = (s: RunState) => JSON.stringify(s, null, 2) + "\n";

// Reads the state, changes it and writes it whole, all while holding the run folder's lock, so no change made by
// another process at the same time is lost. Returns what the change returns.
export function updateState<T>(p: RunPaths, change: (s: RunState) => T): T {
  return withLock(p, () => {
    const s = readState(p);
    const result = change(s);
    writeWhole(p.state, stateText(s));
    return result;
  });
}

// The locks this process holds, so that a writer called inside another writer takes the lock only once.
const held = new Set<string>();
const pause = new Int32Array(new SharedArrayBuffer(4));

// Runs the work while holding the run folder's lock: <root>/lock, made only where none exists, holding this process's
// id. Every read-modify-write of the run folder runs inside it, so writers in several processes take turns.
export function withLock<T>(p: RunPaths, work: () => T): T {
  const lock = path.resolve(p.lock);
  if (held.has(lock)) return work();
  takeLock(lock);
  held.add(lock);
  try {
    return work();
  } finally {
    held.delete(lock);
    fs.rmSync(lock, { force: true });
  }
}

function takeLock(lock: string): void {
  for (;;) {
    try {
      const fd = fs.openSync(lock, "wx");
      fs.writeFileSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    if (isStale(lock)) fs.rmSync(lock, { force: true });
    else Atomics.wait(pause, 0, 0, 5);
  }
}

// A lock is stale when the process it names no longer runs, or when it never got a process id and is over a second
// old: its process stopped between making the file and writing the id.
function isStale(lock: string): boolean {
  try {
    const holder = fs.readFileSync(lock, "utf8");
    return holder === "" ? Date.now() - fs.statSync(lock).mtimeMs > 1000 : !isRunning(Number(holder));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false; // released meanwhile: try again
    throw e;
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

const tableFile = (p: RunPaths, name: string) => path.join(p.tables, `${oneName(name, "a table's name")}.json`);

export function saveTable(p: RunPaths, name: string, value: unknown): void {
  writeWhole(tableFile(p, name), JSON.stringify(value, null, 2) + "\n");
}

export function readTable<T>(p: RunPaths, name: string): T | null {
  const file = tableFile(p, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}
