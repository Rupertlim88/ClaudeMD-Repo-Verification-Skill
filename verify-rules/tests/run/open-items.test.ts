import assert from "node:assert/strict";
import { test } from "node:test";
import { declinedTrailer, firstLineCounts, readDeclinedTrailers, Refused, setOpen } from "../../run/open-items.ts";
import type { LoggedQuestion } from "../../run/question-log.ts";
import type { DeclinedItem, OpenItem, ReasonCode } from "../../run/state.ts";
import { git, makeRepo } from "../helpers/tmp.ts";

function question(over: Partial<LoggedQuestion>): LoggedQuestion {
  return {
    id: "q1", kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: "$5",
    askedAt: "2026-11-23T06:00:00Z", answer: null, answerMessageId: null, answeredAt: null, idNote: null, report: null,
    ...over,
  };
}

type Ctx = Parameters<typeof setOpen>[2];
function ctx(over: Partial<Ctx>): Ctx {
  return { questions: [], shippedChecks: new Set(), check: "7.clause", ...over };
}

function d(line: string): DeclinedItem {
  return { item: "C3", line, userWords: "no to C3", step: "9", date: "2026-11-23" };
}

function open(code: ReasonCode): OpenItem {
  return { item: `7.clause:R1#${code}`, code, evidence: "", needsPutOffQuestion: false };
}

test("user-unanswered needs the question's log entry", () => {
  const q = question({ id: "q4" });
  assert.throws(() => setOpen("7.c3", "user-unanswered", ctx({ questions: [], questionId: "q4" })), Refused);
  assert.throws(() => setOpen("7.c3", "user-unanswered", ctx({ questions: [q] })), Refused);
  assert.deepEqual(setOpen("7.c3", "user-unanswered", ctx({ questions: [q], questionId: q.id })),
    { item: "7.c3", code: "user-unanswered", evidence: "question q4", needsPutOffQuestion: false });
});

test("user-unanswered is refused once the question has an answer", () => {
  const q = question({ answer: "$5", answeredAt: "2026-11-23T06:05:00Z" });
  assert.throws(() => setOpen("7.c3", "user-unanswered", ctx({ questions: [q], questionId: q.id })), Refused);
});

test("user-deferred, budget-refused and continued-by-user need the user's words in the log", () => {
  const asked = question({ id: "q2" });
  const answered = question({ id: "q3", answer: "leave it for the next run", answeredAt: "2026-11-23T06:05:00Z" });
  for (const code of ["user-deferred", "budget-refused", "continued-by-user"] as const) {
    assert.throws(() => setOpen("7.c3", code, ctx({ questions: [asked], questionId: "q2" })), Refused, code);
    assert.equal(setOpen("7.c3", code, ctx({ questions: [answered], questionId: "q3" })).evidence, "question q3", code);
  }
});

test("needs-user-only-fact needs a request of kind c in the log", () => {
  const conceptual = question({ id: "q5", kind: "b" });
  const request = question({ id: "q6", kind: "c", topic: "login", text: "Please log in to Kaggle." });
  assert.throws(() => setOpen("7.c3", "needs-user-only-fact", ctx({ questions: [conceptual], questionId: "q5" })), Refused);
  assert.equal(setOpen("7.c3", "needs-user-only-fact", ctx({ questions: [request], questionId: "q6" })).evidence, "question q6");
});

test("other-owner needs the ownership note, branch or pull request", () => {
  assert.throws(() => setOpen("7.c3", "other-owner", ctx({})), Refused);
  assert.equal(setOpen("7.c3", "other-owner", ctx({ ownerEvidence: "branch fscn-rework, owned by another session" })).evidence,
    "branch fscn-rework, owned by another session");
});

test("later-version needs the check to be missing from the version's shipped checks", () => {
  assert.throws(() => setOpen("tie.p4:dup", "later-version",
    ctx({ check: "tie.p4.mutation", shippedChecks: new Set(["tie.p4.mutation"]) })), Refused);
  assert.equal(setOpen("tie.p4:dup", "later-version",
    ctx({ check: "tie.p4.duplicates", shippedChecks: new Set(["tie.p4.mutation"]) })).evidence,
    "the check tie.p4.duplicates is not in this version");
});

test("a code outside the fixed list is refused", () => {
  for (const code of ["whatever", "user-declined"]) {
    assert.throws(() => setOpen("7.c1", code as ReasonCode, ctx({})), Refused, code);
  }
});

test("doer-deferred needs no evidence, and is marked for the put-off question", () =>
  assert.equal(setOpen("8.f2", "doer-deferred", ctx({})).needsPutOffQuestion, true));

test("a declined item's trailer is one line", () =>
  assert.equal(declinedTrailer(d("C3. Keep the whole-folder mark\nsecond line")),
    "Verify-Rules-Declined: C3. Keep the whole-folder mark second line"));

test("readDeclinedTrailers reads every declined item from the branch's commit messages", () => {
  const repo = makeRepo({ "a.py": "x\n" });
  const trailerBlock = (...lines: string[]) => lines.join("\n");
  git(repo, "commit", "-q", "--allow-empty", "-m", "verify-rules: checkpoint of step 9",
    "-m", trailerBlock("Verify-Rules-Step: 9", declinedTrailer(d("C3. Keep the whole-folder mark")),
      declinedTrailer(d("M7. Rename the test file"))));
  git(repo, "commit", "-q", "--allow-empty", "-m", "verify-rules: checkpoint of step 14", "-m", "Verify-Rules-Step: 14");
  git(repo, "commit", "-q", "--allow-empty", "-m", "verify-rules: follow-up lists",
    "-m", trailerBlock("Verify-Rules-Step: 9", declinedTrailer(d("C9. Remove the old loader"))));
  assert.deepEqual(readDeclinedTrailers(repo, "main"), [
    "Verify-Rules-Declined: C3. Keep the whole-folder mark",
    "Verify-Rules-Declined: M7. Rename the test file",
    "Verify-Rules-Declined: C9. Remove the old loader",
  ]);
});

test("first-line counts: waiting = user-unanswered and needs-user-only-fact; doer = doer-deferred; other = the rest", () => {
  const mix = [open("user-unanswered"), open("needs-user-only-fact"), open("doer-deferred"), open("other-owner"),
    open("later-version")];
  assert.deepEqual(firstLineCounts(mix, [d("C3. Keep the mark")]), { open: 5, waiting: 2, doer: 1, other: 2, declined: 1 });
});
