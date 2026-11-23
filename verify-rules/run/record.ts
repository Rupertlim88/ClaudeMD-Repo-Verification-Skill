// The run's record: JSON lines in the run folder, each entry chained to the one before by SHA-256, so an edit,
// a deletion or a reordering breaks the chain. Checkpoint commits carry the record's hash as trailers.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { utcSeconds, withLock, writeWhole, type RunPaths, type StepId } from "./state.ts";

const EMPTY_HEAD = "0".repeat(64);

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
  const entry = { ...fields, t: utcSeconds(now), kind };
  return withLock(p, () => {
    const chain = sha256(chainHead(p) + canonicalJson(entry));
    writeWhole(p.record, fs.readFileSync(p.record, "utf8") + canonicalJson({ ...entry, chain }) + "\n");
    return chain;
  });
}

export function verifyChain(p: RunPaths): { ok: true; head: string; entries: number } | { ok: false; badLine: number } {
  const all = entries(p);
  let head = EMPTY_HEAD;
  for (const [i, { chain, ...entry }] of all.entries()) {
    if (chain !== sha256(head + canonicalJson(entry))) return { ok: false, badLine: i + 1 };
    head = String(chain);
  }
  return { ok: true, head, entries: all.length };
}

export function trailers(step: StepId, round: number, head: string): string[] {
  return [`Verify-Rules-Step: ${step}`, `Verify-Rules-Round: ${round}`, `Verify-Rules-Record: ${head}`];
}

// Checks, oldest commit first, that each Verify-Rules-Record trailer on the branch is a hash of this record's chain,
// later in the chain than the trailer before it. Returns the commits whose trailer is not.
export function verifyTrailers(p: RunPaths, repoDir: string, branch: string): { ok: boolean; mismatches: string[] } {
  const position = new Map(entries(p).map((entry, i) => [String(entry.chain), i]));
  const log = execFileSync("git", ["log", "--reverse", "--format=%H %(trailers:key=Verify-Rules-Record,valueonly,separator=%x2C)", branch],
    { cwd: repoDir, encoding: "utf8" });
  const mismatches: string[] = [];
  let last = -1;
  for (const line of log.split("\n")) {
    const [commit, value] = line.split(" ");
    if (!value) continue;
    const at = position.get(value);
    if (at === undefined || at <= last) mismatches.push(commit);
    else last = at;
  }
  return { ok: mismatches.length === 0, mismatches };
}
