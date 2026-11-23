import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";
import { append, canonicalJson, chainHead, trailers, verifyChain, verifyTrailers } from "../../run/record.ts";
import { createRun } from "../../run/state.ts";
import { atOnce } from "../helpers/at-once.ts";
import { git, makeRepo, tmpDir } from "../helpers/tmp.ts";

const t0 = new Date("2026-11-23T05:48:54Z");
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function newRun() {
  return createRun("r", t0, tmpDir("runs"), makeRepo({ "a.py": "x = 1\n" }));
}

function checkpointCommit(repo: string, lines: string[]): string {
  git(repo, "commit", "-q", "--allow-empty", "-m", "verify-rules: checkpoint", "-m", lines.join("\n"));
  return git(repo, "rev-parse", "HEAD").trim();
}

test("each entry carries the SHA-256 of the previous hash and its own sorted JSON", () => {
  const p = newRun();
  const h1 = append(p, "start", { a: 1 }, t0);
  const h2 = append(p, "verdict", { b: 2 }, t0);
  assert.equal(h1, sha256("0".repeat(64) + '{"a":1,"kind":"start","t":"2026-11-23T05:48:54Z"}'));
  assert.equal(h2, sha256(h1 + '{"b":2,"kind":"verdict","t":"2026-11-23T05:48:54Z"}'));
});

test("chainHead is 64 zeros for an empty record, then the last entry's hash", () => {
  const p = newRun();
  assert.equal(chainHead(p), "0".repeat(64));
  append(p, "start", {}, t0);
  const h2 = append(p, "verdict", { b: 2 }, t0);
  assert.equal(chainHead(p), h2);
});

test("a field cannot replace an entry's time or kind", () => {
  const p = newRun();
  const h = append(p, "verdict", { t: "1999-01-01T00:00:00Z", kind: "approval" }, t0);
  assert.equal(h, sha256("0".repeat(64) + '{"kind":"verdict","t":"2026-11-23T05:48:54Z"}'));
});

test("four processes appending at once lose no entry, and the chain verifies", async () => {
  const p = newRun();
  const writers = ["1", "2", "3", "4"];
  const ends = await atOnce(writers.map((writer) => ["append", p.root, writer, "50"]));
  assert.deepEqual(ends, writers.map(() => ({ code: 0, stderr: "" })));
  const written = fs.readFileSync(p.record, "utf8").split("\n").filter((line) => line !== "").map((line) => JSON.parse(line));
  const every = writers.flatMap((writer) => Array.from({ length: 50 }, (_, i) => `${writer}.${i}`));
  assert.deepEqual(written.map((e) => `${e.writer}.${e.i}`).sort(), every.sort());
  assert.equal(verifyChain(p).ok, true);
});

test("verifyChain passes an untouched record, with its head and its number of entries", () => {
  const p = newRun();
  append(p, "start", { a: 1 }, t0);
  const h2 = append(p, "verdict", { b: 2 }, t0);
  assert.deepEqual(verifyChain(p), { ok: true, head: h2, entries: 2 });
});

test("verifyChain finds an edited entry by its line", () => {
  const p = newRun();
  append(p, "start", { a: 1 }, t0);
  append(p, "verdict", { b: 2 }, t0);
  append(p, "verdict", { c: 3 }, t0);
  const lines = fs.readFileSync(p.record, "utf8").split("\n");
  lines[1] = lines[1].replace('"b":2', '"b":3');
  fs.writeFileSync(p.record, lines.join("\n"));
  assert.deepEqual(verifyChain(p), { ok: false, badLine: 2 });
});

test("verifyChain finds a deleted entry at the line after it", () => {
  const p = newRun();
  append(p, "start", { a: 1 }, t0);
  append(p, "verdict", { b: 2 }, t0);
  append(p, "verdict", { c: 3 }, t0);
  const lines = fs.readFileSync(p.record, "utf8").split("\n");
  fs.writeFileSync(p.record, [lines[0], lines[2], ""].join("\n"));
  assert.deepEqual(verifyChain(p), { ok: false, badLine: 2 });
});

test("trailers name the step, the round and the record's hash", () =>
  assert.deepEqual(trailers("7", 2, "ab".repeat(32)),
    ["Verify-Rules-Step: 7", "Verify-Rules-Round: 2", `Verify-Rules-Record: ${"ab".repeat(32)}`]));

test("verifyTrailers passes when every trailer is a chain hash in order, and names a commit whose trailer is not", () => {
  const p = newRun();
  const repo = makeRepo({ "a.py": "x = 1\n" });
  const h1 = append(p, "start", {}, t0);
  append(p, "verdict", { b: 2 }, t0);
  const h3 = append(p, "verdict", { c: 3 }, t0);
  checkpointCommit(repo, trailers("0", 1, h1));
  checkpointCommit(repo, trailers("7", 1, h3));
  assert.deepEqual(verifyTrailers(p, repo, "main"), { ok: true, mismatches: [] });

  const unknown = checkpointCommit(repo, trailers("8", 1, "f".repeat(64)));
  assert.deepEqual(verifyTrailers(p, repo, "main"), { ok: false, mismatches: [unknown] });
});

test("verifyTrailers names a commit whose trailer goes back in the chain", () => {
  const p = newRun();
  const repo = makeRepo({ "a.py": "x = 1\n" });
  const h1 = append(p, "start", {}, t0);
  const h2 = append(p, "verdict", { b: 2 }, t0);
  checkpointCommit(repo, trailers("0", 1, h2));
  const back = checkpointCommit(repo, trailers("7", 1, h1));
  assert.deepEqual(verifyTrailers(p, repo, "main"), { ok: false, mismatches: [back] });
});

test("canonicalJson sorts keys at every depth, and keeps the order of lists", () =>
  assert.equal(canonicalJson({ b: { d: 1, c: 2 }, a: [{ f: 1, e: 2 }, 3] }), '{"a":[{"e":2,"f":1},3],"b":{"c":2,"d":1}}'));
