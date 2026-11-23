import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  createRun,
  openRun,
  readState,
  readTable,
  saveState,
  saveTable,
  writeWhole,
} from "../../run/state.ts";
import { atOnce } from "../helpers/at-once.ts";
import { sampleState } from "../helpers/state.ts";
import { git, makeRepo, tmpDir } from "../helpers/tmp.ts";

function newRun() {
  return createRun("r", new Date("2026-11-23T05:48:54Z"), tmpDir("runs"), makeRepo({ "a.py": "x = 1\n" }));
}

test("createRun names the folder after the repo and the start time, and makes every file and folder", () => {
  const p = createRun("senior-thesis-research", new Date("2026-11-23T05:48:54Z"), tmpDir("runs"),
    makeRepo({ "a.py": "x = 1\n" }));
  assert.equal(path.basename(p.root), "senior-thesis-research-20261123T054854Z");
  for (const f of [p.state, p.record, p.questions, p.status]) assert.ok(fs.statSync(f).isFile(), f);
  for (const d of [p.tables, p.jev, p.checkers, p.packs, p.evidence]) assert.ok(fs.statSync(d).isDirectory(), d);
});

test("createRun refuses a run folder that already exists, and leaves that run as it was", () => {
  const base = tmpDir("runs");
  const repo = makeRepo({ "a.py": "x\n" });
  const startedAt = new Date("2026-11-23T05:48:54Z");
  const p = createRun("r", startedAt, base, repo);
  fs.writeFileSync(p.record, "the first run's record\n");
  assert.throws(() => createRun("r", startedAt, base, repo),
    (e: NodeJS.ErrnoException) => e.code === "EEXIST" && e.path === p.root);
  assert.equal(fs.readFileSync(p.record, "utf8"), "the first run's record\n");
});

test("createRun allows a folder beside the repo whose name starts with the repo's name", () => {
  const repo = makeRepo({ "a.py": "x\n" });
  const beside = `${repo}-runs`;
  assert.equal(path.dirname(createRun("r", new Date(), beside, repo).root), beside);
  fs.rmSync(beside, { recursive: true });
});

test("a new run's state reads back with nothing done and nothing spent", () => {
  const s = readState(newRun());
  assert.equal(s.step, null);
  assert.deepEqual(s.items, {});
  assert.deepEqual(s.open, []);
  assert.equal(s.spend.jevCalls + s.spend.claudeRuns + s.spend.jevUsd, 0);
});

test("createRun refuses a run folder inside the repo, and makes nothing there", () => {
  const repo = makeRepo({ "a.py": "x\n" });
  assert.throws(() => createRun("r", new Date(), path.join(repo, "runs"), repo), /outside the repo/);
  assert.ok(!fs.existsSync(path.join(repo, "runs")));
});

test("createRun refuses a repo name that is not one folder name, so the run folder cannot land in the repo", () => {
  const repo = makeRepo({ "a.py": "x\n" });
  const base = tmpDir("runs");
  for (const name of [`../${path.basename(repo)}/x`, "a\\b", ""]) {
    assert.throws(() => createRun(name, new Date(), base, repo), /one folder or file name/, name);
  }
  assert.deepEqual(fs.readdirSync(base), []);
  assert.equal(git(repo, "status", "--porcelain"), "");
});

test("createRun compares real paths, so a link into the repo is refused", () => {
  const repo = makeRepo({ "a.py": "x\n" });
  const link = path.join(tmpDir("links"), "to-repo");
  fs.symlinkSync(repo, link);
  assert.throws(() => createRun("r", new Date(), path.join(link, "runs"), repo), /outside the repo/);
});

test("openRun finds the files of an existing run, and refuses a folder that is not a run", () => {
  const p = newRun();
  assert.deepEqual(openRun(p.root), p);
  assert.throws(() => openRun(tmpDir("empty")), /not a run folder/);
});

test("writeWhole puts a new file in place of the old one, never writing into the old one", () => {
  const f = path.join(tmpDir("whole"), "state.json");
  fs.writeFileSync(f, "old");
  fs.linkSync(f, `${f}.before`);
  writeWhole(f, "new");
  assert.equal(fs.readFileSync(f, "utf8"), "new");
  assert.equal(fs.readFileSync(`${f}.before`, "utf8"), "old");
});

test("writeWhole flushes the new text to disk before it renames the file into place", (t) => {
  const f = path.join(tmpDir("whole"), "state.json");
  const order: string[] = [];
  const { fsyncSync, renameSync } = fs;
  t.mock.method(fs, "fsyncSync", (fd: number) => { order.push("flush"); fsyncSync(fd); });
  t.mock.method(fs, "renameSync", (from: string, to: string) => { order.push(`rename to ${path.basename(to)}`); renameSync(from, to); });
  writeWhole(f, "new");
  assert.deepEqual(order, ["flush", "rename to state.json"]);
});

test("writers in four processes at once each put a whole file in place, and leave no partial file", async () => {
  const dir = tmpDir("race");
  const f = path.join(dir, "status.md");
  const ends = await atOnce(["1", "2", "3", "4"].map((writer) => ["whole", f, writer, "100"]));
  assert.deepEqual(ends, [1, 2, 3, 4].map(() => ({ code: 0, stderr: "" })));
  const text = fs.readFileSync(f, "utf8");
  assert.match(text, /^writer [1-4]\n/);
  assert.equal(text, `${text.split("\n")[0]}\n`.repeat(20000));
  assert.deepEqual(fs.readdirSync(dir), ["status.md"]);
});

test("writeWhole leaves no partial file, and a stale partial file never replaces the state", () => {
  const p = newRun();
  const f = path.join(p.root, "note.txt");
  writeWhole(f, "new");
  assert.equal(fs.readFileSync(f, "utf8"), "new");
  assert.deepEqual(fs.readdirSync(p.root).filter((name) => name.endsWith(".partial")), []);
  const saved = sampleState();
  saveState(p, saved);
  fs.writeFileSync(p.state + ".partial", "{broken");
  assert.deepEqual(readState(p), saved);
});

test("saveState then readState round-trips the state", () => {
  const p = newRun();
  const s = sampleState();
  saveState(p, s);
  assert.deepEqual(readState(p), s);
});

test("a table is saved whole under tables/ and read back; a missing table reads as null", () => {
  const p = newRun();
  saveTable(p, "clauses-R1", { a: 1 });
  assert.ok(fs.existsSync(path.join(p.tables, "clauses-R1.json")));
  assert.deepEqual(readTable(p, "clauses-R1"), { a: 1 });
  assert.equal(readTable(p, "nothing"), null);
});

test("a table name that is not one file name is refused, and nothing outside tables/ changes", () => {
  const p = newRun();
  const state = fs.readFileSync(p.state, "utf8");
  for (const name of ["../state", "clauses-models/lodestar", "a\\b", ""]) {
    assert.throws(() => saveTable(p, name, { hijacked: true }), /one folder or file name/, name);
  }
  assert.throws(() => readTable(p, "../state"), /one folder or file name/);
  assert.equal(fs.readFileSync(p.state, "utf8"), state);
});
