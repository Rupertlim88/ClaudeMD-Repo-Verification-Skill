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
import { sampleState } from "../helpers/state.ts";
import { makeRepo, tmpDir } from "../helpers/tmp.ts";

function newRun() {
  return createRun("r", new Date("2026-11-23T05:48:54Z"), tmpDir("runs"), makeRepo({ "a.py": "x = 1\n" }));
}

test("createRun names the folder after the repo and the start time, and makes every file", () => {
  const p = createRun("senior-thesis-research", new Date("2026-11-23T05:48:54Z"), tmpDir("runs"),
    makeRepo({ "a.py": "x = 1\n" }));
  assert.equal(path.basename(p.root), "senior-thesis-research-20261123T054854Z");
  for (const f of [p.state, p.record, p.questions, p.status]) assert.ok(fs.existsSync(f), f);
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

test("writeWhole leaves no partial file, and a stale partial file never replaces the state", () => {
  const p = newRun();
  const f = path.join(p.root, "note.txt");
  writeWhole(f, "new");
  assert.equal(fs.readFileSync(f, "utf8"), "new");
  assert.ok(!fs.existsSync(f + ".partial"));
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
