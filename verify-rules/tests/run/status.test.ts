import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { createRun, type ItemState, type RunState } from "../../run/state.ts";
import { statusLines, writeStatus } from "../../run/status.ts";
import { sampleState } from "../helpers/state.ts";
import { makeRepo, tmpDir } from "../helpers/tmp.ts";

const now = new Date("2026-11-23T06:00:00Z");
const u = { checks: 120, usd: 0.01 };
const item = (status: ItemState["status"]): ItemState => ({ status, answers: [] });

function inStep7(): RunState {
  const s = sampleState();
  return {
    ...s,
    step: "7",
    round: 2,
    items: {
      "0.test:all": item("passed"),
      "7.clause:R1#c1": item("passed"),
      "7.clause:R1#c2": item("in progress"),
      "7.clause:R2#c1": item("not started"),
    },
    budgets: { moneyUsd: 5, claudeRuns: 20, questionId: "q1" },
    spend: { ...s.spend, jevUsd: 0.0042, claudeRuns: 3 },
    open: [
      { item: "7.clause:R2#c1", code: "user-unanswered", evidence: "question q2", needsPutOffQuestion: false },
      { item: "8.finding:f2", code: "doer-deferred", evidence: "", needsPutOffQuestion: true },
      { item: "7.clause:R3#c1", code: "needs-user-only-fact", evidence: "question q3", needsPutOffQuestion: false },
    ],
  };
}

test("the top lines, in order: step and round, now, items passed, spend, unpaid checks, open items by code, updated, waiting on you", () => {
  const l = statusLines(inStep7(), now, "mutation runner: clause 4 of 31", u, []);
  assert.match(l[0], /^# verify-rules run status/);
  assert.deepEqual(l.slice(2, 10).map((x) => x.split(":")[0]),
    ["- step and round", "- now", "- items passed", "- spend", "- checks still unpaid", "- open items", "- updated", "- waiting on you"]);
  assert.match(l[5], /\$0\.0042 of \$5\.00 on Jev; 3 of 20 Claude runs/);
});

test("the top lines count only the current step's items, and name what waits on the user", () =>
  assert.deepEqual(statusLines(inStep7(), now, "mutation runner: clause 4 of 31", u, []).slice(2, 10), [
    "- step and round: step 7, round 2",
    "- now: mutation runner: clause 4 of 31",
    "- items passed: 1 of 3 in step 7",
    "- spend: $0.0042 of $5.00 on Jev; 3 of 20 Claude runs",
    "- checks still unpaid: 120, about $0.0100",
    "- open items: user-unanswered 1, doer-deferred 1, needs-user-only-fact 1",
    "- updated: 2026-11-23T06:00:00Z",
    "- waiting on you: 7.clause:R2#c1, 7.clause:R3#c1",
  ]));

test("then every item of the current step with its state, then one line per event", () =>
  assert.deepEqual(statusLines(inStep7(), now, "", u, ["step 7 started", "clause 1 of 31 passed"]).slice(10), [
    "",
    "## Items of step 7",
    "",
    "- 7.clause:R1#c1: passed",
    "- 7.clause:R1#c2: in progress",
    "- 7.clause:R2#c1: not started",
    "",
    "## Events",
    "",
    "- step 7 started",
    "- clause 1 of 31 passed",
  ]));

test("before the first step and the budgets, the top lines say so", () => {
  const s: RunState = { ...sampleState(), step: null, round: 0, items: {}, budgets: null, open: [],
    spend: { ...sampleState().spend, jevUsd: 0, claudeRuns: 0 } };
  assert.deepEqual(statusLines(s, now, "making the run folder", { checks: 0, usd: 0 }, []).slice(2, 10), [
    "- step and round: not started",
    "- now: making the run folder",
    "- items passed: 0 of 0",
    "- spend: $0.0000 on Jev; 0 Claude runs; no budgets set yet",
    "- checks still unpaid: 0, about $0.0000",
    "- open items: none",
    "- updated: 2026-11-23T06:00:00Z",
    "- waiting on you: nothing",
  ]);
});

test("an item state outside the six allowed ones is refused", () => {
  const bad: RunState = { ...inStep7(), items: { "0.test:all": item("skipped" as ItemState["status"]) } };
  assert.throws(() => statusLines(bad, now, "", u, []), /item state/);
});

test("writeStatus writes the status file whole", () => {
  const p = createRun("r", now, tmpDir("runs"), makeRepo({ "a.py": "x\n" }));
  writeStatus(p, inStep7(), now, "mutation runner: clause 4 of 31", u, ["step 7 started"]);
  const lines = fs.readFileSync(p.status, "utf8").split("\n");
  assert.match(lines[0], /^# verify-rules run status/);
  assert.equal(lines[3], "- now: mutation runner: clause 4 of 31");
  assert.equal(lines.at(-2), "- step 7 started");
  assert.ok(!fs.existsSync(p.status + ".partial"));
});
