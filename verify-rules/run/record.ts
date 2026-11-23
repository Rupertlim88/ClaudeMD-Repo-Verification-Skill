// The run's record: JSON lines in the run folder, each entry chained to the one before by SHA-256, so an edit,
// a deletion or a reordering breaks the chain. Checkpoint commits carry the run's name and the record's hash as
// trailers.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { utcSeconds, withLock, writeWhole, type RunPaths, type StepId } from "./state.ts";

const EMPTY_HEAD = "0".repeat(64);
// The fields append sets on every entry, which a caller's fields may not hold.
const SET_BY_RECORD = ["t", "kind", "chain"] as const;

// JSON with the keys of every object sorted, so the same entry always gives the same text.
export function canonicalJson(v: unknown): string {
  return JSON.stringify(v, (_key, value) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : value);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function entries(p: RunPaths): Record<string, unknown>[] {
  return fs.readFileSync(p.record, "utf8").split("\n").filter((line) => line !== "").map((line) => JSON.parse(line));
}

export function chainHead(p: RunPaths): string {
  const all = entries(p);
  return all.length === 0 ? EMPTY_HEAD : String(all[all.length - 1].chain);
}

// Adds one entry, holding the run folder's lock, and returns its chain hash: the SHA-256 of the previous hash
// followed by the entry's JSON.
export function append(p: RunPaths, kind: string, fields: Record<string, unknown>, now = new Date()): string {
  const taken = SET_BY_RECORD.filter((name) => name in fields);
  if (taken.length > 0) throw new Error(`an entry's ${taken.join(" and ")} is set by the record, not by its fields`);
  const entry = { ...fields, t: utcSeconds(now), kind };
  return withLock(p, () => {
    const chain = sha256(chainHead(p) + canonicalJson(entry));
    writeWhole(p.record, fs.readFileSync(p.record, "utf8") + canonicalJson({ ...entry, chain }) + "\n");
    return chain;
  });
}

export type RecordCheck = { ok: true; head: string; entries: number } | { ok: false; problem: string };

// The record's whole check: first the chain, then the checkpoint trailers on the branch against it.
export function verifyRecord(p: RunPaths, repoDir: string, branch: string): RecordCheck {
  const chain = verifyChain(p);
  if ("problem" in chain) return { ok: false, problem: chain.problem };
  const problem = verifyTrailers(p, chain.entries, repoDir, branch);
  if (problem !== null) return { ok: false, problem };
  return { ok: true, head: chain.entries.at(-1)?.chain ?? EMPTY_HEAD, entries: chain.entries.length };
}

type Entry = { chain: string; [field: string]: unknown };

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
