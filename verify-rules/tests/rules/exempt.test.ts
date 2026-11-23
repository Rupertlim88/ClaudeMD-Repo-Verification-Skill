import assert from "node:assert/strict";
import { test } from "node:test";
import { pythonLanguage } from "../../code/python.ts";
import { DEFAULT_EXEMPT, exemptPerGroup, gitRepoView, matchesPattern, tieCheck, type TieReport } from "../../rules/tie-check.ts";
import { GLOBAL, memoryRepo, OPENING } from "../helpers/repo-view.ts";
import { makeRepo } from "../helpers/tmp.ts";

const py = pythonLanguage(process.env.VR_TEST_PYTHON ?? "python3");
const check = (files: Record<string, string>, extra: Parameters<typeof memoryRepo>[1] = {}, config = DEFAULT_EXEMPT) =>
  tieCheck(memoryRepo({ "CLAUDE.md": GLOBAL, "part/CLAUDE.md": OPENING, ...files }, extra), config, [py]);
const placed = (r: TieReport) => r.exempt.map((e) => [e.file, e.group]);
const fileProblems = (r: TieReport) => r.broken.map((b) => [b.file, b.problem]);
const TEST = "def test_it():\n    pass\n";

test("a group's pattern places a file only when its content rule holds", () => {
  const r = check({
    "part/__init__.py": "", "part/k/__init__.py": "x = compute()\n", "part/tests/test_a.py": TEST, "part/tests/test_b.py": TEST,
  }, { collected: ["part/tests/test_a.py"] });
  assert.deepEqual(placed(r).filter(([f]) => f.startsWith("part/") && f !== "part/CLAUDE.md"),
    [["part/__init__.py", "empty package file"], ["part/tests/test_a.py", "tests"]]);
  assert.deepEqual(r.refusedExempt.map((x) => [x.file, x.group]), [["part/k/__init__.py", "empty package file"], ["part/tests/test_b.py", "tests"]]);
  assert.deepEqual(r.counted, ["part/k/__init__.py", "part/tests/test_b.py"]);
});

// A real repo, collected by pytest: what it collects, what it loads as settings, and what it leaves out.
const real = makeRepo({
  "CLAUDE.md": GLOBAL, "part/CLAUDE.md": OPENING, "part/tool.py": "x = 1\n", "part/test_fake.py": "def helper():\n    pass\n",
  "part/tests/test_real.py": TEST, "part/tests/conftest.py": "import os\n", "other/CLAUDE.md": OPENING, "other/conftest.py": "import os\n",
});
const realReport = gitRepoView(real, [py]).then((view) => tieCheck(view, DEFAULT_EXEMPT, [py]));

test("a file no pattern places is counted; a test_ file from which pytest collects nothing is counted", async () => {
  const r = await realReport;
  assert.deepEqual(r.counted, ["other/conftest.py", "part/test_fake.py", "part/tool.py"]);
  assert.ok(placed(r).some(([f, g]) => f === "part/tests/test_real.py" && g === "tests"));
});

test("conftest.py that pytest loads as configuration is in the tests group (LodeSTAR problem 13)", async () => {
  const view = await gitRepoView(real, [py]);
  assert.deepEqual([[...view.collected], [...view.runnerConfig]], [["part/tests/test_real.py"], ["part/tests/conftest.py"]]);
  assert.ok(placed(await realReport).some(([f, g]) => f === "part/tests/conftest.py" && g === "tests"));
});

test("a test helper that product code imports is broken", () => {
  const r = check({
    "part/tests/helper.py": "def peaks():\n    pass\n", "part/tests/test_x.py": "from part.tests.helper import peaks\n" + TEST,
    "part/dots.py": "from part.tests.helper import peaks\n",
  }, { collected: ["part/tests/test_x.py"] });
  assert.deepEqual(fileProblems(r), [["part/dots.py", "imports part.tests.helper.peaks from a tests folder"]]);
  assert.ok(r.counted.includes("part/tests/helper.py"));
  const helperOnly = check({
    "part/tests/helper.py": "from part.tests.deeper import x\n", "part/tests/deeper.py": "x = 1\n",
    "part/tests/test_x.py": "from part.tests.helper import x\n" + TEST,
  }, { collected: ["part/tests/test_x.py"] });
  assert.deepEqual(placed(helperOnly).filter(([f]) => f.startsWith("part/tests/")),
    [["part/tests/deeper.py", "tests"], ["part/tests/helper.py", "tests"], ["part/tests/test_x.py", "tests"]]);
});

test("a docs folder holding a code file is broken; a README below a folder's top is counted; a top README that a counted file reads is broken", () => {
  const r = check({
    "docs/guide.md": "# Guide\n", "docs/build.py": "x = 1\n", "README.md": "# The repo\n", "part/README.md": "# The part\n",
    "part/notes/README.md": "# Notes\n", "part/show.py": 'print(open("part/README.md").read())\n',
  });
  assert.deepEqual(placed(r).filter(([f]) => f.endsWith(".md") && !f.endsWith("CLAUDE.md")),
    [["README.md", "docs"], ["docs/guide.md", "docs"], ["part/README.md", "docs"]]);
  assert.ok(r.counted.includes("part/notes/README.md"));
  assert.deepEqual(fileProblems(r).sort(), [
    ["docs/build.py", "is a code file inside a docs folder"], ["docs/build.py", "its nearest CLAUDE.md is not lowest-level"],
    ["part/show.py", "reads part/README.md, which is exempt as docs"],
  ]);
});

test("patterns match whole path parts: contests/ and latests/ are not tests", () => {
  assert.equal(matchesPattern("contests/a.py", "tests/**"), false);
  assert.equal(matchesPattern("part/latests/a.py", "**/tests/**"), false);
  assert.equal(matchesPattern("part/tests/deep/a.py", "**/tests/**"), true);
  assert.equal(matchesPattern("tests/a.py", "tests/**"), true);
  assert.equal(matchesPattern("part/test_a.py", "**/test_*.py"), true);
  assert.equal(matchesPattern("part/README_md", "**/README.md"), false);
});

test("CLAUDE.md files and .gitignore are placed in their groups; .claude/ copies are exempt, a skill listed as this repo's own is counted", () => {
  const r = check({
    ".gitignore": "outputs/\n", ".claude/skills/verify-rules/SKILL.md": "# Skill\n", ".claude/skills/own/run.py": "x = 1\n",
  }, {}, { ...DEFAULT_EXEMPT, ownSkills: ["own"] });
  assert.deepEqual(placed(r), [
    [".claude/skills/verify-rules/SKILL.md", "copied into .claude"], [".gitignore", "tool settings"],
    ["CLAUDE.md", "CLAUDE.md files"], ["part/CLAUDE.md", "CLAUDE.md files"],
  ]);
  assert.ok(r.counted.includes(".claude/skills/own/run.py"));
});

test("an exempt file that a counted file imports, names in a dynamic import, runs with -m, execs, calls by subprocess or adds to sys.path is broken", () => {
  const r = check({
    "part/tests/test_h.py": TEST,
    "part/a.py": "import part.tests.test_h\n", "part/b.py": 'importlib.import_module("part.tests.test_h")\n',
    "part/c.py": 'subprocess.run([sys.executable, "-m", "part.tests.test_h"])\n', "part/d.py": 'exec(open("part/tests/test_h.py").read())\n',
    "part/e.py": 'subprocess.run(["bash", "part/tests/test_h.py"])\n', "part/f.py": 'sys.path.insert(0, "part/tests")\n',
    "part/g.py": 'subprocess.run(["bash", "tests/test_h.py"])\n', "part/__init__.py": "",
    "part/k/__init__.py": "from part.tests.test_h import test_it\n",
  }, { collected: ["part/tests/test_h.py"] });
  assert.deepEqual(fileProblems(r), [
    ["part/a.py", "imports part/tests/test_h.py, which is exempt as tests"],
    ["part/b.py", "imports part/tests/test_h.py, which is exempt as tests"],
    ["part/c.py", "runs part/tests/test_h.py, which is exempt as tests"],
    ["part/d.py", "execs part/tests/test_h.py, which is exempt as tests"],
    ["part/e.py", "calls part/tests/test_h.py, which is exempt as tests"],
    ["part/f.py", "puts on the import path part/tests/test_h.py, which is exempt as tests"],
    ["part/g.py", "calls part/tests/test_h.py, which is exempt as tests"],
    ["part/k/__init__.py", "imports part/tests/test_h.py, which is exempt as tests"],
  ]);
});

test("tool settings that code reads as settings are the one exception", () =>
  assert.deepEqual(fileProblems(check({
    "pytest.ini": "[pytest]\n", "requirements.txt": "numpy==2.0\n",
    "part/run.py": 'subprocess.run(["pytest", "-c", "pytest.ini"])\nopen("requirements.txt")\n',
    "part/bad.py": 'exec(open("pytest.ini").read())\n',
  })), [["part/bad.py", "execs pytest.ini, which is exempt as tool settings"]]));

test("a git-ignored file on disk that a counted file imports is broken", () =>
  assert.deepEqual(fileProblems(check({ "part/dots.py": "from part.secret import key\n" }, { ignored: ["part/secret.py"] })),
    [["part/dots.py", "imports part/secret.py, which git ignores"]]));

test("the loophole hunt's eight hiding places each end counted or broken", () => {
  const code = "def peaks(image):\n    return image > 0.5\n";
  const places: Record<string, [string, Record<string, string>, Parameters<typeof memoryRepo>[1]]> = {
    "test_ prefix": ["part/test_peaks.py", { "part/test_peaks.py": code }, {}],
    "conftest.py outside tests": ["part/conftest.py", { "part/conftest.py": code, "part/main.py": "from part.conftest import peaks\n",
      "part/tests/test_a.py": TEST }, { collected: ["part/tests/test_a.py"], runnerConfig: ["part/conftest.py"] }],
    "under docs/": ["docs/peaks.py", { "docs/peaks.py": code }, {}],
    "under contests/": ["part/contests/peaks.py", { "part/contests/peaks.py": code }, {}],
    "in a data folder": ["part/results/peaks.py", { "part/CLAUDE.md": OPENING + "- **Kept.**\n  *File:* `results/`\n",
      "part/results/RULE.md": "# Kept.\n", "part/results/peaks.py": code }, {}],
    "in an empty-package file": ["part/k/__init__.py", { "part/k/__init__.py": '"""Overview."""\n' + code }, {}],
    "saved as README.md": ["part/README.md", { "part/README.md": code, "part/main.py": 'exec(open("part/README.md").read())\n' }, {}],
    "git-ignored": ["part/secret.py", { "part/main.py": "from part.secret import peaks\n" }, { ignored: ["part/secret.py"] }],
  };
  for (const [place, [hidden, files, extra]] of Object.entries(places)) {
    const r = check(files, extra);
    assert.ok(r.counted.includes(hidden) || r.broken.some((b) => b.file === hidden || b.problem.includes(hidden)), place);
  }
});

test("the report counts exempt files per group", () =>
  assert.deepEqual(exemptPerGroup(check({ "part/tests/test_a.py": TEST, "docs/a.md": "# A\n", ".gitignore": "", "part/__init__.py": "" },
    { collected: ["part/tests/test_a.py"] })), {
    "tests": 1, "docs": 1, "tool settings": 1, "CLAUDE.md files": 2, "copied into .claude": 0, "empty package file": 1,
  }));

test("gitRepoView starts no test runner for a language the repo has no files of", async () => {
  const view = await gitRepoView(makeRepo({ "CLAUDE.md": GLOBAL, "notes.md": "# Notes\n" }), [pythonLanguage("/nowhere/python")]);
  assert.deepEqual([view.files, view.collected.size], [["CLAUDE.md", "notes.md"], 0]);
});
