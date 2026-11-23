import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { copiedOpening, readAll, readClaudeMd, ruleKey } from "../../rules/rule-reader.ts";

const BLOCK = `## System Rules

### Persona

You are a careful engineer.

| Tool | Use |
|---|---|
| tests | always |

- Plain words, short sentences.
1. Run every test.
`;

const GLOBAL = `# Project — global rules

## What the CLAUDE.md files are
Summary line one.

Summary line two.

## Rules about the CLAUDE.md files

1. **Never change a CLAUDE.md unless the user directly asks you to.** Rest of rule one.

2. **The CLAUDE.md files that are allowed.** Only these:
   - **Global**: the one at the root.
   - **Part**: the one in the part folder.

${BLOCK}
## How work is done

3. **Test first, always.** Write a failing test first.
`;

const LOWER = `# Part — rules

## What the CLAUDE.md files are
Summary line one.

Summary line two.

## The rule never to change a CLAUDE.md (copied)

1. **Never change a CLAUDE.md unless the user directly asks you to.** Rest of rule one.

Stray scope line.

## How it works

- **A rule with sub-rules.** First sentence.
  - **A sub-rule.** It holds 5 things.
  1. A sub-rule with no bold sentence.
  *File:* \`a.py\`
- **Second rule.** Only one.
  *File:* the whole folder
- an unnamed rule
4. **A numbered rule.** Its number is kept.
`;

const read = (text: string, global = GLOBAL) => readClaudeMd("x/CLAUDE.md", text, global);
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

test("reads numbered rules and top-level bold bullets, with bold sentence, number, span, category and file line", () => {
  const r = read(LOWER).rules;
  assert.deepEqual(r.map((x) => [x.bold, x.number, x.indent, x.startLine, x.endLine, x.category]), [
    ["A rule with sub-rules.", null, 0, 16, 18, "How it works"],
    ["Second rule.", null, 0, 20, 20, "How it works"],
    [null, null, 0, 22, 22, "How it works"],
    ["A numbered rule.", 4, 0, 23, 23, "How it works"],
  ]);
  assert.deepEqual(r[0].fileLine, { kind: "path", path: "a.py", line: 19 });
  assert.deepEqual(r[1].fileLine, { kind: "whole-folder", line: 21 });
  assert.equal(r[0].text,
    "- **A rule with sub-rules.** First sentence.\n  - **A sub-rule.** It holds 5 things.\n  1. A sub-rule with no bold sentence.");
  assert.equal(r[0].claude, "x/CLAUDE.md");
  assert.equal(r[0].key, "x/CLAUDE.md::A rule with sub-rules.");
});

test("an item with no bold sentence is read as unnamed, never skipped", () => {
  const unnamed = read(LOWER).rules[2];
  assert.equal(unnamed.bold, null);
  assert.equal(unnamed.text, "- an unnamed rule");
  assert.equal(unnamed.key, `x/CLAUDE.md::unnamed::${sha256("- an unnamed rule").slice(0, 12)}`);
  assert.equal(read("## A\n\n- Bold **inside** an item is not its bold sentence.\n").rules[0].bold, null);
});

test("ruleKey joins the CLAUDE.md and the bold sentence, or a hash of the text for an unnamed rule", () => {
  assert.equal(ruleKey("a/CLAUDE.md", "Same.", "- **Same.** One."), "a/CLAUDE.md::Same.");
  assert.equal(ruleKey("a/CLAUDE.md", null, "- one"), `a/CLAUDE.md::unnamed::${sha256("- one").slice(0, 12)}`);
});

test("copiedOpening is the global summary section and its rule never to change a CLAUDE.md, line for line", () =>
  assert.deepEqual(copiedOpening(GLOBAL), [
    "## What the CLAUDE.md files are", "Summary line one.", "", "Summary line two.",
    "1. **Never change a CLAUDE.md unless the user directly asks you to.** Rest of rule one.",
  ]));

test("the copied opening is skipped by its exact lines; a later section whose heading starts like the opening's is still read", () => {
  assert.deepEqual(read(LOWER).skipped, [{ kind: "copied opening", start: 3, end: 10 }]);
  const lookAlike = read(LOWER + "\n## What the CLAUDE.md files are\n\n- **Own rule.**\n\n" +
    "## The rule never to change a CLAUDE.md\n\n- **Third rule.**\n");
  assert.deepEqual(lookAlike.rules.slice(4).map((r) => r.bold), ["Own rule.", "Third rule."]);
  const twice = read(LOWER + "\n## Again\n\n1. **Never change a CLAUDE.md unless the user directly asks you to.** Rest of rule one.\n");
  assert.deepEqual(twice.rules.slice(4).map((r) => r.number), [1]);
});

test("a copy of the summary that differs by one character is not skipped: its lines are stray", () => {
  const drifted = read(LOWER.replace("Summary line two.", "Summary line two!"));
  assert.deepEqual(drifted.skipped, [{ kind: "copied opening", start: 10, end: 10 }]);
  assert.deepEqual(drifted.stray.map((s) => s.line), [4, 6, 12]);
});

test("a '## System Rules' section is one skipped unit, matched by its exact text", () => {
  const res = read(LOWER + "\n" + BLOCK);
  assert.deepEqual(res.skipped.map((s) => s.kind), ["copied opening", "system rules block"]);
  assert.deepEqual(res.skipped[1], { kind: "system rules block", start: 25, end: 36 });
  assert.equal(res.rules.length, 4);
  assert.deepEqual(res.stray.map((s) => s.line), [12]);
  const different = read(LOWER + "\n" + BLOCK.replace("Run every test.", "Run some tests."));
  assert.deepEqual(different.skipped.map((s) => s.kind), ["copied opening"]);
  assert.deepEqual(different.rules.slice(4).map((r) => r.text), ["- Plain words, short sentences.", "1. Run some tests."]);
});

test("in the global CLAUDE.md the summary and the block are skipped, and the rule never to change a CLAUDE.md is read", () => {
  const res = readClaudeMd("CLAUDE.md", GLOBAL, GLOBAL);
  assert.deepEqual(res.skipped, [{ kind: "global summary", start: 3, end: 6 }, { kind: "system rules block", start: 16, end: 27 }]);
  assert.deepEqual(res.rules.map((r) => [r.number, r.bold]), [
    [1, "Never change a CLAUDE.md unless the user directly asks you to."],
    [2, "The CLAUDE.md files that are allowed."],
    [3, "Test first, always."],
  ]);
  assert.deepEqual(res.stray, []);
});

test("a rule's text keeps its indented lines, fenced blocks, tables and tags whole, and ends at the next rule, heading or file line", () => {
  const text = [
    "## Shapes", "",
    "1. **A rule with a block.** *(NIST REC-API-3)* It sends:", "",
    "   ```", "   # not a heading", "   - not a rule", "   ```", "",
    "   | a | b |", "   |---|---|", "",
    "   More text after a blank line.",
    "2. **Next rule.** Ends the one before.",
    "   *File:* `n.py`",
    "- **Third.** Ends at the heading.",
    "## Next", "",
  ].join("\n");
  const res = read(text);
  assert.deepEqual(res.rules.map((r) => [r.bold, r.startLine, r.endLine, r.category]), [
    ["A rule with a block.", 3, 13, "Shapes"],
    ["Next rule.", 14, 14, "Shapes"],
    ["Third.", 16, 16, "Shapes"],
  ]);
  assert.equal(res.rules[0].text, text.split("\n").slice(2, 13).join("\n"));
  assert.deepEqual(res.rules[0].subrules, []);
  assert.deepEqual([res.stray, res.problems], [[], []]);
});

test("a sub-rule, with or without a bold sentence, is part of its parent's text and listed in subrules", () => {
  const r = read(LOWER).rules;
  assert.deepEqual(r[0].subrules, [{ bold: "A sub-rule.", line: 17 }, { bold: null, line: 18 }]);
  assert.ok(r[0].text.includes("1. A sub-rule with no bold sentence."));
  assert.equal(r.length, 4);
});

test("bold sentences keep every character exactly", () =>
  assert.equal(read("## A\n\n- **Size is 64 × 64 px, 4 %: it’s fixed —** More.\n").rules[0].bold,
    "Size is 64 × 64 px, 4 %: it’s fixed —"));

test("a CRLF file reads the same rules as its LF copy", () => {
  const crlf = (text: string) => text.replace(/\n/g, "\r\n");
  assert.deepEqual(read(crlf(LOWER)), read(LOWER));
  assert.deepEqual(read(crlf(LOWER), crlf(GLOBAL)), read(LOWER));
});

test("non-blank lines outside a heading, the opening, the block, a rule and a file line are stray, with their lines", () => {
  assert.deepEqual(read(LOWER).stray, [{ line: 12, text: "Stray scope line." }]);
  const res = read("## A\n\nA line under a heading.\n- **One.** Text.\n  *File:* `one.py`\nA line after a file line.\n\n" +
    "```\n- code outside any rule\n```\n");
  assert.deepEqual(res.stray, [{ line: 3, text: "A line under a heading." }, { line: 6, text: "A line after a file line." },
    { line: 8, text: "```" }, { line: 9, text: "- code outside any rule" }, { line: 10, text: "```" }]);
  assert.equal(res.rules.length, 1);
});

test("a rule's text runs over blank lines to the next rule at its indent or lower, the next heading, or its file line", () => {
  const res = readSmall("## A\n\n12. **Test first.** Use TDD.\n\nCode written before its test is deleted.\n\n- **Next.**\n## B\n\n" +
    "- **Last.** One.\n\nIts second paragraph.\n  *File:* `last.py`\n\n");
  assert.deepEqual(res.rules.map((r) => [r.bold, r.startLine, r.endLine]), [["Test first.", 3, 5], ["Next.", 7, 7], ["Last.", 10, 12]]);
  assert.equal(res.rules[0].text, "12. **Test first.** Use TDD.\n\nCode written before its test is deleted.");
  assert.deepEqual(res.rules[2].fileLine, { kind: "path", path: "last.py", line: 13 });
  assert.deepEqual([res.stray, res.problems], [[], []]);
});

test("a file line not directly under its rule, and a second file line, are problems", () => {
  const res = read([
    "## A", "",
    "- **One.**", "",
    "  *File:* `a.py`",
    "- **Two.**",
    "  *File:* `b.py`",
    "  *File:* `c.py`", "",
    "## B",
    "  *File:* `d.py`",
    "- **Three.**",
    "  *File:* needed",
    "- **Four.**",
    "  *File:* somewhere",
  ].join("\n"));
  assert.deepEqual(res.problems, [
    { line: 5, text: "  *File:* `a.py`", problem: "a file line is not directly under its rule's text" },
    { line: 8, text: "  *File:* `c.py`", problem: "a rule names two files" },
    { line: 11, text: "  *File:* `d.py`", problem: "a file line is not directly under its rule's text" },
    { line: 15, text: "  *File:* somewhere", problem: "a file line names no file, nor 'the whole folder' or 'needed'" },
  ]);
  assert.deepEqual(res.rules.map((r) => r.fileLine), [
    null, { kind: "path", path: "b.py", line: 7 }, { kind: "needed", line: 13 }, null,
  ]);
});

test("readAll reads every CLAUDE.md against the global one; two rules with the same number are both read", () => {
  const all = readAll(new Map([
    ["CLAUDE.md", GLOBAL], ["part/CLAUDE.md", LOWER], ["a/CLAUDE.md", "## A\n\n3. **Rule in a.**\n"],
    ["b/CLAUDE.md", "## B\n\n3. **Rule in b.**\n"], ["a/x.py", "x = 1\n"],
  ]));
  assert.deepEqual([...all.keys()], ["CLAUDE.md", "part/CLAUDE.md", "a/CLAUDE.md", "b/CLAUDE.md"]);
  assert.deepEqual([all.get("CLAUDE.md"), all.get("part/CLAUDE.md")],
    [readClaudeMd("CLAUDE.md", GLOBAL, GLOBAL), readClaudeMd("part/CLAUDE.md", LOWER, GLOBAL)]);
  assert.deepEqual(all.get("part/CLAUDE.md")!.skipped.map((s) => s.kind), ["copied opening"]);
  const threes = [...all.values()].flatMap((r) => r.rules).filter((r) => r.number === 3);
  assert.deepEqual(threes.map((r) => r.key), ["CLAUDE.md::Test first, always.", "a/CLAUDE.md::Rule in a.", "b/CLAUDE.md::Rule in b."]);
});

// A small global with no System Rules block, as in senior-thesis-research.
const SMALL_GLOBAL = "# G\n\n## What the CLAUDE.md files are\nSummary.\n\n## Rules\n\n" +
  "1. **Never change a CLAUDE.md unless the user directly asks you to.** Rest.\n";
const readSmall = (text: string) => readClaudeMd("x/CLAUDE.md", text, SMALL_GLOBAL);

test("a heading ends a rule even when a line follows it with no blank line", () => {
  const res = readSmall("## A\n\n- **One.**\n## B\n  *File:* `x.py`\n");
  assert.deepEqual(res.problems.map((p) => p.problem), ["a file line is not directly under its rule's text"]);
  assert.equal(res.rules[0].endLine, 3);
});

test("a line straight after a file line is stray, not the rule's text", () =>
  assert.deepEqual(readSmall("## A\n\n- **One.** Text.\n  *File:* `a.py`\nAfter the file line.\n").stray.map((s) => s.line), [5]));

test("the bold sentence is the first bold span, not up to the last", () =>
  assert.equal(readSmall("## A\n\n18. **Mode switch.** The mode is: **test**.\n").rules[0].bold, "Mode switch."));

test("a line of spaces is a blank line", () => {
  const res = readSmall("## A\n   \n- **One.** Text.\n   \n  *File:* `a.py`\n");
  assert.deepEqual([res.rules[0].endLine, res.stray], [3, []]);
  assert.deepEqual(res.problems.map((p) => p.problem), ["a file line is not directly under its rule's text"]);
});

test("a global with no System Rules block skips only the opening", () =>
  assert.deepEqual(readSmall("# L\n\n## What the CLAUDE.md files are\nSummary.\n\n## Own\n\n- **Own.**\n").skipped,
    [{ kind: "copied opening", start: 3, end: 4 }]));

test("a global whose last section is the System Rules block is read", () => {
  const global = SMALL_GLOBAL + "\n## System Rules\n\n- Plain words.\n";
  assert.deepEqual(readClaudeMd("CLAUDE.md", global, global).skipped.map((s) => s.kind), ["global summary", "system rules block"]);
});

test("a line that starts '-x' or '1.5' is no item", () =>
  assert.deepEqual(readSmall("## A\n\n-x is not a bullet\n1.5 is not a number item\n").rules, []));

test("a fence of four backticks is closed only by four", () => {
  const res = readSmall("## A\n\n- **One.** It shows:\n  ````\n  ```\n  - **Not a sub-rule.**\n  ```\n  ````\n- **Two.**\n");
  assert.deepEqual(res.rules.map((r) => [r.bold, r.endLine, r.subrules]), [["One.", 8, []], ["Two.", 9, []]]);
});

test("the line after a skipped unit is read", () =>
  assert.deepEqual(readSmall("# L\n\n## What the CLAUDE.md files are\nSummary.\n- **Straight after the opening.**\n").rules.map((r) => r.bold),
    ["Straight after the opening."]));

test("a fenced block left open in a rule's text ends at the first line indented no deeper than the rule's marker", () => {
  const res = readSmall("## A\n\n1. **One.** It sends:\n   ```\n   GET /a\n2. **Two.** Should be a rule.\n   *File:* `two.py`\n" +
    "3. **Three.** Also.\n");
  assert.deepEqual(res.rules.map((r) => [r.bold, r.startLine, r.endLine, r.fileLine?.line ?? null]),
    [["One.", 3, 5, null], ["Two.", 6, 6, 7], ["Three.", 8, 8, null]]);
  assert.deepEqual([res.stray, res.problems], [[], []]);
});

test("a fenced block still open at the end of the file is a problem, and hides no rule", () => {
  const margin = readSmall("## A\n\n- **One.** Text.\n\n```\n\n- **Two.** Hidden.\n- **Three.** Hidden.\n");
  assert.deepEqual(margin.problems, [{ line: 5, text: "```", problem: "a fenced block is never closed" }]);
  assert.deepEqual(margin.stray.map((s) => s.line), [5, 7, 8]);
  assert.deepEqual(margin.rules.map((r) => r.bold), ["One."]);
  const inRule = readSmall("## A\n\n- **One.** It shows:\n  ```\n  code\n");
  assert.deepEqual(inRule.problems.map((p) => [p.line, p.problem]), [[4, "a fenced block is never closed"]]);
  assert.equal(inRule.rules[0].endLine, 5);
});

test("a fenced block at a rule's indent or the margin is in no rule: its lines are stray and no rule is read inside it", () => {
  const res = readSmall("## A\n\n- **One.** Text:\n```\n- **Two.**\n```\n- **Three.**\n```\n```python\n- **Hidden.**\n```\n");
  assert.deepEqual(res.rules.map((r) => [r.bold, r.startLine, r.endLine]), [["One.", 3, 3], ["Three.", 7, 7]]);
  assert.deepEqual(res.stray.map((s) => s.line), [4, 5, 6, 8, 9, 10, 11]);
  assert.deepEqual(res.problems, []);
});

test("a numbered line straight after a line of text is a sub-rule only if it is numbered 1 or goes on a list", () => {
  const res = readSmall("## A\n\n- **Cap.** The cap is set to\n  16. It is measured first.\n- **Steps.** Two:\n  1. First,\n" +
    "  2. then second.\n\n  5. Fifth, after a blank line.\n");
  assert.deepEqual(res.rules.map((x) => [x.bold, x.subrules.map((sub) => sub.line)]), [["Cap.", []], ["Steps.", [6, 7, 9]]]);
});

test("a bold sentence is trimmed, as both repos' checks read it", () => {
  const rule = readSmall("## A\n\n- **Rule. ** Text.\n  - ** Sub. ** Its text.\n").rules[0];
  assert.deepEqual([rule.bold, rule.key, rule.subrules], ["Rule.", "x/CLAUDE.md::Rule.", [{ bold: "Sub.", line: 4 }]]);
});

test("the copied opening's two parts are one skipped span only when nothing but blank lines and headings lies between", () => {
  const res = readSmall("# L\n\n## What the CLAUDE.md files are\nSummary.\n\n## Own rules\n\n2. **Own rule.** Read as a rule.\n" +
    "1. **Never change a CLAUDE.md unless the user directly asks you to.** Rest.\n");
  assert.deepEqual(res.skipped, [{ kind: "copied opening", start: 3, end: 4 }, { kind: "copied opening", start: 9, end: 9 }]);
  assert.deepEqual(res.rules.map((r) => [r.bold, r.startLine]), [["Own rule.", 8]]);
});

test("unnamed rules with the same text get distinct keys, the first as ruleKey gives it", () => {
  const first = `x/CLAUDE.md::unnamed::${sha256("- the same words").slice(0, 12)}`;
  assert.deepEqual(readSmall("## A\n\n- the same words\n\n## B\n\n- the same words\n- the same words\n").rules.map((r) => r.key),
    [first, `${first}::2`, `${first}::3`]);
  assert.equal(ruleKey("x/CLAUDE.md", null, "- the same words", 2), `${first}::2`);
  assert.equal(ruleKey("x/CLAUDE.md", "Named.", "- **Named.**", 2), "x/CLAUDE.md::Named.");
});

test("in the global CLAUDE.md, an item in the summary is a problem, and the System Rules block is listed for a later version", () => {
  const global = SMALL_GLOBAL.replace("Summary.\n", "Summary.\n- **Hidden in the summary.** Never read.\n") +
    "\n## System Rules\n\n- **In the block.**\n3. **Also in it.**\n";
  const res = readClaudeMd("CLAUDE.md", global, global);
  assert.deepEqual(res.problems,
    [{ line: 5, text: "- **Hidden in the summary.** Never read.", problem: "an item in the global's summary is never read as a rule" }]);
  assert.deepEqual(res.laterVersion, [{ kind: "system rules block", start: 11, end: 14 }]);
  assert.deepEqual(res.skipped.map((s) => s.kind), ["global summary", "system rules block"]);
  const lower = readClaudeMd("x/CLAUDE.md", "# L\n\n## What the CLAUDE.md files are\nSummary.\n- **Hidden in the summary.** Never read.\n" +
    "\n## System Rules\n\n- **In the block.**\n3. **Also in it.**\n", global);
  assert.deepEqual([lower.skipped.map((s) => s.kind), lower.problems, lower.laterVersion], [["copied opening", "system rules block"], [], []]);
});
