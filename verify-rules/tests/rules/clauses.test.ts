import assert from "node:assert/strict";
import { test } from "node:test";
import { checkClauses, clauseTable, firstCut, floor, sentences } from "../../rules/clauses.ts";
import { readClaudeMd } from "../../rules/rule-reader.ts";

const pieces = (text: string, spans: [number, number][]) => spans.map(([s, e]) => text.slice(s, e));
const spansOf = (text: string, clauses: string[]): [number, number][] =>
  clauses.map((c) => [text.indexOf(c), text.indexOf(c) + c.length]);
const ruleOf = (claudeMd: string) => readClaudeMd("x/CLAUDE.md", claudeMd, "").rules[0];

// The loophole hunt's rule (tools: Clause-table builder 3), with its full list and the list that merged it.
const GRAPH = "- **Every experiment includes the threshold graph.** Its x-axis is the threshold: LodeSTAR's score cutoff, " +
  "from 0.96 to 0.999, in steps of 0.001. Its y-axis is the percentage hit, with one line for each type of object. " +
  "The graph also shows LodeSTAR alone, without FSCN, for comparison.";
const FULL = ["Every experiment includes the threshold graph.", "Its x-axis is the threshold: LodeSTAR's score cutoff,",
  "from 0.96", "to 0.999,", "in steps of 0.001.", "Its y-axis is the percentage hit,", "with one line for each type of object.",
  "The graph also shows LodeSTAR alone, without FSCN, for comparison."];
const MERGED = ["Every experiment includes the threshold graph.",
  "Its x-axis is the threshold: LodeSTAR's score cutoff, from 0.96 to 0.999, in steps of 0.001.",
  "Its y-axis is the percentage hit, with one line for each type of object.",
  "The graph also shows LodeSTAR alone, without FSCN, for comparison."];

test("sentence boundaries skip 'e.g.', 'et al.' and the point in '0.96'", () => {
  const t = "Use a cut, e.g. 0.96 of it. Next one.";
  assert.deepEqual(pieces(t, sentences(t)), ["Use a cut, e.g. 0.96 of it. ", "Next one."]);
  assert.equal(sentences("Smith et al. Showed it. Next one.").length, 2);
  assert.equal(sentences("It is set in step 2. Then it stops.").length, 2);
  assert.equal(sentences("It ends at 5 p.m. today. Next one.").length, 2);
});

test("each number and each keyword gets its own clause", () => {
  const t = "It uses 5,000 steps, 8 copies of each crop per step, and a rate of 0.001.";
  assert.deepEqual(pieces(t, firstCut(t)), ["It uses 5,000 steps, ", "8 copies of each crop per step, ", "and a rate of 0.001."]);
  const k = "Never stop, and always check each one.";
  assert.deepEqual(pieces(k, firstCut(k)), ["Never stop, ", "and always check ", "each one."]);
});

test("a keyword phrase is one marker: 'only after' is never split", () => {
  const t = "LodeSTAR is trained first and then frozen; only after that is the readout trained.";
  assert.deepEqual(pieces(t, firstCut(t)), [t]);
  const two = "Only after that, never before it.";
  assert.deepEqual(pieces(two, firstCut(two)), ["Only after that, ", "never before it."]);
  assert.equal(floor("It runs at most 3 times."), 1);
});

test("the rule's own list number is stripped before the cut", () => {
  const t = "8. **X.** It is one.";
  assert.deepEqual(pieces(t, firstCut(t)), ["8. **X.** ", "It is one."]);
  assert.equal(floor(t), 2);
});

test("each sub-rule starts a sentence, and its list number is no number", () => {
  const t = "- **Its fields.**\n   1. **Its type.** Tight.\n   2. **Its limits.** Set.";
  assert.deepEqual(pieces(t, sentences(t)),
    ["- **Its fields.**\n", "   1. **Its type.** ", "Tight.\n", "   2. **Its limits.** ", "Set."]);
  assert.equal(floor(t), 5);
  const semicolons = "- **It labels:**\n   1. **who may see it;**\n   2. **what it needs.**";
  assert.deepEqual(pieces(semicolons, sentences(semicolons)), ["- **It labels:**\n", "   1. **who may see it;**\n", "   2. **what it needs.**"]);
});

test("the floor is, per sentence, the larger of 1, its numbers and its keywords", () =>
  assert.equal(floor("It uses 5 steps and 8 copies. Never stop."), 3));

test("checkClauses fails two numbers in one clause, a list below the floor, a word in no clause and a span outside the text", () => {
  const t = "It uses 5 steps and 8 copies. Never stop.";
  assert.deepEqual(checkClauses(t, [[0, 20], [20, 30], [30, 41]]), { ok: true, clauses: 3, floor: 3, problems: [] });
  const whole = checkClauses(t, [[0, t.length]]);
  assert.equal(whole.ok, false);
  assert.ok(whole.problems.some((p) => /holds 2 numbers/.test(p)) && whole.problems.some((p) => /below the floor of 3/.test(p)));
  assert.ok(checkClauses(t, [[0, 13]]).problems.some((p) => /"steps" at 10 is in no clause/.test(p)));
  assert.ok(checkClauses(t, [[0, 999]]).problems.some((p) => /not inside the text/.test(p)));
  assert.ok(checkClauses("Never stop, always go.", [[0, 22]]).problems.some((p) => /holds 2 keywords/.test(p)));
});

test("eight clauses merged into four fail the floor (the loophole hunt's list)", () => {
  const merged = checkClauses(GRAPH, spansOf(GRAPH, MERGED));
  assert.deepEqual([merged.ok, merged.clauses, merged.floor], [false, 4, 6]);
  assert.ok(merged.problems.some((p) => /below the floor of 6/.test(p)));
  assert.deepEqual(checkClauses(GRAPH, spansOf(GRAPH, FULL)), { ok: true, clauses: 8, floor: 6, problems: [] });
});

test("a further cut inside a clause is kept; the cut never joins two clauses", () => {
  const rule = ruleOf("## A\n\n- **Trained the paper's way.** It uses 5,000 steps, 8 copies of each crop per step, and a rate of 0.001.\n");
  const first = clauseTable(rule).clauses.map((c) => c.text);
  assert.deepEqual(first, ["- **Trained the paper's way.** ", "It uses 5,000 steps, ", "8 copies of each crop per step, ", "and a rate of 0.001."]);
  const cut = rule.text.indexOf("of each");
  const further = clauseTable(rule, [cut]);
  assert.deepEqual(further.clauses.map((c) => c.text),
    ["- **Trained the paper's way.** ", "It uses 5,000 steps, ", "8 copies ", "of each crop per step, ", "and a rate of 0.001."]);
  assert.deepEqual(further.clauses.map((c) => c.id), [1, 2, 3, 4, 5].map((n) => `x/CLAUDE.md::Trained the paper's way.#c${n}`));
  assert.equal(further.clauses[3].start, cut);
  assert.equal(further.check.ok, true);
  const atBoundary = rule.text.indexOf("8 copies");
  assert.deepEqual(clauseTable(rule, [atBoundary, 0, -5, 9999]).clauses.map((c) => c.text), first);
});

test("bold markers and the file line need no clause", () => {
  const table = clauseTable(ruleOf("## A\n\n- **Dots are found by peaks.** Each peak gets a dot.\n  *File:* `dots.py`\n"));
  assert.deepEqual(table.clauses.map((c) => c.text), ["- **Dots are found by peaks.** ", "Each peak gets a dot."]);
  assert.equal(table.check.ok, true);
});

test("a fenced block, a table and a tag are never cut, and their numbers and keywords are no markers", () => {
  const t = "1. **The API has a spec.** *(NIST REC-API-1, REC-API-2)* It lists:\n\n   ```\n   GET /v1/a 200 only\n   ```\n\n" +
    "   | each | 1 | 2 |\n\n   Fields it does not list are refused.";
  assert.deepEqual(pieces(t, firstCut(t)), ["1. **The API has a spec.** *(NIST REC-API-1, REC-API-2)* ", t.slice(t.indexOf("It lists:"))]);
  assert.deepEqual(checkClauses(t, firstCut(t)), { ok: true, clauses: 2, floor: 2, problems: [] });
});

test("a clause list that leaves out a fenced block's or a table's words fails", () => {
  const t = "- **It lists.** These:\n\n  ```\n  alpha beta\n  ```\n\n  | gamma |\n";
  assert.equal(checkClauses(t, [[0, 16], [16, t.indexOf("\n\n  ```")]]).ok, false);
});

test("numbers and keywords inside a fenced block never force a cut", () => {
  const t = "- **It sends.** This:\n\n  ```\n  GET /a 200 404 only never\n  ```\n";
  assert.deepEqual(pieces(t, firstCut(t)), ["- **It sends.** ", t.slice(t.indexOf("This:"))]);
});

test("the cut between two markers never falls inside a number", () => {
  const t = "It uses 5,000 steps and 8 copies.";
  assert.deepEqual(pieces(t, firstCut(t)), ["It uses 5,000 steps and ", "8 copies."]);
});

test("an empty span is no clause", () =>
  assert.ok(checkClauses("Never stop. Go.", [[0, 12], [12, 12], [12, 15]]).problems.some((p) => /not inside the text/.test(p))));

test("the cut between two markers goes after the last comma between them", () => {
  const t = "It uses 5 steps, slowly, and 8 copies.";
  assert.deepEqual(pieces(t, firstCut(t)), ["It uses 5 steps, slowly, ", "and 8 copies."]);
});

test("a fence of four backticks is closed only by four, and nothing inside it is cut", () => {
  const t = "- **Shows code.** It prints:\n\n  ````\n  ```\n  each 5 and 8 never only\n  ```\n  ````\n";
  assert.deepEqual(pieces(t, firstCut(t)), ["- **Shows code.** ", t.slice(t.indexOf("It prints:"))]);
});

test("a fenced block left open in a rule's text ends at the first line indented no deeper than the rule's marker", () => {
  const t = "1. **One.** It sends:\n   ```\n   GET /a\nIt never stops, each time.";
  assert.deepEqual(pieces(t, firstCut(t)), ["1. **One.** ", "It sends:\n   ```\n   GET /a\nIt never stops, ", "each time."]);
});
