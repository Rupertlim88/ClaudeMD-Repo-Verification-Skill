import assert from "node:assert/strict";
import { test } from "node:test";
import { logQuestion, questions, recordAnswer, type MessageKind } from "../../run/question-log.ts";
import { createRun } from "../../run/state.ts";
import { makeRepo, tmpDir } from "../helpers/tmp.ts";

const now = new Date("2026-11-23T06:00:00Z");
const t = "2026-11-23T06:05:00Z";

function newRun() {
  return createRun("r", now, tmpDir("runs"), makeRepo({ "a.py": "x\n" }));
}

test("a question is written the moment it is logged, with its kind, exact text and recommendation", () => {
  const p = newRun();
  const q = logQuestion(p, { kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: "$5" }, now);
  assert.deepEqual(questions(p), [{
    id: q.id, kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: "$5",
    askedAt: "2026-11-23T06:00:00Z", answer: null, answerMessageId: null, answeredAt: null, idNote: null, report: null,
  }]);
});

test("each question gets its own id", () => {
  const p = newRun();
  const q1 = logQuestion(p, { kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: null }, now);
  const q2 = logQuestion(p, { kind: "c", topic: "login", text: "Please log in to Kaggle.", recommendation: null }, now);
  assert.notEqual(q1.id, q2.id);
  assert.deepEqual(questions(p).map((x) => x.id), [q1.id, q2.id]);
});

test("an answer is recorded word for word with its message id, once", () => {
  const p = newRun();
  const q = logQuestion(p, { kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: "$5" }, now);
  recordAnswer(p, q.id, "  $5 and 20 Claude runs ", "uuid-1", t);
  const [logged] = questions(p);
  assert.equal(logged.answer, "  $5 and 20 Claude runs ");
  assert.equal(logged.answerMessageId, "uuid-1");
  assert.equal(logged.answeredAt, t);
  assert.equal(logged.idNote, null);
  assert.throws(() => recordAnswer(p, q.id, "again", "uuid-2", t), /already answered/);
  assert.equal(questions(p)[0].answer, "  $5 and 20 Claude runs ");
});

test("with no readable message id, the time is kept and the entry says the id could not be read", () => {
  const p = newRun();
  const q = logQuestion(p, { kind: "a", topic: "lists", text: "Approve M1 to M3?", recommendation: null }, now);
  const answered = recordAnswer(p, q.id, "ok", null, t);
  assert.equal(answered.idNote, "the message id could not be read");
  assert.equal(answered.answeredAt, t);
  assert.deepEqual(questions(p), [answered]);
});

test("an answer to a question that is not in the log is refused", () => {
  const p = newRun();
  assert.throws(() => recordAnswer(p, "q9", "yes", "uuid-1", t), /no question q9/);
});

test("a message of no kind is refused", () => {
  const p = newRun();
  assert.throws(() => logQuestion(p, { kind: "d" as MessageKind, topic: "", text: "", recommendation: null }), /kind/);
  assert.deepEqual(questions(p), []);
});
