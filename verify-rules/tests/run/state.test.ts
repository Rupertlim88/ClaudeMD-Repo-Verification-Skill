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
  type RunState,
} from "../../run/state.ts";
import { makeRepo, tmpDir } from "../helpers/tmp.ts";

function newRun() {
  return createRun("r", new Date("2026-11-23T05:48:54Z"), tmpDir("runs"), makeRepo({ "a.py": "x = 1\n" }));
}

function someState(): RunState {
  return {
    repo: "/repos/r", scope: "models/lodestar", startCommit: "a".repeat(40), baseline: "b".repeat(40),
    baselineHow: "merge-base with main", branch: "verify-rules/run-1", doerModel: "claude-opus-5-5",
    step: "7", round: 2, stepStartCommit: "c".repeat(40),
    items: { "7.c1": { status: "passed", answers: [{ check: "correct", by: "jev", verdict: "PASS", ref: "jev/1.json" }] } },
    testCommands: [{ name: "all", command: "python -m pytest", exit: 0, outputFile: "evidence/all.txt" }],
    knownFailures: ["tests/test_x.py::test_slow"],
    budgets: { moneyUsd: 5, claudeRuns: 20, questionId: "q1" },
    spend: { jevCalls: 3, jevInputTokens: 4000, jevOutputTokens: 60, jevUsd: 0.0042, claudeRuns: 1, claudeSeconds: 90,
      claudeListUsd: 1.2 },
    open: [{ item: "8.f2", code: "doer-deferred", evidence: "", needsPutOffQuestion: true }],
    declined: [{ item: "C3", line: "C3. Keep the mark", userWords: "no to C3", step: "9", date: "2026-11-23" }],
    agents: [{ id: "a1", folder: "models/lodestar", started: "2026-11-23T06:00:00Z", reported: false, note: "agents/a1.md" }],
    mistakes: { "hand-typed fact": 1 },
    situation: { guess: "C", counts: { claudeMd: 3 } },
    steps: { "0": { result: "passed", rounds: 1 } },
  };
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
  const saved = someState();
  saveState(p, saved);
  fs.writeFileSync(p.state + ".partial", "{broken");
  assert.deepEqual(readState(p), saved);
});

test("saveState then readState round-trips the state", () => {
  const p = newRun();
  const s = someState();
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
