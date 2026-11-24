import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { logQuestion, recordAnswer, type LoggedQuestion } from "../../run/question-log.ts";
import { chainHead } from "../../run/record.ts";
import { createRun, updateState, type ItemState, type RunState } from "../../run/state.ts";
import { statusLines, writeStatus, type StatusView } from "../../run/status.ts";
import { sampleState } from "../helpers/state.ts";
import { makeRepo, tmpDir } from "../helpers/tmp.ts";

const now = new Date("2026-11-23T06:00:00Z");
const u = { checks: 120, usd: 0.01 };
const head = "ab".repeat(32);
const item = (status: ItemState["status"]): ItemState => ({ status, answers: [] });

function question(over: Partial<LoggedQuestion>): LoggedQuestion {
  return {
    id: "q1", kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: "$5", items: [],
    askedAt: "2026-11-23T05:50:00Z", askedMessageId: "uuid-0", answer: null, answerMessageId: null, answeredAt: null,
    idNote: null, report: null, ...over,
  };
}

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
    budgets: { moneyUsd: 5, claudeRuns: 20, computeHours: null, questionId: "q1" },
    spend: { ...s.spend, jevUsd: 0.0042, claudeRuns: 3 },
    open: [
      { item: "7.clause:R2#c1", code: "user-unanswered", evidence: "question q2", needsPutOffQuestion: false },
      { item: "8.finding:f2", code: "doer-deferred", evidence: "", needsPutOffQuestion: true },
      { item: "7.clause:R3#c1", code: "needs-user-only-fact", evidence: "question q3", needsPutOffQuestion: false },
    ],
  };
}

function view(over: Partial<StatusView> = {}): StatusView {
  return { state: inStep7(), questions: [], head, now, doing: "mutation runner: clause 4 of 31", unpaid: u, jobs: [], events: [],
    ...over };
}

test("the top lines, in order: step and round, now, items passed, spend, unpaid checks, open items by code, updated, waiting on you, the record's hash", () => {
  const l = statusLines(view());
  assert.match(l[0], /^# verify-rules run status/);
  assert.deepEqual(l.slice(2, 11).map((x) => x.split(":")[0]), ["- step and round", "- now", "- items passed", "- spend",
    "- checks still unpaid", "- open items", "- updated", "- waiting on you", "- record hash"]);
  assert.match(l[5], /\$0\.0042 of \$5\.00 on Jev; 3 of 20 Claude runs/);
});

test("the top lines count only the current step's items, name each question and item that waits on the user, and give the record's hash", () => {
  const asked = [question({ answer: "$5", answeredAt: "2026-11-23T05:55:00Z" }), question({ id: "q2", kind: "a", topic: "lists" })];
  assert.deepEqual(statusLines(view({ questions: asked })).slice(2, 11), [
    "- step and round: step 7, round 2",
    "- now: mutation runner: clause 4 of 31",
    "- items passed: 1 of 3 in step 7",
    "- spend: $0.0042 of $5.00 on Jev; 3 of 20 Claude runs; no compute budget",
    "- checks still unpaid: 120, about $0.0100",
    "- open items: user-unanswered 1, doer-deferred 1, needs-user-only-fact 1",
    "- updated: 2026-11-23T06:00:00Z",
    "- waiting on you: question q2 (lists), item 7.clause:R2#c1, item 7.clause:R3#c1",
    `- record hash: ${head}`,
  ]);
});

test("a question with no answer waits on the user even when no open item cites it", () =>
  assert.equal(statusLines(view({ state: { ...inStep7(), open: [] }, questions: [question({})] }))[9],
    "- waiting on you: question q1 (budgets)"));

test("then every item of the current step with its state, where each long job writes its progress, then one line per event", () =>
  assert.deepEqual(statusLines(view({ jobs: [{ name: "test command all", progressFile: "evidence/all.progress" }],
    events: ["step 7 started", "clause 1 of 31 passed"] })).slice(11), [
    "",
    "## Items of step 7",
    "",
    "- 7.clause:R1#c1: passed",
    "- 7.clause:R1#c2: in progress",
    "- 7.clause:R2#c1: not started",
    "",
    "## Long jobs",
    "",
    "- test command all: progress in evidence/all.progress",
    "",
    "## Events",
    "",
    "- step 7 started",
    "- clause 1 of 31 passed",
  ]));

test("before the first step and the budgets, the top lines say so, and no long job runs", () => {
  const s: RunState = { ...sampleState(), step: null, round: 0, items: {}, budgets: null, open: [],
    spend: { ...sampleState().spend, jevUsd: 0, claudeRuns: 0 } };
  const l = statusLines(view({ state: s, head: "0".repeat(64), doing: "making the run folder", unpaid: { checks: 0, usd: 0 } }));
  assert.deepEqual(l.slice(2, 11), [
    "- step and round: not started",
    "- now: making the run folder",
    "- items passed: 0 of 0",
    "- spend: $0.0000 on Jev; 0 Claude runs; no budgets set yet",
    "- checks still unpaid: 0, about $0.0000",
    "- open items: none",
    "- updated: 2026-11-23T06:00:00Z",
    "- waiting on you: nothing",
    `- record hash: ${"0".repeat(64)}`,
  ]);
  assert.deepEqual(l.slice(l.indexOf("## Long jobs"), l.indexOf("## Long jobs") + 3), ["## Long jobs", "", "- none"]);
});

test("an item state outside the six allowed ones is refused", () => {
  const bad: RunState = { ...inStep7(), items: { "0.test:all": item("skipped" as ItemState["status"]) } };
  assert.throws(() => statusLines(view({ state: bad })), /item state/);
});

test("writeStatus reads the state, the question log and the record itself, and puts a whole new file in place", () => {
  const p = createRun("r", now, tmpDir("runs"), makeRepo({ "a.py": "x\n" }));
  const q = logQuestion(p, { kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: "$5", items: [] }, now);
  logQuestion(p, { kind: "c", topic: "login", text: "Please log in to Kaggle.", recommendation: null, items: [] }, now);
  recordAnswer(p, q.id, "$5", "uuid-1", now);
  fs.linkSync(p.status, `${p.status}.before`);
  writeStatus(p, { now, doing: "asking for a login", unpaid: u, jobs: [], events: ["run started"] });
  const lines = fs.readFileSync(p.status, "utf8").split("\n");
  assert.equal(lines[3], "- now: asking for a login");
  assert.equal(lines[9], "- waiting on you: question q2 (login)");
  assert.equal(lines[10], `- record hash: ${chainHead(p)}`);
  assert.equal(lines.at(-2), "- run started");
  assert.equal(fs.readFileSync(`${p.status}.before`, "utf8"), "");
});

test("writeStatus refuses a state whose answers the record does not hold", () => {
  const p = createRun("r", now, tmpDir("runs"), makeRepo({ "a.py": "x\n" }));
  updateState(p, (s) => { s.items["7.clause:R1#c1"] = { status: "passed", answers: [{ check: "correct", by: "jev", verdict: "PASS", entry: head }] }; });
  assert.throws(() => writeStatus(p, { now, doing: "", unpaid: u, jobs: [], events: [] }), /does not match the record/);
});
