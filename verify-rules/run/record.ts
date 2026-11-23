// The run's record: JSON lines in the run folder, each entry chained to the one before by SHA-256, so an edit,
// a deletion or a reordering breaks the chain. An answer or a verdict names its captured output by the output's
// hash, so a changed or missing output fails the record too. Checkpoint commits carry the run's name and the
// record's hash as trailers.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  isOneOf, readState, updateState, utcSeconds, withLock, within, writeWhole, type Answer, type RunPaths, type RunState,
  type StepId,
} from "./state.ts";

const EMPTY_HEAD = "0".repeat(64);
// The fields append sets on every entry, which a caller's fields may not hold.
const SET_BY_RECORD = ["t", "kind", "chain"] as const;
// The kinds of entry that must name the captured output they were read from.
const EVIDENCE_KINDS = ["answer", "verdict"] as const;

// A captured output: a file in the run folder, named from the run folder, with the SHA-256 of its bytes.
export interface Captured { file: string; sha256: string }

export type Entry = { kind: string; chain: string; [field: string]: unknown };

// JSON with the keys of every object sorted, so the same entry always gives the same text.
export function canonicalJson(v: unknown): string {
  return JSON.stringify(v, (_key, value) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]))
      : value);
}

function sha256(text: string | Buffer): string {
  return createHash("sha256").update(text).digest("hex");
}

// The chain hash on the last line of the record's text: 64 zeros for an empty record.
function headOf(text: string): string {
  return text === "" ? EMPTY_HEAD : String(JSON.parse(text.slice(text.lastIndexOf("\n", text.length - 2) + 1)).chain);
}

export function chainHead(p: RunPaths): string {
  return headOf(fs.readFileSync(p.record, "utf8"));
}

export function capture(p: RunPaths, file: string): Captured {
  const root = path.resolve(p.root);
  const at = path.resolve(root, file);
  if (!within(root, at)) throw new Error(`a captured output must be a file in the run folder: ${file}`);
  return { file: path.relative(root, at), sha256: sha256(fs.readFileSync(at)) };
}

// What is wrong with an entry's captured output, or null: an answer or a verdict must name one, and a named file must
// still have the hash it was named with.
function outputProblem(p: RunPaths, entry: { kind: string; output?: unknown }): string | null {
  if (entry.output === undefined) return isOneOf(EVIDENCE_KINDS, entry.kind) ? `a ${entry.kind} must name its captured output` : null;
  const { file, sha256: named } = entry.output as Captured;
  const at = path.join(p.root, file);
  if (!fs.existsSync(at)) return `the captured output ${file} is missing`;
  return sha256(fs.readFileSync(at)) === named ? null : `the captured output ${file} was changed`;
}

// Adds one entry, holding the run folder's lock, and returns its chain hash: the SHA-256 of the previous hash
// followed by the entry's JSON.
export function append(p: RunPaths, kind: string, fields: Record<string, unknown>, now = new Date()): string {
  const taken = SET_BY_RECORD.filter((name) => name in fields);
  if (taken.length > 0) throw new Error(`an entry's ${taken.join(" and ")} is set by the record, not by its fields`);
  const entry = { ...fields, t: utcSeconds(now), kind };
  const problem = outputProblem(p, entry);
  if (problem !== null) throw new Error(`a ${kind} entry cannot be added: ${problem}`);
  return withLock(p, () => {
    const text = fs.readFileSync(p.record, "utf8");
    const chain = sha256(headOf(text) + canonicalJson(entry));
    writeWhole(p.record, text + canonicalJson({ ...entry, chain }) + "\n");
    return chain;
  });
}

// Adds an item's answer: its entry in the record, naming its captured output, then the answer in the state, naming
// that entry; both while holding the run folder's lock. Returns the entry's chain hash.
export function addAnswer(p: RunPaths, item: string, { check, by, verdict }: Answer, output: string, now = new Date()): string {
  return updateState(p, (s) => {
    const target = s.items[item];
    if (target === undefined) throw new Error(`there is no item ${item} in the state`);
    const entry = append(p, "answer", { item, check, by, verdict, output: capture(p, output) }, now);
    target.answers.push({ check, by, verdict, entry });
    return entry;
  });
}

// The state as the gate reads it: every answer of every item must name an answer entry of the checked record that
// says the same. A state that does not match, or a broken record, is refused.
export function checkedState(p: RunPaths): RunState {
  const checked = verifyEntries(p);
  if ("problem" in checked) throw new Error(`the record is broken: ${checked.problem}`);
  const answers = new Map(checked.entries.filter((e) => e.kind === "answer").map((e) => [e.chain, e]));
  const s = readState(p);
  for (const [item, { answers: given }] of Object.entries(s.items)) {
    for (const a of given) {
      const e = answers.get(a.entry);
      if (e?.item !== item || e.check !== a.check || e.by !== a.by || e.verdict !== a.verdict) {
        throw new Error(`the state does not match the record: ${item} has an answer by ${a.by} on ${a.check} that no record entry holds`);
      }
    }
  }
  return s;
}

export type RecordCheck = { ok: true; head: string; entries: number } | { ok: false; problem: string };

// The record's whole check: first the chain, then every captured output, then the checkpoint trailers on the branch.
export function verifyRecord(p: RunPaths, repoDir: string, branch: string): RecordCheck {
  const checked = verifyEntries(p);
  if ("problem" in checked) return { ok: false, problem: checked.problem };
  const problem = verifyTrailers(p, checked.entries, repoDir, branch);
  if (problem !== null) return { ok: false, problem };
  return { ok: true, head: checked.entries.at(-1)?.chain ?? EMPTY_HEAD, entries: checked.entries.length };
}

// Every entry of the record, oldest first; a broken chain is refused.
export function entries(p: RunPaths): Entry[] {
  const chain = verifyChain(p);
  if ("problem" in chain) throw new Error(`the record is broken: ${chain.problem}`);
  return chain.entries;
}

// Every entry, oldest first, if the chain holds and every captured output still has its hash; else the first problem.
function verifyEntries(p: RunPaths): { entries: Entry[] } | { problem: string } {
  const chain = verifyChain(p);
  if ("problem" in chain) return chain;
  const problem = verifyEvidence(p, chain.entries);
  return problem === null ? chain : { problem };
}

// Every entry, oldest first, if each line is a JSON object whose hash follows from the line before it; else the
// first line that is not.
function verifyChain(p: RunPaths): { entries: Entry[] } | { problem: string } {
  const all: Entry[] = [];
  let head = EMPTY_HEAD;
  for (const [i, line] of fs.readFileSync(p.record, "utf8").split("\n").filter((l) => l !== "").entries()) {
    const entry = jsonObject(line);
    if (entry === null) return { problem: `line ${i + 1} is not a JSON object` };
    const { chain, ...rest } = entry;
    if (chain !== sha256(head + canonicalJson(rest))) return { problem: `line ${i + 1} does not follow from the line before it` };
    head = chain;
    all.push(entry);
  }
  return { entries: all };
}

// Re-hashes every captured output the record names. Returns the first entry whose output is missing or changed, or
// null.
function verifyEvidence(p: RunPaths, all: Entry[]): string | null {
  for (const [i, entry] of all.entries()) {
    const problem = outputProblem(p, entry);
    if (problem !== null) return `line ${i + 1}: ${problem}`;
  }
  return null;
}

function jsonObject(line: string): Entry | null {
  try {
    const value = JSON.parse(line);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// A run is named by its folder: "<repo name>-<start time>".
const runName = (p: RunPaths) => path.basename(p.root);

// A checkpoint commit's trailers: the run, the step, the round, and the record's hash at this moment.
export function trailers(p: RunPaths, step: StepId, round: number): string[] {
  return [`Verify-Rules-Run: ${runName(p)}`, `Verify-Rules-Step: ${step}`, `Verify-Rules-Round: ${round}`,
    `Verify-Rules-Record: ${chainHead(p)}`];
}

// Checks, oldest commit first, that each of this run's checkpoint commits on the branch names a hash of the record's
// chain, later in the chain than the checkpoint before it; other runs' commits are left alone. Returns the first
// commit that does not, or null.
function verifyTrailers(p: RunPaths, all: Entry[], repoDir: string, branch: string): string | null {
  const position = new Map(all.map((entry, i) => [entry.chain, i]));
  const trailer = (key: string) => `%(trailers:key=${key},valueonly,separator=%x2C)`;
  const log = execFileSync("git", ["log", "--reverse", `--format=%H%x1f${trailer("Verify-Rules-Run")}%x1f${trailer("Verify-Rules-Record")}`,
    branch, "--"], { cwd: repoDir, encoding: "utf8" });
  let last = -1;
  for (const line of log.split("\n")) {
    const [commit, run, value] = line.split("\x1f");
    if (run !== runName(p)) continue;
    const at = position.get(value);
    if (at === undefined) return `commit ${commit} names a record hash that is not in this record`;
    if (at <= last) return `commit ${commit} names a record hash no later in the chain than the checkpoint before it`;
    last = at;
  }
  return null;
}
