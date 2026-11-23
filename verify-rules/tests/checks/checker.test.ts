import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { checkerPrompt, parseAnswer, saveCheckerAnswer } from "../../checks/checker.ts";
import { entries } from "../../run/record.ts";
import { createRun, readState, updateState } from "../../run/state.ts";
import { makeRepo, tmpDir } from "../helpers/tmp.ts";

const ANSWER = "PASS — tie.p1:a.py — ties prints 0 broken\nFAIL — tie.p2:a.py#c2 — a.py:3 never checks the limit\n" +
  "A note about style.\nCORRECT PASS\nSAME PASS\nCOMPLETE FAIL\nSTEP FAIL\n";

test("the answer is read by its form: item lines, the three checks, and the checker's own step line", () => {
  const r = parseAnswer(ANSWER);
  assert.deepEqual(r.items, [{ verdict: "PASS", item: "tie.p1:a.py", evidence: "ties prints 0 broken" },
    { verdict: "FAIL", item: "tie.p2:a.py#c2", evidence: "a.py:3 never checks the limit" }]);
  assert.deepEqual(r.checks, { CORRECT: "PASS", SAME: "PASS", COMPLETE: "FAIL" });
  assert.deepEqual([r.stepLine, r.verdict, r.notes], ["FAIL", "FAIL", ["A note about style."]]);
});

test("the step passes only with every item and all three checks passed; a FAIL with no evidence is a note", () => {
  assert.equal(parseAnswer("PASS — x — ok\nCORRECT PASS\nSAME PASS\nCOMPLETE PASS\nSTEP PASS").verdict, "PASS");
  assert.equal(parseAnswer("PASS — x — ok\nCORRECT PASS\nSAME PASS\nSTEP PASS").verdict, "FAIL");
  assert.equal(parseAnswer("CORRECT PASS\nSAME PASS\nCOMPLETE PASS\nSTEP PASS").verdict, "FAIL");
  const r = parseAnswer("PASS — x — ok\nFAIL — y —\nCORRECT PASS\nSAME PASS\nCOMPLETE PASS\nSTEP PASS");
  assert.deepEqual([r.verdict, r.notes], ["PASS", ["FAIL — y —"]]);
});

function run() {
  const p = createRun("r", new Date("2026-11-23T06:00:00Z"), tmpDir("runs"), makeRepo({ "a.py": "" }));
  updateState(p, (s) => { s.doerModel = "claude-opus-5-5"; });
  return p;
}

test("a saved answer is captured in the run folder and recorded with its verdict and the checker's model", () => {
  const p = run();
  const saved = saveCheckerAnswer(p, "tie", "claude-sonnet-5-5", ANSWER);
  assert.equal(fs.readFileSync(path.join(p.root, saved.file), "utf8"), ANSWER);
  const e = entries(p).at(-1)!;
  assert.deepEqual([e.kind, e.step, e.model, e.verdict, e.fails], ["checker", "tie", "claude-sonnet-5-5", "FAIL", ["tie.p2:a.py#c2"]]);
  assert.equal(readState(p).spend.claudeRuns, 1);
});

test("a checker named by an alias, or on the doer's own model, is refused", () => {
  const p = run();
  for (const model of ["sonnet", "fable", "opus", "claude-opus-5-5"]) assert.throws(() => saveCheckerAnswer(p, "tie", model, ANSWER), /model/);
  assert.equal(entries(p).length, 0);
});

test("the prompt is the fixed prompt file with the skill, run, repo, step and round filled in", () => {
  const text = checkerPrompt({ skill: "/s", run: "/r", repo: "/repo", step: "tie", round: 2 });
  assert.match(text, /^# The Claude checker for step tie, round 2/);
  assert.match(text, /node \/s\/bin\/verify\.ts ties \/repo/);
  assert.match(text, /checker-answer --run \/r --step tie/);
  assert.doesNotMatch(text, /\{\{/);
});
