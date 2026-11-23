import assert from "node:assert/strict";
import { test } from "node:test";
import { pythonLanguage } from "../../code/python.ts";
import { brokenLines, tieCheck, type TieReport } from "../../rules/tie-check.ts";
import { GLOBAL, memoryRepo, OPENING, THESIS } from "../helpers/repo-view.ts";

const py = pythonLanguage(process.env.VR_TEST_PYTHON ?? "python3");
const check = (files: Record<string, string>) => tieCheck(memoryRepo({ "CLAUDE.md": GLOBAL, ...files }), THESIS, [py]);
const fileProblems = (r: TieReport) => r.broken.map((b) => [b.file, b.problem]);
const bolds = (refs: { bold: string | null }[]) => refs.map((ref) => ref.bold);
const HEADING_WRONG = "its heading does not state the bold sentence of the rule that names it";

// senior-thesis-research's shape: a global CLAUDE.md whose tree labels its parts in bold, and LodeSTAR's CLAUDE.md with
// its scope line on line 14 and a rule whose bold sentence is that label.
const SUMMARY = "## What the CLAUDE.md files are\nSummary one.\n\nSummary two.\n\nSummary three.\n";
const NEVER = "1. **Never change a CLAUDE.md unless the user directly asks you to.** Rest.\n";
const lower = (title: string, scope: string, rules: string) =>
  `# ${title} — rules\n\n${SUMMARY}\n## The rule never to change a CLAUDE.md (from the global CLAUDE.md)\n\n${NEVER}\n${scope}\n\n${rules}`;
const lodestarLike = tieCheck(memoryRepo({
  "CLAUDE.md": `# Global rules\n\n${SUMMARY}\n## Rules about the CLAUDE.md files\n\n${NEVER}\n` +
    "2. **The CLAUDE.md files that are allowed.** They form a tree:\n   - **Global**: the CLAUDE.md at the repo root.\n" +
    "     - **Models**: a CLAUDE.md at the top of the models folder.\n" +
    "       - **LodeSTAR**: a CLAUDE.md at the top of the LodeSTAR folder.\n",
  "models/CLAUDE.md": lower("Models", "Models are everything in the models folder.", "## How\n\n- **The models are kept apart.**\n"),
  "models/lodestar/CLAUDE.md": lower("LodeSTAR", "LodeSTAR is everything in the LodeSTAR folder.",
    "## What LodeSTAR is\n\n- **LodeSTAR** is the LodeSTAR class from the deeplay library, used as it is.\n  *File:* the whole folder\n"),
}), THESIS, [py]);

test("a heading that states a rule of any CLAUDE.md that does not name that file is broken, not only one of the nearest", () =>
  assert.deepEqual(check({
    "a/CLAUDE.md": OPENING + "- **The a rule.**\n  *File:* `a.py`\n", "a/a.py": '"""The a rule."""\n',
    "b/CLAUDE.md": OPENING, "b/x.py": '"""The a rule."""\n',
    "b/y.py": '"""Never change a CLAUDE.md unless the user directly asks you to."""\n',
  }).broken.map((b) => [b.file, b.problem, b.claude]), [
    ["b/x.py", "its heading states a rule that does not name it", "a/CLAUDE.md"],
    ["b/y.py", "its heading states a rule that does not name it", "CLAUDE.md"],
  ]));

test("a heading that differs from its rule's bold sentence by one character is broken", () => {
  const rule = "- **Size is 64 × 64 px, 4 %: it’s fixed —**\n  *File:* `size.py`\n";
  const tied = (heading: string, claude = OPENING + rule) => check({ "part/CLAUDE.md": claude, "part/size.py": `"""${heading}"""\n` });
  assert.deepEqual(tied("Size is 64 × 64 px, 4 %: it’s fixed —").broken, []);
  assert.deepEqual(tied("Size is 64 × 64 px, 4 %: it’s fixed —", (OPENING + rule).replace(/\n/g, "\r\n")).broken, []);
  for (const wrong of ["Size is 64 x 64 px, 4 %: it’s fixed —", "Size is 64 × 64 px, 4 %: it's fixed —", "Size is 64 × 64 px, 4 %: it’s fixed -"])
    assert.deepEqual(fileProblems(tied(wrong)), [["part/size.py", HEADING_WRONG]], wrong);
  assert.deepEqual(fileProblems(check({ "part/CLAUDE.md": OPENING + "- **Run.**\n  *File:* `run.sh`\n", "part/run.sh": "#!/bin/sh\n# Run.\n" })),
    [["part/run.sh", HEADING_WRONG]]);                     // no heading reader for shell files yet
});

test("a counted file whose nearest CLAUDE.md is not lowest-level is broken", () => {
  const r = check({
    "part/CLAUDE.md": OPENING, "part/f.py": "x = 1\n", "part/sub/CLAUDE.md": OPENING, "part/sub/g.py": "y = 2\n", "parts/CLAUDE.md": OPENING,
  });
  assert.deepEqual(r.lowest, ["part/sub/CLAUDE.md", "parts/CLAUDE.md"]);
  assert.deepEqual(r.broken.map((b) => [b.file, b.problem, b.claude]),
    [["part/f.py", "its nearest CLAUDE.md is not lowest-level", "part/CLAUDE.md"]]);
  assert.deepEqual(r.notYetTied.files, ["part/sub/g.py"]);
  const uncovered = tieCheck(memoryRepo({ "part/CLAUDE.md": "## A\n\n- **One.**\n", "other/x.py": "x = 1\n" }), THESIS, [py]);
  assert.deepEqual([uncovered.broken, uncovered.notYetTied.files], [[], ["other/x.py"]]);
});

test("a rule naming a file outside its CLAUDE.md's folder is broken", () => {
  assert.deepEqual(fileProblems(check({ "part/CLAUDE.md": OPENING + "- **Outside.**\n  *File:* `../x.py`\n", "x.py": "x = 1\n" })), [
    ["x.py", "is outside the folder of the CLAUDE.md that names it"], ["x.py", "its nearest CLAUDE.md is not lowest-level"],
  ]);
  assert.deepEqual(fileProblems(check({ "part/CLAUDE.md": OPENING + "- **Next door.**\n  *File:* `../parts/x.py`\n" })),
    [["parts/x.py", "is outside the folder of the CLAUDE.md that names it"]]);
  assert.deepEqual(fileProblems(tieCheck(memoryRepo({ "CLAUDE.md": "## A\n\n- **Above.**\n  *File:* `../x.py`\n" }), THESIS, [py])),
    [["../x.py", "is outside the folder of the CLAUDE.md that names it"]]);
});

test("an unmarked specific rule and a 'needed' one are not yet tied; a 'whole folder' rule is general", () => {
  const r = check({ "part/CLAUDE.md": OPENING + "- **Unmarked.**\n- **Needed.**\n  *File:* needed\n- **Whole.**\n  *File:* the whole folder\n" });
  assert.deepEqual([bolds(r.specific), bolds(r.notYetTied.rules), r.broken], [["Unmarked.", "Needed."], ["Unmarked.", "Needed."], []]);
  assert.deepEqual(r.general.map((g) => [g.rule.claude, g.rule.bold, g.mark]), [
    ["CLAUDE.md", "Never change a CLAUDE.md unless the user directly asks you to.", null], ["part/CLAUDE.md", "Whole.", "whole-folder"],
  ]);
});

test("a folder of data named outside its CLAUDE.md's folder is broken; a migrations folder ties as one folder of data", () => {
  const r = check({
    "part/CLAUDE.md": OPENING + "- **Old data.**\n  *File:* `../data/`\n- **Every change is kept.**\n  *File:* `migrations/`\n",
    "part/migrations/RULE.md": "# Every change is kept.\n", "part/migrations/001_init.sql": "create table t (x int);\n",
    "part/migrations/002_more.sql": "alter table t add y int;\n",
  });
  assert.deepEqual(fileProblems(r), [["data/", "is outside the folder of the CLAUDE.md that names it"]]);
  assert.deepEqual(r.ties.map((t) => [t.rule.bold, t.file]), [["Every change is kept.", "part/migrations/"]]);
  assert.deepEqual(r.counted, ["part/migrations/"]);
  const root = tieCheck(memoryRepo({ "CLAUDE.md": "## A\n\n- **All of it.**\n  *File:* `./`\n", "RULE.md": "# All of it.\n", "a.csv": "" }),
    THESIS, [py]);
  assert.deepEqual([root.broken, root.counted, root.ties.map((t) => t.file)], [[], ["./"], ["./"]]);
});

test("a bold sentence shared with any CLAUDE.md, a sub-rule or the global tree's labels is broken, and says whether the texts agree", () => {
  assert.ok(lodestarLike.broken.some((b) => b.file === "models/lodestar/CLAUDE.md" && b.problem ===
    "the bold sentence 'LodeSTAR' is also the bold sentence of a sub-rule in CLAUDE.md (texts differ)"));
  assert.deepEqual(fileProblems(check({
    "a/CLAUDE.md": OPENING + "- **Twice.** One text,\n  on two lines.\n- **Holder.** It holds two.\n  - **Inner.** A.\n  - **Inner.** B.\n",
    "b/CLAUDE.md": OPENING + "1. **Twice.** One text,\n   on two lines.\n",
  })), [
    ["a/CLAUDE.md", "the bold sentence 'Inner.' is also the bold sentence of a sub-rule in a/CLAUDE.md (texts differ)"],
    ["b/CLAUDE.md", "the bold sentence 'Twice.' is also the bold sentence of a rule in a/CLAUDE.md (texts agree)"],
  ]);
});

test("an unnamed rule is listed as unnamed, and in a lowest-level CLAUDE.md it is also broken", () => {
  const r = check({ "CLAUDE.md": GLOBAL + "\n- a global rule with no bold sentence\n", "part/CLAUDE.md": OPENING + "- a part rule with no bold sentence\n" });
  assert.deepEqual(r.unnamed.map((u) => u.claude), ["CLAUDE.md", "part/CLAUDE.md"]);
  assert.deepEqual(r.broken.map((b) => [b.file, b.problem, b.rule]),
    [["part/CLAUDE.md", "a rule with no bold sentence cannot be tied", "- a part rule with no bold sentence"]]);
});

test("a stray non-blank line in a lowest-level CLAUDE.md is broken (the LodeSTAR scope line)", () => {
  assert.ok(lodestarLike.broken.some((b) => b.file === "models/lodestar/CLAUDE.md" &&
    b.problem === "line 14 is not a heading, the copied opening, a rule's text or a file line"));
  assert.ok(!lodestarLike.broken.some((b) => b.file === "models/CLAUDE.md"));
});

test("a file whose type cannot carry a heading, outside a folder of data and not exempt, cannot be tied", () => {
  const r = check({
    "part/CLAUDE.md": OPENING + "- **Kept.**\n  *File:* `kept/`\n", "part/kept/RULE.md": "# Kept.\n", "part/kept/a.json": "{}",
    "part/table.json": "{}", "part/picture.png": "\u0089PNG\r\n\u001a\n\u0000", "part/tests/fixture.json": "{}", "part/notes.txt": "Notes.\n",
  });
  assert.deepEqual(r.cannotCarryHeading, ["part/picture.png", "part/table.json"]);
  assert.deepEqual(r.notYetTied.files, ["part/notes.txt", "part/picture.png", "part/table.json"]);
});

test("brokenLines prints one item per line in a stable order", () => {
  const r = check({
    "part/CLAUDE.md": OPENING + "- **One.**\n  *File:* `one.py`\n- **Two.**\n  *File:* `two.py`\n- no bold sentence\n",
    "part/one.py": '"""Two."""\n', "part/two.py": '"""One."""\n',
  });
  assert.deepEqual(brokenLines({ ...r, broken: [...r.broken].reverse() }), brokenLines(r));
  assert.deepEqual(brokenLines(r), [
    'part/CLAUDE.md: a rule with no bold sentence cannot be tied (part/CLAUDE.md: "- no bold sentence")',
    `part/one.py: ${HEADING_WRONG} (part/CLAUDE.md: "One.")`,
    `part/two.py: ${HEADING_WRONG} (part/CLAUDE.md: "Two.")`,
  ]);
});
