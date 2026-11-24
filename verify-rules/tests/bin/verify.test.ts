import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { entries } from "../../run/record.ts";
import { openRun, readState } from "../../run/state.ts";
import { GLOBAL, OPENING } from "../helpers/repo-view.ts";
import { makeRepo, tmpDir } from "../helpers/tmp.ts";

const VERIFY = path.resolve(import.meta.dirname, "../../bin/verify.ts");

function verify(args: string[], input = "", cwd = process.cwd()) {
  const r = spawnSync("node", [VERIFY, ...args], { encoding: "utf8", input, cwd, env: { ...process.env, AI_GATEWAY_API_KEY: "" } });
  return { out: r.stdout, err: r.stderr, code: r.status };
}

const TIED = {
  "CLAUDE.md": GLOBAL,
  "part/CLAUDE.md": OPENING + "- **Dots are found.** It finds dots. It never counts a dot twice.\n  *File:* `dots.py`\n" +
    "- **Outlines are drawn.** It draws outlines.\n  *File:* `outline.py`\n",
  "part/dots.py": '"""Dots are found."""\n\nLIMIT = 3\n\n\ndef dots(xs):\n    return xs[:LIMIT]\n',
  "part/outline.py": '"""Outlines are drawn."""\n\n\ndef outline(x):\n    return x\n',
};

function start(files: Record<string, string>) {
  const repo = makeRepo(files);
  const r = verify(["start", repo, "--doer", "claude-opus-5-5", "--base", tmpDir("runs")]);
  const run = /^Run folder: (.+)$/m.exec(r.out)?.[1];
  return { repo, run: run!, ...r };
}

test("start makes the run folder outside the repo, finds the situation, and says what to do next", () => {
  const r = start(TIED);
  assert.equal(r.code, 0, r.err);
  assert.ok(!r.run.startsWith(fs.realpathSync(r.repo)));
  const s = readState(openRun(r.run));
  assert.deepEqual([s.situation?.guess, s.doerModel, s.step], ["D", "claude-opus-5-5", "0"]);
  assert.match(r.out, /Situation: D/);
  assert.match(r.out, /verify\.ts budget/);
  assert.match(fs.readFileSync(path.join(r.run, "status.md"), "utf8"), /step 0, round 1/);
});

test("start tells an empty repo, code with no CLAUDE.md, and a partly tied repo apart", () => {
  assert.match(start({ ".gitignore": "x\n" }).out, /Situation: A/);
  assert.match(start({ "main.py": "x = 1\n" }).out, /Situation: B/);
  assert.match(start({ ...TIED, "part/extra.py": "x = 1\n" }).out, /Situation: C/);
});

test("start needs the doer's model id", () => {
  const r = verify(["start", makeRepo(TIED), "--base", tmpDir("runs")]);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /--doer/);
});

test("ties lists what is broken and not yet tied, and fails only on a broken tie", () => {
  const good = verify(["ties", makeRepo(TIED)]);
  assert.equal(good.code, 0, good.err);
  assert.match(good.out, /0 broken ties; 0 rules needing a file, 0 rules not yet marked, 0 files not yet tied/);
  const untied = verify(["ties", makeRepo({ ...TIED, "part/extra.py": "x = 1\n" })]);
  assert.equal(untied.code, 0);
  assert.match(untied.out, /^file not yet tied {2}part\/extra\.py$/m);
  const broken = verify(["ties", makeRepo({ ...TIED, "part/dots.py": '"""Dots!"""\n' })]);
  assert.equal(broken.code, 1);
  assert.match(broken.out, /^BROKEN {2}part\/dots\.py: its heading does not state/m);
});

test("ties counts the exempt files per group", () => {
  assert.match(verify(["ties", makeRepo({ ...TIED, ".gitignore": "x\n" })]).out, /exempt: tool settings 1, CLAUDE\.md files 2\)/);
});

test("an interpreter given by a relative path is used from where verify was run", () => {
  const here = tmpDir("python");
  fs.symlinkSync(spawnSync("python3", ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" }).stdout.trim(), path.join(here, "py"));
  const r = verify(["ties", makeRepo(TIED), "--python", "./py"], "", here);
  assert.equal(r.code, 0, r.err);
});

test("with --run, an output is captured in the run folder and recorded", () => {
  const r = start(TIED);
  const out = verify(["ties", r.repo, "--run", r.run]);
  const captured = /captured: (evidence\/\S+)/.exec(out.out)![1];
  assert.match(fs.readFileSync(path.join(r.run, captured), "utf8"), /0 broken ties/);
  assert.equal(entries(openRun(r.run)).at(-1)!.kind, "output");
});

test("rules summarises the rule reader's result, and --json gives it whole", () => {
  const repo = makeRepo(TIED);
  assert.match(verify(["rules", repo]).out, /^part\/CLAUDE\.md: 2 rules \(2 named, 0 unnamed\), 2 file lines/m);
  const json = JSON.parse(verify(["rules", repo, "--json"]).out);
  assert.equal(json["part/CLAUDE.md"].rules[1].bold, "Outlines are drawn.");
});

test("clauses prints each rule's clause table and whether it passes its floor; --rule picks one rule", () => {
  const out = verify(["clauses", makeRepo(TIED), "--rule", "Dots are found."]).out;
  assert.match(out, /^part\/CLAUDE\.md: "Dots are found\." 3 clauses, floor 3: passes$/m);
  assert.match(out, /^ {2}c3 \[\d+-\d+\] "It never counts a dot twice\."$/m);
  assert.doesNotMatch(out, /Outlines are drawn/);
});

test("items prints every item's fixed question and the jev command that asks it", () => {
  const out = verify(["items", makeRepo(TIED), "--folder", "part"]).out;
  assert.match(out, /Q: Does `part\/dots\.py` carry out this clause of its rule: 'It never counts a dot twice\.'\?/);
  assert.match(out, /verify\.ts jev --run "\$RUN" --item 'tie\.p2:part\/dots\.py#c3' --template tie-part2-clause --rule 'Dots are found\.' --file 'part\/dots\.py'/);
  assert.match(out, /part 4/);
  assert.match(verify(["items", makeRepo(TIED), "--python", "python3"]).out, /--file 'part\/dots\.py' --python 'python3'$/m);
});

test("jev refuses an item the item list does not hold, a mismatched rule, and evidence verify did not capture", () => {
  const r = start(TIED);
  const ask = (...args: string[]) => verify(["jev", "--run", r.run, ...args]);
  assert.match(ask("--item", "tie.p9:x", "--template", "tie-part1").err, /no item tie\.p9:x/);
  assert.match(ask("--item", "tie.p3:part/dots.py", "--template", "tie-part3-file", "--rule", "Outlines are drawn.", "--file", "part/dots.py").err,
    /rule/);
  fs.writeFileSync(path.join(r.run, "evidence", "typed.txt"), "all good");
  assert.match(ask("--item", "0.x", "--template", "correct", "--step", "0", "--evidence", "evidence/typed.txt").err, /not captured/);
  assert.equal(readState(openRun(r.run)).spend.jevCalls, 0);
});

test("the question log keeps the answer exactly as typed, and budgets need an answered question", () => {
  const r = start(TIED);
  const asked = verify(["log-question", "--run", r.run, "--kind", "c", "--topic", "budgets"], "What may this run spend?\n");
  assert.match(asked.out, /logged q1/);
  assert.match(verify(["status", "--run", r.run]).out, /waiting on you: question q1 \(budgets\)/);
  assert.match(verify(["budget", "--run", r.run, "--question", "q1", "--usd", "1", "--claude-runs", "5"]).err, /no answer/);
  verify(["log-answer", "--run", r.run, "--id", "q1"], "$1, and 5 Claude runs  \n");
  const q = JSON.parse(fs.readFileSync(path.join(r.run, "questions.jsonl"), "utf8").trim().split("\n").at(-1)!);
  assert.equal(q.answer, "$1, and 5 Claude runs  ");
  assert.equal(verify(["budget", "--run", r.run, "--question", "q1", "--usd", "1", "--claude-runs", "5"]).code, 0);
  assert.deepEqual(readState(openRun(r.run)).budgets, { moneyUsd: 1, claudeRuns: 5, questionId: "q1" });
});

test("step sets the step the status file follows, and a step again starts its next round", () => {
  const r = start(TIED);
  verify(["step", "--run", r.run, "--step", "tie"]);
  verify(["step", "--run", r.run, "--step", "tie"]);
  assert.match(verify(["status", "--run", r.run]).out, /step tie, round 2/);
  assert.notEqual(verify(["step", "--run", r.run, "--step", "5"]).code, 0);
});

test("checker-prompt prints the filled prompt, and checker-answer records the checker's answer", () => {
  const r = start(TIED);
  assert.match(verify(["checker-prompt", "--run", r.run, "--step", "tie"]).out, new RegExp(`checker-answer --run ${r.run} --step tie`));
  const saved = verify(["checker-answer", "--run", r.run, "--step", "tie", "--model", "claude-sonnet-5-5"],
    "PASS — tie.p1:part/dots.py — ok\nCORRECT PASS\nSAME PASS\nCOMPLETE PASS\nSTEP PASS\n");
  assert.match(saved.out, /step tie: PASS/);
  assert.equal(entries(openRun(r.run)).at(-1)!.kind, "checker");
});

test("capture runs a command in the run's repo, captures its output and exit, and the output can then be evidence", () => {
  const r = start(TIED);
  const out = verify(["capture", "--run", r.run, "--name", "tests", "--", "python3", "-c", "import os; print(os.listdir('part'))"]);
  assert.equal(out.code, 0, out.err);
  const file = /captured: (evidence\/tests-1\.txt)/.exec(out.out)![1];
  assert.match(fs.readFileSync(path.join(r.run, file), "utf8"), /dots\.py/);
  const e = entries(openRun(r.run)).at(-1)!;
  assert.deepEqual([e.kind, e.exit], ["output", 0]);
  assert.equal(verify(["capture", "--run", r.run, "--name", "fails", "--", "python3", "-c", "raise SystemExit(3)"]).code, 3);
});

test("start records the baseline: the start commit, and how it was chosen", () => {
  const r = start(TIED);
  const s = readState(openRun(r.run));
  assert.ok(s.startCommit.length === 40, s.startCommit);
  assert.equal(s.baseline, s.startCommit);
  assert.match(s.baselineHow, /start commit/);
});

test("capture --test records the test command, its exit and its output file in the state", () => {
  const r = start(TIED);
  const c = verify(["capture", "--run", r.run, "--name", "tests", "--test", "--", "sh", "-c", "echo 3 passed; exit 0"]);
  assert.equal(c.code, 0, c.err);
  const s = readState(openRun(r.run));
  assert.deepEqual(s.testCommands, [{ name: "tests", command: "sh -c echo 3 passed; exit 0", exit: 0, outputFile: "evidence/tests-1.txt" }]);
  const plain = verify(["capture", "--run", r.run, "--name", "other", "--", "true"]);
  assert.equal(plain.code, 0, plain.err);
  assert.equal(readState(openRun(r.run)).testCommands.length, 1);
});
