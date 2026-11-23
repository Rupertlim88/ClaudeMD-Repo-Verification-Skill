import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";
import { append, canonicalJson, chainHead, trailers, verifyRecord } from "../../run/record.ts";
import { createRun, type RunPaths } from "../../run/state.ts";
import { atOnce } from "../helpers/at-once.ts";
import { git, makeRepo, tmpDir } from "../helpers/tmp.ts";

const t0 = new Date("2026-11-23T05:48:54Z");
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function newRun() {
  const repo = makeRepo({ "a.py": "x = 1\n" });
  return { p: createRun("r", t0, tmpDir("runs"), repo), repo };
}

// A checkpoint's trailers with the record hash replaced, as a forged or out-of-order commit would carry them.
function namingHash(p: RunPaths, head: string): string[] {
  return trailers(p, "8", 1).map((line) => (line.startsWith("Verify-Rules-Record: ") ? `Verify-Rules-Record: ${head}` : line));
}

function editRecord(p: RunPaths, edit: (lines: string[]) => string[]): void {
  const lines = fs.readFileSync(p.record, "utf8").split("\n").filter((line) => line !== "");
  fs.writeFileSync(p.record, edit(lines).map((line) => line + "\n").join(""));
}

function checkpointCommit(repo: string, lines: string[]): string {
  git(repo, "commit", "-q", "--allow-empty", "-m", "verify-rules: checkpoint", "-m", lines.join("\n"));
  return git(repo, "rev-parse", "HEAD").trim();
}

test("each entry carries the SHA-256 of the previous hash and its own sorted JSON", () => {
  const { p } = newRun();
  const h1 = append(p, "start", { a: 1 }, t0);
  const h2 = append(p, "verdict", { b: 2 }, t0);
  assert.equal(h1, sha256("0".repeat(64) + '{"a":1,"kind":"start","t":"2026-11-23T05:48:54Z"}'));
  assert.equal(h2, sha256(h1 + '{"b":2,"kind":"verdict","t":"2026-11-23T05:48:54Z"}'));
});

test("chainHead is 64 zeros for an empty record, then the last entry's hash", () => {
  const { p } = newRun();
  assert.equal(chainHead(p), "0".repeat(64));
  append(p, "start", {}, t0);
  const h2 = append(p, "verdict", { b: 2 }, t0);
  assert.equal(chainHead(p), h2);
});

test("a field cannot replace an entry's time, kind or chain: append refuses it and adds nothing", () => {
  const { p } = newRun();
  for (const name of ["t", "kind", "chain"]) {
    assert.throws(() => append(p, "verdict", { [name]: "x", item: "7.c1" }, t0), /set by the record/, name);
  }
  assert.equal(fs.readFileSync(p.record, "utf8"), "");
});

test("four processes appending at once lose no entry, and the chain verifies", async () => {
  const { p, repo } = newRun();
  const writers = ["1", "2", "3", "4"];
  const ends = await atOnce(writers.map((writer) => ["append", p.root, writer, "50"]));
  assert.deepEqual(ends, writers.map(() => ({ code: 0, stderr: "" })));
  const written = fs.readFileSync(p.record, "utf8").split("\n").filter((line) => line !== "").map((line) => JSON.parse(line));
  const every = writers.flatMap((writer) => Array.from({ length: 50 }, (_, i) => `${writer}.${i}`));
  assert.deepEqual(written.map((e) => `${e.writer}.${e.i}`).sort(), every.sort());
  assert.equal(verifyRecord(p, repo, "main").ok, true);
});

test("verifyRecord passes an untouched record, with its head and its number of entries", () => {
  const { p, repo } = newRun();
  append(p, "start", { a: 1 }, t0);
  const h2 = append(p, "verdict", { b: 2 }, t0);
  assert.deepEqual(verifyRecord(p, repo, "main"), { ok: true, head: h2, entries: 2 });
});

test("verifyRecord names an edited entry by its line", () => {
  const { p, repo } = newRun();
  append(p, "start", { a: 1 }, t0);
  append(p, "verdict", { b: 2 }, t0);
  append(p, "verdict", { c: 3 }, t0);
  editRecord(p, (lines) => lines.map((line, i) => (i === 1 ? line.replace('"b":2', '"b":3') : line)));
  assert.deepEqual(verifyRecord(p, repo, "main"), { ok: false, problem: "line 2 does not follow from the line before it" });
});

test("verifyRecord names a deleted entry at the line after it", () => {
  const { p, repo } = newRun();
  append(p, "start", { a: 1 }, t0);
  append(p, "verdict", { b: 2 }, t0);
  append(p, "verdict", { c: 3 }, t0);
  editRecord(p, (lines) => [lines[0], lines[2]]);
  assert.deepEqual(verifyRecord(p, repo, "main"), { ok: false, problem: "line 2 does not follow from the line before it" });
});

test("verifyRecord names a line that is not a JSON object, rather than throwing", () => {
  const { p, repo } = newRun();
  append(p, "start", { a: 1 }, t0);
  append(p, "verdict", { b: 2 }, t0);
  for (const bad of ['{"b":2,', "null"]) {
    editRecord(p, (lines) => [lines[0], bad]);
    assert.deepEqual(verifyRecord(p, repo, "main"), { ok: false, problem: "line 2 is not a JSON object" }, bad);
  }
});

test("verifyRecord fails an edited entry even when every trailer still names a hash in the record", () => {
  const { p, repo } = newRun();
  append(p, "start", {}, t0);
  append(p, "verdict", { item: "7.c1", verdict: "FAIL" }, t0);
  checkpointCommit(repo, trailers(p, "7", 1));
  editRecord(p, (lines) => lines.map((line) => line.replace('"FAIL"', '"PASS"')));
  assert.deepEqual(verifyRecord(p, repo, "main"), { ok: false, problem: "line 2 does not follow from the line before it" });
});

test("trailers name the run, the step, the round and the record's hash at that moment", () => {
  const { p } = newRun();
  const head = append(p, "start", {}, t0);
  assert.deepEqual(trailers(p, "7", 2), ["Verify-Rules-Run: r-20261123T054854Z", "Verify-Rules-Step: 7",
    "Verify-Rules-Round: 2", `Verify-Rules-Record: ${head}`]);
});

test("verifyRecord passes when every trailer is a chain hash in order, and names a commit whose trailer is not", () => {
  const { p, repo } = newRun();
  append(p, "start", {}, t0);
  checkpointCommit(repo, trailers(p, "0", 1));
  append(p, "verdict", { b: 2 }, t0);
  append(p, "verdict", { c: 3 }, t0);
  checkpointCommit(repo, trailers(p, "7", 1));
  assert.equal(verifyRecord(p, repo, "main").ok, true);

  const unknown = checkpointCommit(repo, namingHash(p, "f".repeat(64)));
  assert.deepEqual(verifyRecord(p, repo, "main"),
    { ok: false, problem: `commit ${unknown} names a record hash that is not in this record` });
});

test("verifyRecord names a commit whose trailer goes back in the chain, or stays at the same hash", () => {
  const { p, repo } = newRun();
  const h1 = append(p, "start", {}, t0);
  append(p, "verdict", { b: 2 }, t0);
  checkpointCommit(repo, trailers(p, "0", 1));
  const same = checkpointCommit(repo, trailers(p, "7", 1));
  const later = (commit: string) =>
    ({ ok: false, problem: `commit ${commit} names a record hash no later in the chain than the checkpoint before it` });
  assert.deepEqual(verifyRecord(p, repo, "main"), later(same));
  git(repo, "reset", "-q", "--hard", "HEAD~1");
  const back = checkpointCommit(repo, namingHash(p, h1));
  assert.deepEqual(verifyRecord(p, repo, "main"), later(back));
});

test("verifyRecord checks only this run's checkpoints, so an earlier run's in the branch's history does not fail it", () => {
  const repo = makeRepo({ "a.py": "x = 1\n" });
  const earlier = createRun("r", t0, tmpDir("runs"), repo);
  append(earlier, "start", {}, t0);
  checkpointCommit(repo, trailers(earlier, "14", 1));
  const p = createRun("r", new Date("2026-12-01T00:00:00Z"), tmpDir("runs"), repo);
  append(p, "start", { run: 2 }, t0);
  git(repo, "checkout", "-q", "-b", "verify-rules/run-2");
  checkpointCommit(repo, trailers(p, "0", 1));
  assert.equal(verifyRecord(p, repo, "verify-rules/run-2").ok, true);
});

test("verifyRecord reads the branch even when a file in the repo has the branch's name", () => {
  const repo = makeRepo({ main: "a file named like the branch\n" });
  const p = createRun("r", t0, tmpDir("runs"), repo);
  append(p, "start", {}, t0);
  checkpointCommit(repo, trailers(p, "0", 1));
  assert.equal(verifyRecord(p, repo, "main").ok, true);
});

test("canonicalJson sorts keys at every depth, and keeps the order of lists", () =>
  assert.equal(canonicalJson({ b: { d: 1, c: 2 }, a: [{ f: 1, e: 2 }, 3] }), '{"a":[{"e":2,"f":1},3],"b":{"c":2,"d":1}}'));
