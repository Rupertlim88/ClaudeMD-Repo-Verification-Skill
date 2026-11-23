// The 34 tests of senior-thesis-research's tests/test_claude_ties.py, ported with their names and fixtures. Every
// fixture also holds a global CLAUDE.md, because the rule reader finds the copied opening by the global's exact text.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pythonLanguage } from "../../code/python.ts";
import { brokenLines, gitRepoView, tieCheck, type TieReport } from "../../rules/tie-check.ts";
import { GLOBAL, memoryRepo, OPENING, THESIS } from "../helpers/repo-view.ts";
import { git, tmpDir } from "../helpers/tmp.ts";

const py = pythonLanguage(process.env.VR_TEST_PYTHON ?? "python3");

const check = (files: Record<string, string>, ignored: string[] = []) =>
  tieCheck(memoryRepo({ "CLAUDE.md": GLOBAL, ...files }, ignored), THESIS, [py]);
const problems = (r: TieReport) => r.broken.map((b) => b.problem);
const fileProblems = (r: TieReport) => r.broken.map((b) => [b.file, b.problem]);
const bolds = (refs: { bold: string | null }[]) => refs.map((ref) => ref.bold);

test("a rule names its file and the file states the rule", () => {
  const r = check({
    "CLAUDE.md": GLOBAL + "\n2. **Global rule.**\n",
    "part/CLAUDE.md": OPENING + "- **Dots are found by peaks.** Text.\n  *File:* `dots.py`\n",
    "part/dots.py": '"""Dots are found by peaks."""\n',
  });
  assert.deepEqual([r.broken, r.notYetTied], [[], { rules: [], files: [] }]);
  assert.deepEqual(r.ties.map((t) => [t.rule.bold, t.file]), [["Dots are found by peaks.", "part/dots.py"]]);
});

test("a rule naming a missing file is broken", () =>
  assert.deepEqual(problems(check({ "part/CLAUDE.md": OPENING + "- **Dots are found by peaks.**\n  *File:* `dots.py`\n" })),
    ["names a file that does not exist"]));

test("a file whose heading is not its rule is broken", () =>
  assert.deepEqual(problems(check({
    "part/CLAUDE.md": OPENING + "- **Dots are found by peaks.**\n  *File:* `dots.py`\n", "part/dots.py": '"""Something else."""\n',
  })), ["its heading does not state the bold sentence of the rule that names it"]));

test("a file named by two rules is broken", () => {
  const r = check({
    "part/CLAUDE.md": OPENING + "- **One.**\n  *File:* `a.py`\n- **Two.**\n  *File:* `a.py`\n", "part/a.py": '"""One."""\n',
  });
  assert.ok(problems(r).includes("is named by two rules"));
  assert.deepEqual(r.ties, []);
});

test("a folder of data needs a note stating its rule", () => {
  const rule = OPENING + "- **The results are kept.**\n  *File:* `results/`\n";
  assert.deepEqual(problems(check({ "part/CLAUDE.md": rule, "part/results/a.json": "{}" })),
    ["is a folder of data with no note naming its rule"]);
  const good = check({ "part/CLAUDE.md": rule, "part/results/a.json": "{}", "part/results/RULE.md": "# The results are kept.\n" });
  assert.deepEqual([good.broken, good.notYetTied.files], [[], []]);
  for (const note of ["## The results\n\n# The results are kept.\n", "# The results are kept. \r\n"])
    assert.deepEqual(check({ "part/CLAUDE.md": rule, "part/results/RULE.md": note }).broken, [], note);
});

test("a rule can tie its own folder as data", () => {
  const files: Record<string, string> = {
    "poster/CLAUDE.md": OPENING + "- **The poster is kept.**\n  *File:* `./`\n", "poster/a.png": "", "poster/RULE.md": "# The poster is kept.\n",
  };
  assert.deepEqual([check(files).broken, check(files).notYetTied.files], [[], []]);
  delete files["poster/RULE.md"];
  assert.deepEqual(problems(check(files)), ["is a folder of data with no note naming its rule"]);
});

test("a folder of data holding code is broken", () => {
  const rule = OPENING + "- **The results are kept.**\n  *File:* `results/`\n";
  assert.deepEqual(fileProblems(check({
    "part/CLAUDE.md": rule, "part/results/RULE.md": "# The results are kept.\n", "part/results/a.json": "{}",
    "part/results/deep/make.sh": "rm -rf /\n", "part/results/run": "#!/bin/sh\nrm -rf /\n", "part/run.py": "x = 1\n",
  })), [["part/results/deep/make.sh", "is code inside a folder of data"], ["part/results/run", "is code inside a folder of data"]]);
  assert.deepEqual(fileProblems(check({
    "poster/CLAUDE.md": OPENING + "- **The poster is kept.**\n  *File:* `./`\n", "poster/RULE.md": "# The poster is kept.\n",
    "poster/make.py": "x = 1\n",
  })), [["poster/make.py", "is code inside a folder of data"]]);
});

test("the report names the rule only when a rule is involved", () =>
  assert.deepEqual(brokenLines(check({
    "part/CLAUDE.md": OPENING + "- **Dots.**\n  *File:* `dots.py`\n", "part/dots.py": '"""Dots"""\nimport part.tests.a\n',
  })), [
    "part/dots.py: imports part.tests.a from a tests folder",
    'part/dots.py: its heading does not state the bold sentence of the rule that names it (part/CLAUDE.md: "Dots.")',
  ]));

test("untied rules and files are listed, not broken", () => {
  const r = check({
    "part/CLAUDE.md": OPENING + "- **Needs a file.**\n  *File:* needed\n- **Covers the folder.**\n  *File:* the whole folder\n" +
      "- **Not marked.**\n",
    "part/extra.py": '"""Extra."""\n',
  });
  assert.deepEqual(r.broken, []);
  assert.deepEqual(bolds(r.notYetTied.rules), ["Needs a file.", "Not marked."]);
  assert.ok(r.general.some((g) => g.rule.bold === "Covers the folder." && g.mark === "whole-folder"));
  assert.deepEqual(r.notYetTied.files, ["part/extra.py"]);
});

test("a rule with no bold sentence is broken", () => {
  const text = OPENING + "- **Tied.**\n  - A plain line inside the rule.\n  *File:* `a.py`\n- A plain rule.\n" +
    "3. Another plain rule.\n+ A plus rule.\n4) A bracket rule.\n\n## More\n  - An indented plain rule.\n* **Starred.**\n  *File:* `b.py`\n";
  const r = check({ "part/CLAUDE.md": text, "part/a.py": '"""Tied."""\n', "part/b.py": '"""Starred."""\n' });
  const problem = "a rule with no bold sentence cannot be tied";
  assert.deepEqual(r.broken.map((b) => [b.file, b.problem, b.rule]), [
    ["part/CLAUDE.md", problem, "- A plain rule."], ["part/CLAUDE.md", problem, "3. Another plain rule."],
    ["part/CLAUDE.md", problem, "+ A plus rule."], ["part/CLAUDE.md", problem, "4) A bracket rule."],
    ["part/CLAUDE.md", problem, "- An indented plain rule."],
  ]);
  assert.deepEqual(r.notYetTied, { rules: [], files: [] });
});

test("a rule with two file lines is broken", () =>
  assert.ok(check({ "part/CLAUDE.md": OPENING + "- **One.**\n  *File:* `a.py`\n  *File:* `b.py`\n", "part/a.py": '"""One."""\n' })
    .broken.some((b) => b.file === "part/CLAUDE.md" && b.problem === "a rule names two files" && b.rule === "*File:* `b.py`")));

for (const gap of ["\n## Next\n", "\n\n"]) {
  test(`a file line not directly under its rule is broken (${JSON.stringify(gap)})`, () => {
    const r = check({ "part/CLAUDE.md": OPENING + `- **One.**${gap}  *File:* \`a.py\`\n` });
    assert.deepEqual(r.broken.map((b) => [b.file, b.problem, b.rule]),
      [["part/CLAUDE.md", "a file line is not directly under its rule's text", "*File:* `a.py`"]]);
    assert.deepEqual(bolds(r.notYetTied.rules), ["One."]);
  });
}

// The thesis check ended a rule's text at a blank line. Rule reader 2 runs it on to the next rule, heading or file
// line, so the paragraph is the rule's text and the file line right after it is the rule's own.
test('a paragraph between a rule and its file line is the rule\'s text (the thesis\'s gap "\\n\\nA paragraph.\\n")', () => {
  const r = check({ "part/CLAUDE.md": OPENING + "- **One.**\n\nA paragraph.\n  *File:* `a.py`\n" });
  assert.deepEqual(r.broken.map((b) => [b.file, b.problem, b.rule]), [["part/a.py", "names a file that does not exist", "One."]]);
  assert.deepEqual(r.notYetTied.rules, []);
});

test("two rules with the same bold sentence are broken", () => {
  const rule = OPENING + "- **Same.**\n  *File:* needed\n";
  const same = "the bold sentence 'Same.' is also the bold sentence of a rule in a/CLAUDE.md (texts agree)";
  assert.deepEqual(fileProblems(check({ "a/CLAUDE.md": rule, "b/CLAUDE.md": rule, "c/CLAUDE.md": rule + rule.slice(OPENING.length) })),
    [["b/CLAUDE.md", same], ["c/CLAUDE.md", same], ["c/CLAUDE.md", same]]);
});

test("the copied opening rules are not tied", () => {
  const r = check({ "part/CLAUDE.md": OPENING + "- **Own rule.**\n" });
  assert.deepEqual([bolds(r.specific), r.broken], [["Own rule."], []]);
});

test("a later section with a copied heading is read as its own", () => {
  const r = check({
    "part/CLAUDE.md": OPENING + "- **Own rule.**\n\n## Rule 1 again\n- **Second rule.**\n\n" +
      "## The rule never to change a CLAUDE.md\n- **Third rule.**\n",
  });
  assert.deepEqual([bolds(r.specific), r.broken], [["Own rule.", "Second rule.", "Third rule."], []]);
});

test("tests, setup files and empty package files are not counted", () => {
  const r = check({
    "part/CLAUDE.md": OPENING, "part/tests/test_x.py": "", "part/tests/helper.py": "", "part/__init__.py": '"""Overview."""\n',
    "requirements.txt": "", "pytest.ini": "", ".gitignore": "",
  });
  assert.deepEqual(r.notYetTied.files, []);
  assert.deepEqual(r.exempt.map((e) => [e.file, e.group]), [
    [".gitignore", "tool settings"], ["CLAUDE.md", "CLAUDE.md files"], ["part/CLAUDE.md", "CLAUDE.md files"],
    ["part/__init__.py", "empty package file"], ["part/tests/helper.py", "tests"], ["part/tests/test_x.py", "tests"],
    ["pytest.ini", "tool settings"], ["requirements.txt", "tool settings"],
  ]);
});

test("only a folder named exactly tests holds tests", () =>
  assert.deepEqual(check({ "part/CLAUDE.md": OPENING, "part/contests/score.py": '"""Scores."""\n' }).notYetTied.files,
    ["part/contests/score.py"]));

test("a test file outside a tests folder must define a test", () => {
  const r = check({
    "part/CLAUDE.md": OPENING,
    "part/test_function.py": "def test_a():\n    pass\n",
    "part/test_method.py": "class TestB:\n    def test_b(self):\n        pass\n",
    "part/test_async.py": "async def test_c():\n    pass\n",
    "part/test_no_test.py": "def helper():\n    pass\n",
  });
  assert.deepEqual(r.notYetTied.files, ["part/test_no_test.py"]);
  assert.deepEqual(r.refusedExempt, [{ file: "part/test_no_test.py", group: "tests", why: "defines no test, outside a tests folder" }]);
});

test("a conftest is a test helper only inside a tests folder", () =>
  assert.deepEqual(check({ "part/CLAUDE.md": OPENING, "part/tests/conftest.py": "import os\n", "part/conftest.py": "import os\n" })
    .notYetTied.files, ["part/conftest.py"]));

for (const [statement, name] of [
  ["from part.tests.helper import peaks", "part.tests.helper.peaks"],
  ["import tests.claude_ties", "tests.claude_ties"],
  ["from part import tests", "part.tests"],
  ["from .tests.helper import peaks", "part.tests.helper.peaks"],
  ["def peaks():\n    import part.tests.helper", "part.tests.helper"],
]) {
  test(`code that imports from a tests folder is broken (${statement})`, () =>
    assert.deepEqual(fileProblems(check({
      "part/CLAUDE.md": OPENING, "part/dots.py": `"""Dots."""\n${statement}\n`,
      "part/tests/test_dots.py": "from part.tests.helper import peaks\n", "part/score.py": "import contests\n",
    })), [["part/dots.py", `imports ${name} from a tests folder`]]));
}

for (const [statement, module] of [
  ["from outputs.hidden import run", "outputs/hidden.py"],
  ["import part.data.loader", "part/data/__init__.py"],
  ["from .secret import key", "part/secret.py"],
]) {
  test(`code that imports a file git ignores is broken (${statement})`, () =>
    assert.deepEqual(fileProblems(check({
      "part/CLAUDE.md": OPENING, "part/dots.py": `"""Dots."""\n${statement}\n`, "part/tests/test_dots.py": `${statement}\n`,
    }, [module, "outputs/results.json"])), [["part/dots.py", `imports ${module}, which git ignores`]]));
}

test("a package file holding more than a docstring is counted", () =>
  assert.deepEqual(check({
    "part/CLAUDE.md": OPENING, "part/k/__init__.py": '"""Overview."""\nimport os\n\nos.remove("x")\n"""The end."""\n',
    "part/empty/__init__.py": "", "part/not_python/__init__.py": "def (:\n",
  }).notYetTied.files, ["part/k/__init__.py", "part/not_python/__init__.py"]));

test("the docs are not counted", () =>
  assert.deepEqual(check({ "part/CLAUDE.md": OPENING, "docs/workflow.md": "# How we work\n" }).notYetTied.files, []));

// The thesis fixture had no global CLAUDE.md, so these files had no CLAUDE.md and were not yet tied. Here the global
// covers them and is not lowest-level, so they are counted and broken.
test("code in the docs is counted", () => {
  const code = ["docs/a.py", "docs/b.sh", "docs/c.js", "docs/d.ts", "docs/e.ipynb"];
  const r = check({
    "part/CLAUDE.md": OPENING, "docs/workflow.md": "# How we work\n", "docs/__init__.py": "", ...Object.fromEntries(code.map((f) => [f, "x = 1\n"])),
  });
  assert.deepEqual(r.counted, code);
  assert.deepEqual(r.refusedExempt.map((x) => [x.file, x.why]), code.map((f) => [f, "is a code file"]));
  assert.deepEqual(fileProblems(r), code.map((f) => [f, "its nearest CLAUDE.md is not lowest-level"]));
});

test("a higher CLAUDE.md is not read for ties", () =>
  assert.deepEqual(check({ "CLAUDE.md": GLOBAL + "\n2. **Global.**\n  *File:* `nowhere.py`\n", "part/CLAUDE.md": OPENING }).broken, []));

test("git lists names with spaces and accents whole", () => {
  const root = tmpDir("names");
  git(root, "init", "-q");
  fs.mkdirSync(path.join(root, "outputs"));
  for (const [name, text] of Object.entries({ ".gitignore": "outputs/\n", "my code.py": "", "é.py": "", "outputs/hidden é.py": "" }))
    fs.writeFileSync(path.join(root, name), text);
  fs.writeFileSync(path.join(root, "gone.py"), "");
  git(root, "add", "gone.py");
  fs.rmSync(path.join(root, "gone.py"));
  const view = gitRepoView(root);
  assert.deepEqual(view.files, [".gitignore", "my code.py", "é.py"]);
  assert.deepEqual(view.ignoredOnDisk, new Set(["outputs/hidden é.py"]));
});
