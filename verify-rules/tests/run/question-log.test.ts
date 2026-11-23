import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import {
  logQuestion,
  questions,
  recordAnswer,
  recordReport,
  setAskedMessageId,
  type MessageKind,
} from "../../run/question-log.ts";
import { verifyRecord } from "../../run/record.ts";
import { createRun } from "../../run/state.ts";
import { atOnce } from "../helpers/at-once.ts";
import { makeRepo, tmpDir } from "../helpers/tmp.ts";

const now = new Date("2026-11-23T06:00:00Z");
const later = new Date("2026-11-23T06:05:00Z");
const budgets = { kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: "$5", items: [] } as const;

function newRun() {
  const repo = makeRepo({ "a.py": "x\n" });
  return { p: createRun("r", now, tmpDir("runs"), repo), repo };
}

test("a question is written the moment it is logged, with its kind, exact text, recommendation and the items it covers", () => {
  const { p } = newRun();
  const q = logQuestion(p, { kind: "a", topic: "lists", text: "Approve M1 to M3?", recommendation: null,
    items: ["9.change:M1", "9.change:M2"] }, now);
  assert.deepEqual(questions(p), [{
    id: q.id, kind: "a", topic: "lists", text: "Approve M1 to M3?", recommendation: null, items: ["9.change:M1", "9.change:M2"],
    askedAt: "2026-11-23T06:00:00Z", askedMessageId: null,
    answer: null, answerMessageId: null, answeredAt: null, idNote: null, report: null,
  }]);
  assert.deepEqual(fs.readFileSync(p.questions, "utf8").split("\n").map((line) => line && JSON.parse(line)), [q, ""]);
});

test("each question gets its own id", () => {
  const { p } = newRun();
  const q1 = logQuestion(p, budgets, now);
  const q2 = logQuestion(p, { kind: "c", topic: "login", text: "Please log in to Kaggle.", recommendation: null, items: [] }, now);
  assert.notEqual(q1.id, q2.id);
  assert.deepEqual(questions(p).map((x) => x.id), [q1.id, q2.id]);
});

test("the gate sets the id of the message the question was sent in, once", () => {
  const { p } = newRun();
  const q = logQuestion(p, budgets, now);
  assert.equal(setAskedMessageId(p, q.id, "uuid-0").askedMessageId, "uuid-0");
  assert.equal(questions(p)[0].askedMessageId, "uuid-0");
  assert.throws(() => setAskedMessageId(p, q.id, "uuid-9"), /already has its message id/);
});

test("an answer is recorded word for word with its message id and time, once", () => {
  const { p } = newRun();
  const q = logQuestion(p, budgets, now);
  recordAnswer(p, q.id, "  $5 and 20 Claude runs ", "uuid-1", later);
  const [logged] = questions(p);
  assert.equal(logged.answer, "  $5 and 20 Claude runs ");
  assert.equal(logged.answerMessageId, "uuid-1");
  assert.equal(logged.answeredAt, "2026-11-23T06:05:00Z");
  assert.equal(logged.idNote, null);
  assert.throws(() => recordAnswer(p, q.id, "again", "uuid-2", later), /already has its answer/);
  assert.equal(questions(p)[0].answer, "  $5 and 20 Claude runs ");
});

test("with no readable message id, the time is kept and the entry says the id could not be read", () => {
  const { p } = newRun();
  const q = logQuestion(p, { kind: "a", topic: "lists", text: "Approve M1 to M3?", recommendation: null, items: [] }, now);
  const answered = recordAnswer(p, q.id, "ok", null, later);
  assert.equal(answered.idNote, "the message id could not be read");
  assert.equal(answered.answeredAt, "2026-11-23T06:05:00Z");
  assert.deepEqual(questions(p), [answered]);
});

test("the chat report that followed the answer is kept, once", () => {
  const { p } = newRun();
  const q = logQuestion(p, budgets, now);
  assert.equal(recordReport(p, q.id, "Budgets set: $5 and 20 Claude runs.").report, "Budgets set: $5 and 20 Claude runs.");
  assert.throws(() => recordReport(p, q.id, "again"), /already has its report/);
});

test("an answer, a message id or a report for a question that is not in the log is refused", () => {
  const { p } = newRun();
  assert.throws(() => recordAnswer(p, "q9", "yes", "uuid-1", later), /no question q9/);
  assert.throws(() => setAskedMessageId(p, "q9", "uuid-1"), /no question q9/);
  assert.throws(() => recordReport(p, "q9", "done"), /no question q9/);
});

test("a message of no kind is refused", () => {
  const { p } = newRun();
  assert.throws(() => logQuestion(p, { ...budgets, kind: "d" as MessageKind }), /kind/);
  assert.deepEqual(questions(p), []);
});

test("every change to a question is chained into the record as the question's new version", () => {
  const { p, repo } = newRun();
  const q = logQuestion(p, budgets, now);
  setAskedMessageId(p, q.id, "uuid-0");
  recordAnswer(p, q.id, "$5", "uuid-1", later);
  const reported = recordReport(p, q.id, "Budgets set.");
  const chained = fs.readFileSync(p.record, "utf8").trimEnd().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(chained.map((e) => [e.kind, e.question.askedMessageId, e.question.answer, e.question.report]), [
    ["question", null, null, null], ["question", "uuid-0", null, null], ["question", "uuid-0", "$5", null],
    ["question", "uuid-0", "$5", "Budgets set."],
  ]);
  assert.deepEqual(chained.at(-1).question, reported);
  assert.equal(verifyRecord(p, repo, "main").ok, true);
});

test("a question log edited by hand is refused, and nothing more is written over it", () => {
  const { p } = newRun();
  const q = logQuestion(p, budgets, now);
  fs.writeFileSync(p.questions, fs.readFileSync(p.questions, "utf8").replace('"answer":null', '"answer":"no budget"'));
  assert.throws(() => questions(p), /the question log does not match the record: line 1/);
  assert.throws(() => recordAnswer(p, q.id, "$5", "uuid-1", later), /does not match the record/);
});

test("a log left one version behind the record by a stop between the two writes is read from the record", () => {
  const { p } = newRun();
  const q = logQuestion(p, budgets, now);
  const asLogged = fs.readFileSync(p.questions, "utf8");
  const answered = recordAnswer(p, q.id, "$5", "uuid-1", later);
  fs.writeFileSync(p.questions, asLogged);
  assert.deepEqual(questions(p), [answered]);
});

test("a question's entry edited in the record breaks the chain, and the log is not read", () => {
  const { p } = newRun();
  logQuestion(p, budgets, now);
  fs.writeFileSync(p.record, fs.readFileSync(p.record, "utf8").replace("What may this run spend?", "May I spend $500?"));
  assert.throws(() => questions(p), /the record is broken: line 1 does not follow/);
});

test("four processes logging questions at once give every question its own id", async () => {
  const { p, repo } = newRun();
  const ends = await atOnce([1, 2, 3, 4].map(() => ["ask", p.root, "20"]));
  assert.deepEqual(ends, [1, 2, 3, 4].map(() => ({ code: 0, stderr: "" })));
  assert.deepEqual(questions(p).map((q) => q.id), Array.from({ length: 80 }, (_, i) => `q${i + 1}`));
  assert.equal(verifyRecord(p, repo, "main").ok, true);
});
