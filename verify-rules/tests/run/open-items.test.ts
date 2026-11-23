import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import {
  checkOf,
  CONTINUE_SENTENCE,
  declinedTrailer,
  firstLineCounts,
  readDeclinedTrailers,
  Refused,
  setOpen,
  type PutOff,
} from "../../run/open-items.ts";
import { logQuestion, recordAnswer, setAskedMessageId, type MessageKind } from "../../run/question-log.ts";
import { createRun, readState, type DeclinedItem, type OpenItem, type ReasonCode, type RunPaths } from "../../run/state.ts";
import { git, makeRepo, tmpDir } from "../helpers/tmp.ts";

const now = new Date("2026-11-23T06:00:00Z");
const item = "7.clause:R1#c1";

function newRun(): RunPaths {
  const repo = makeRepo({ "a.py": "x\n", "notes/owners.md": "Another session owns models/fscn.\n" });
  git(repo, "branch", "fscn-rework");
  return createRun("r", now, tmpDir("runs"), repo);
}

// Logs a question naming the items; unless told otherwise, the gate saw it sent, and the user's answer is recorded
// when one is given.
function ask(p: RunPaths, q: { kind: MessageKind; items: string[]; text?: string; answer?: string; sent?: boolean }): string {
  const logged = logQuestion(p, { kind: q.kind, topic: "t", text: q.text ?? "Shall I leave this for the next run?",
    recommendation: null, items: q.items }, now);
  if (q.sent ?? true) setAskedMessageId(p, logged.id, `uuid-${logged.id}`);
  if (q.answer !== undefined) recordAnswer(p, logged.id, q.answer, "uuid-answer", now);
  return logged.id;
}

const refused = (p: RunPaths, putOff: PutOff, why: RegExp, on = item) =>
  assert.throws(() => setOpen(p, on, putOff), (e) => e instanceof Refused && why.test(e.message));

function d(line: string): DeclinedItem {
  return { item: "C3", line, userWords: "no to C3", step: "9", date: "2026-11-23" };
}

function open(code: ReasonCode): OpenItem {
  return { item: `7.clause:R1#${code}`, code, evidence: "", needsPutOffQuestion: false };
}

test("user-unanswered needs a question in the log that names the item, was seen sent, and has no answer", () => {
  const p = newRun();
  const q = ask(p, { kind: "b", items: [item] });
  assert.deepEqual(setOpen(p, item, { code: "user-unanswered", question: q }),
    { item, code: "user-unanswered", evidence: `question ${q}`, needsPutOffQuestion: false });
  refused(p, { code: "user-unanswered", question: "q9" }, /question q9 is not in the question log/);
  refused(p, { code: "user-unanswered", question: ask(p, { kind: "b", items: [item], sent: false }) }, /was not seen sent/);
  refused(p, { code: "user-unanswered", question: ask(p, { kind: "b", items: [item], answer: "yes" }) }, /must be unanswered/);
});

test("one question cannot put off items it does not name", () => {
  const p = newRun();
  const q = ask(p, { kind: "b", items: [], text: "Anything else?" });
  for (const unrelated of ["7.clause:R1#c1", "7.clause:R9#c4", "tie.p2:R3"]) {
    refused(p, { code: "user-unanswered", question: q }, /question q1 does not name/, unrelated);
  }
});

test("user-deferred needs the user's answer to a question that names the item", () => {
  const p = newRun();
  refused(p, { code: "user-deferred", question: ask(p, { kind: "a", items: [item] }) }, /must be answered/);
  assert.equal(setOpen(p, item, { code: "user-deferred", question: ask(p, { kind: "a", items: [item], answer: "leave it" }) }).evidence,
    "question q2");
});

test("needs-user-only-fact needs a request of kind c that names the item", () => {
  const p = newRun();
  refused(p, { code: "needs-user-only-fact", question: ask(p, { kind: "b", items: [item] }) }, /must be of kind c/);
  assert.equal(setOpen(p, item, { code: "needs-user-only-fact", question: ask(p, { kind: "c", items: [item] }) }).evidence,
    "question q2");
});

test("budget-refused needs the user's answer to a question of kind b, never a list's approval", () => {
  const p = newRun();
  refused(p, { code: "budget-refused", question: ask(p, { kind: "a", items: [item], answer: "approve all" }) }, /must be of kind b/);
  refused(p, { code: "budget-refused", question: ask(p, { kind: "b", items: [item] }) }, /must be answered/);
  assert.equal(setOpen(p, item, { code: "budget-refused", question: ask(p, { kind: "b", items: [item], answer: "no more money" }) })
    .evidence, "question q3");
});

test("continued-by-user needs the user's answer to the script's continue question, of kind b", () => {
  const p = newRun();
  const plain = ask(p, { kind: "b", items: [item], text: "Continue?", answer: "yes" });
  refused(p, { code: "continued-by-user", question: plain }, /must be the script's continue question/);
  const scripted = ask(p, { kind: "b", items: [item], text: `7.clause:R1#c1 failed. ${CONTINUE_SENTENCE}`, answer: "continue" });
  assert.equal(setOpen(p, item, { code: "continued-by-user", question: scripted }).evidence, `question ${scripted}`);
});

test("other-owner needs a git ref or a file in the repo that exists", () => {
  const p = newRun();
  for (const owner of ["fscn-rework", "notes/owners.md"]) {
    assert.equal(setOpen(p, item, { code: "other-owner", owner }).evidence, owner);
  }
  const outside = [p.state, path.relative(readState(p).repo, p.state)];
  for (const owner of ["x", "", "notes", "--all", ...outside]) {
    refused(p, { code: "other-owner", owner }, /is neither a git ref nor a file in the repo/);
  }
});

test("later-version takes the check from the item's id, and needs it to be a check of a later version", () => {
  const p = newRun();
  const checks = { "7.clause": "shipped", "14.duplicates": "later" } as const;
  assert.equal(checkOf("7.clause:R12#c3@models/lodestar"), "7.clause");
  assert.equal(setOpen(p, "14.duplicates:repo", { code: "later-version", checks }).evidence,
    "the check 14.duplicates is in a later version");
  refused(p, { code: "later-version", checks }, /the check 7\.clause is in this version/);
  refused(p, { code: "later-version", checks }, /7\.made-up is not a check of the skill/, "7.made-up:x");
});

test("a code outside the fixed list is refused", () => {
  const p = newRun();
  for (const code of ["whatever", "user-declined"]) {
    refused(p, { code } as unknown as PutOff, /is not a reason code/);
  }
});

test("doer-deferred needs no evidence, and is marked for the put-off question", () =>
  assert.equal(setOpen(newRun(), item, { code: "doer-deferred" }).needsPutOffQuestion, true));

test("a declined item's trailer is one line, whatever its line ends", () =>
  assert.equal(declinedTrailer(d("C3. Keep the mark\r\nsecond\rthird\nfourth")),
    "Verify-Rules-Declined: C3. Keep the mark second third fourth"));

test("readDeclinedTrailers reads every declined item from the branch's commit messages, oldest first", () => {
  const repo = makeRepo({ main: "a file named like the branch\n" });
  const trailerBlock = (...lines: string[]) => lines.join("\n");
  git(repo, "commit", "-q", "--allow-empty", "-m", "verify-rules: checkpoint of step 9",
    "-m", trailerBlock("Verify-Rules-Step: 9", declinedTrailer(d("C3. Keep the whole-folder mark")),
      declinedTrailer(d("M7. Rename the test file"))));
  git(repo, "commit", "-q", "--allow-empty", "-m", "verify-rules: checkpoint of step 14", "-m", "Verify-Rules-Step: 14");
  git(repo, "commit", "-q", "--allow-empty", "-m", "verify-rules: follow-up lists",
    "-m", trailerBlock("Verify-Rules-Step: 9", declinedTrailer(d("C9. Remove the old loader"))));
  assert.deepEqual(readDeclinedTrailers(repo, "main"),
    ["C3. Keep the whole-folder mark", "M7. Rename the test file", "C9. Remove the old loader"]);
});

test("first-line counts: waiting = user-unanswered and needs-user-only-fact; doer = doer-deferred; other = the rest", () => {
  const mix = [open("user-unanswered"), open("needs-user-only-fact"), open("doer-deferred"), open("other-owner"),
    open("later-version")];
  assert.deepEqual(firstLineCounts(mix, [d("C3. Keep the mark")]), { open: 5, waiting: 2, doer: 1, other: 2, declined: 1 });
});
