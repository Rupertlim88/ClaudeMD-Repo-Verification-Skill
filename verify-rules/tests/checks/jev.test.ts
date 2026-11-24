import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { accountNames, askJev, fillQuestion, QUESTIONS, stripSecrets, verdictOf, type Decide } from "../../checks/jev.ts";
import { entries } from "../../run/record.ts";
import { createRun, readState, updateState } from "../../run/state.ts";
import { makeRepo, tmpDir } from "../helpers/tmp.ts";

const t = QUESTIONS.templates;

test("a may-only-fail question fails below its fail line and is otherwise unsure, never a pass", () => {
  assert.equal(verdictOf(t["tie-part2-clause"], 0.34), "fail");
  assert.equal(verdictOf(t["tie-part2-clause"], 0.35), "unsure");
  assert.equal(verdictOf(t["tie-part2-clause"], 0.99), "unsure");
});

test("a deciding question passes at its pass line, fails below its fail line, and is unsure between", () => {
  assert.equal(verdictOf(t["tie-part3-file"], 0.73), "pass");
  assert.equal(verdictOf(t["tie-part3-file"], 0.72), "unsure");
  assert.equal(verdictOf(t["tie-part3-file"], 0.19), "unsure");
  assert.equal(verdictOf(t["tie-part3-file"], 0.18), "fail");
});

test("the templates hold the four parts of the tie check and the three checks, each with a sound threshold", () => {
  assert.deepEqual(Object.keys(t).sort(), ["complete", "correct", "same-code", "same-meaning", "tie-part1", "tie-part2-clause",
    "tie-part2-list", "tie-part3-file", "tie-part4-piece", "whole-process"]);
  for (const [name, x] of Object.entries(t)) {
    if (x.role === "may only fail") assert.equal(x.pass, null, name);
    else assert.ok(x.pass !== null && x.pass >= x.fail, name);
  }
  assert.notEqual(QUESTIONS.model, "typesafe-ai/jev");
});

test("a question is filled from its values, and a missing value is refused", () => {
  assert.equal(fillQuestion(t["tie-part2-clause"], { file: "a.py", clause: "It is fast." }),
    "Does `a.py` carry out this clause of its rule: 'It is fast.'?");
  assert.throws(() => fillQuestion(t["tie-part2-clause"], { file: "a.py" }), /clause/);
});

test("secrets and account names are stripped from a state, and only their kind and place are listed", () => {
  const state = 'ACCOUNT = "someone88"\nmail me at a.b@example.com\ntoken KGAT_abc123XYZ\nby Jo Smith\n';
  const { text, removed } = stripSecrets(state, ["Jo Smith"]);
  for (const secret of ["someone88", "a.b@example.com", "KGAT_abc123XYZ", "Jo Smith"]) assert.ok(!text.includes(secret), secret);
  assert.deepEqual(removed.map((r) => r.kind).sort(), ["account name", "account setting", "email", "key"]);
  assert.ok(!JSON.stringify(removed).includes("someone88"));
});

function run() {
  const p = createRun("r", new Date("2026-11-23T06:00:00Z"), tmpDir("runs"), makeRepo({ "a.py": "x = 1\n" }));
  updateState(p, (s) => { s.budgets = { moneyUsd: 0.01, claudeRuns: 2, computeHours: null, questionId: "q1" }; });
  return p;
}

function fake(provider: string | null, probability = 0.9) {
  const calls: Parameters<Decide>[0][] = [];
  const decide: Decide = async (a) => {
    calls.push(a);
    return {
      answers: { q: { type: "boolean", probability } }, usage: { inputTokens: 1000, outputTokens: 4 },
      response: { modelId: "typesafe-ai/jev-1.14.0", headers: { "x-vercel-id": "req-1" } },
      providerMetadata: provider === null ? {} : { gateway: { routing: { finalProvider: provider } } },
    };
  };
  return { calls, decide };
}

const request = { item: "tie.p3:a.py", template: "tie-part3-file", question: "Q?", state: "the state" };

test("a call sends the pinned model and one boolean question, and is recorded with its raw response", async () => {
  const p = run();
  const f = fake("typesafe-ai");
  const answer = await askJev(p, request, { decide: f.decide, accountNames: [] });
  assert.deepEqual(f.calls[0].questions, { q: { type: "boolean", instructions: "Q?" } });
  assert.equal(f.calls[0].model, QUESTIONS.model);
  assert.deepEqual([answer.p, answer.verdict, answer.provider, answer.requestId], [0.9, "pass", "typesafe-ai", "req-1"]);
  const saved = JSON.parse(fs.readFileSync(path.join(p.root, answer.file), "utf8"));
  assert.equal(saved.state, "the state");
  assert.equal(saved.stateSha256, createHash("sha256").update("the state").digest("hex"));
  const entry = entries(p).at(-1)!;
  assert.deepEqual([entry.kind, entry.item, entry.check, entry.verdict], ["answer", "tie.p3:a.py", "tie-part3-file", "pass"]);
  const s = readState(p);
  assert.deepEqual([s.spend.jevCalls, s.spend.jevInputTokens], [1, 1000]);
  assert.ok(Math.abs(s.spend.jevUsd - 1000 * QUESTIONS.usdPerInputToken) < 1e-12);
  assert.equal(s.items["tie.p3:a.py"].answers[0].verdict, "pass");
});

test("an answer served by another provider, or with none recorded, cannot be used", async () => {
  for (const provider of ["digitalocean", null]) {
    const answer = await askJev(run(), request, { decide: fake(provider).decide, accountNames: [] });
    assert.equal(answer.verdict, "unusable");
  }
});

test("no call is sent before the budgets are set, nor once the money budget is spent", async () => {
  const f = fake("typesafe-ai");
  const p = run();
  updateState(p, (s) => { s.budgets = null; });
  await assert.rejects(askJev(p, request, { decide: f.decide, accountNames: [] }), /budget/);
  updateState(p, (s) => { s.budgets = { moneyUsd: 0.01, claudeRuns: 2, computeHours: null, questionId: "q1" }; s.spend.jevUsd = 0.01; });
  await assert.rejects(askJev(p, request, { decide: f.decide, accountNames: [] }), /budget/);
  assert.equal(f.calls.length, 0);
});

test("the state is stripped before it is sent, and what was removed is listed in the run folder", async () => {
  const p = run();
  const f = fake("typesafe-ai");
  await askJev(p, { ...request, state: 'ACCOUNT = "someone88"' }, { decide: f.decide, accountNames: [] });
  assert.ok(!String(f.calls[0].state).includes("someone88"));
  assert.match(fs.readFileSync(path.join(p.jev, "stripped.jsonl"), "utf8"), /account setting/);
});

test("the account names found by script are the owner in the repo's origin remote", () => {
  const repo = makeRepo({ "a.py": "" });
  assert.deepEqual(accountNames(repo), []);
  execFileSync("git", ["remote", "add", "origin", "https://github.com/Someone88/project.git"], { cwd: repo });
  assert.deepEqual(accountNames(repo), ["Someone88"]);
});
