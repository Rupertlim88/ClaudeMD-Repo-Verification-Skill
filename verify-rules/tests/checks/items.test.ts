import assert from "node:assert/strict";
import { test } from "node:test";
import { stateOf, stepState, tieItems, type TieItem } from "../../checks/items.ts";
import { pythonLanguage } from "../../code/python.ts";
import { tieCheck } from "../../rules/tie-check.ts";
import { GLOBAL, memoryRepo, OPENING, THESIS } from "../helpers/repo-view.ts";

const py = pythonLanguage(process.env.VR_TEST_PYTHON ?? "python3");

const FILES = {
  "CLAUDE.md": GLOBAL + "\n## Global rules\n\n2. **Code is clean.** Every line is clear.\n",
  "part/CLAUDE.md": OPENING + "- **Dots are found.** It finds dots. It never counts a dot twice.\n  *File:* `dots.py`\n" +
    "- **Outlines are drawn.** It draws outlines.\n  *File:* `outline.py`\n- **Results are kept.** They stay.\n  *File:* `results/`\n",
  "part/dots.py": '"""Dots are found."""\n\nLIMIT = 3\n\n\ndef dots(xs):\n    return xs[:LIMIT]\n',
  "part/outline.py": '"""Outlines are drawn."""\n\n\ndef outline(x):\n    return x\n',
  "part/results/RULE.md": "# Results are kept.\n",
  "part/results/scores.csv": "name,score\na,1\n",
  "other/CLAUDE.md": OPENING + "- **Other.** It is other.\n  *File:* `other.py`\n",
  "other/other.py": '"""Other."""\n',
};

function build(scope = "") {
  const view = memoryRepo(FILES);
  const report = tieCheck(view, THESIS, [py]);
  return { view, report, ...tieItems(view, report, [py], scope) };
}
const built = build();
const ids = (items: TieItem[]) => items.map((i) => i.id);
const item = (id: string) => built.items.find((i) => i.id === id)!;

test("every tie gets part 1, part 2 per clause and per rule, part 3, and part 4 per piece and other rule of its CLAUDE.md", () => {
  const dots = ids(built.items.filter((i) => i.file === "part/dots.py"));
  assert.deepEqual(dots, ["tie.p1:part/dots.py", "tie.p2:part/dots.py#c1", "tie.p2:part/dots.py#c2", "tie.p2:part/dots.py#c3",
    "tie.p2-list:part/dots.py", "tie.p3:part/dots.py",
    "tie.p4:part/dots.py@P2~part/outline.py", "tie.p4:part/dots.py@P2~part/results/",
    "tie.p4:part/dots.py@P3~part/outline.py", "tie.p4:part/dots.py@P3~part/results/"]);
});

test("each item's question is its template's, filled with the file, the clause and the rule", () => {
  assert.equal(item("tie.p2:part/dots.py#c3").question, "Does `part/dots.py` carry out this clause of its rule: 'It never counts a dot twice.'?");
  assert.equal(item("tie.p3:part/dots.py").question,
    "Does everything in `part/dots.py` serve its rule 'Dots are found.', with no part doing something its rule does not ask for?");
  assert.equal(item("tie.p4:part/dots.py@P3~part/outline.py").question, "Is this piece of code free of the job of the rule 'Outlines are drawn.'?");
});

test("a scope keeps only the ties inside its folder", () => {
  assert.ok(ids(build("other").items).every((id) => id.includes("other/other.py")));
  assert.ok(ids(built.items).some((id) => id.includes("other/other.py")));
});

test("a clause's state holds the rule's whole text, the clause and the numbered file, and nothing else", () => {
  const s = stateOf(item("tie.p2:part/dots.py#c3"), built.view, built.report);
  assert.match(s, /It finds dots\. It never counts a dot twice\./);
  assert.match(s, /CLAUSE c3:\nIt never counts a dot twice\./);
  assert.match(s, / {3}7 {2}\s+return xs\[:LIMIT\]/);
  assert.doesNotMatch(s, /test|Code is clean/);
});

test("a clause list's state holds each clause with its span, and the script's floor check", () => {
  const s = stateOf(item("tie.p2-list:part/dots.py"), built.view, built.report);
  assert.match(s, /c3 \[\d+-\d+\] "It never counts a dot twice\."/);
  assert.match(s, /passes its floor: 3 clauses, floor 3/);
});

test("a file's part 3 state holds the general rules over its folder", () => {
  const s = stateOf(item("tie.p3:part/dots.py"), built.view, built.report);
  assert.match(s, /Every line is clear\./);
  assert.doesNotMatch(s, /It is other\./);
});

test("a piece's state holds its lines and the other rule's whole text", () => {
  const s = stateOf(item("tie.p4:part/dots.py@P3~part/outline.py"), built.view, built.report);
  assert.match(s, /def dots\(xs\):/);
  assert.doesNotMatch(s, /LIMIT = 3/);
  assert.match(s, /It draws outlines\./);
});

test("part 1's state is the tie check's own output for the rule and its file", () => {
  assert.match(stateOf(item("tie.p1:part/dots.py"), built.view, built.report), /tied both ways: yes/);
  const broken = memoryRepo({ ...FILES, "part/dots.py": '"""Dots are found!"""\n' });
  const report = tieCheck(broken, THESIS, [py]);
  const p1 = tieItems(broken, report, [py], "").items.find((i) => i.id === "tie.p1:part/dots.py")!;
  const s = stateOf(p1, broken, report);
  assert.match(s, /tied both ways: no/);
  assert.match(s, /part\/dots\.py: its heading does not state the bold sentence/);
});

test("a folder of data is checked by its note and its listing, and has no part 4", () => {
  const s = stateOf(item("tie.p2:part/results/#c1"), built.view, built.report);
  assert.match(s, /RULE\.md \(\d+ bytes\)\n# Results are kept\./);
  assert.match(s, /scores\.csv \(\d+ bytes\)\nname,score/);
  assert.ok(!ids(built.items).some((id) => id.startsWith("tie.p4:part/results/")));
});

test("a step check's state holds the step's own instructions, the rule, the file and the captured evidence", () => {
  const skill = "## The steps\n\n### Step 12. Ties are written\n- Goal: ties.\n\n### Step 13. Results\n- Goal: results.\n";
  const about = { view: built.view, bold: "Dots are found.", file: "part/dots.py" };
  const s = stepState(skill, "12", about, [{ name: "evidence/ties-1.txt", text: "0 broken" }]);
  assert.match(s, /### Step 12\. Ties are written\n- Goal: ties\./);
  assert.doesNotMatch(s, /Step 13/);
  assert.match(s, /It never counts a dot twice\./);
  assert.match(s, /--- evidence\/ties-1\.txt ---\n0 broken/);
  assert.throws(() => stepState(skill, "99", null, []), /no step 99/);
});
