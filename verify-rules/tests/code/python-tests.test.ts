import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { Mutation, TestOutcome } from "../../code/language.ts";
import { pythonLanguage } from "../../code/python.ts";
import { TOY, toyRepo } from "../helpers/toy-python.ts";

const PYTHON = process.env.VR_TEST_PYTHON ?? "python3";
const py = pythonLanguage(PYTHON);
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const listed = (found: Mutation[]) => found.map((m) => [m.op, m.line, m.element, m.what]).sort();
const whats = (text: string, lines: number[]) => py.mutations("m.py", text, new Set(lines)).map((m) => m.what).sort();

const SRC = "def f(a, b):\n    if a > 0.5:\n        return b\n    return 'x' + 'y'\n";
const ms = py.mutations("f.py", SRC, new Set([2, 3, 4]));

test("mutations come only from the five operators, inside the given lines, one change each", () => {
  assert.deepEqual(new Set(ms.map((m) => m.op)),
    new Set(["flip comparison", "move literal", "delete statement", "swap name", "swap string"]));
  assert.ok(ms.every((m) => [2, 3, 4].includes(m.line)));
  for (const m of ms) {
    const [before, after] = [SRC.split("\n"), m.source.split("\n")];
    assert.equal(after.length, before.length);
    assert.equal(before.filter((line, i) => line !== after[i]).length, 1, m.what);
  }
  assert.equal(ms.find((m) => m.op === "flip comparison")!.source.split("\n")[1], "    if a >= 0.5:");
  assert.deepEqual(whats("x = f(1,\n      2)\n", [1]), ["1 -> 2"]);
  assert.deepEqual(whats("x = f(1,\n      2)\n", [1, 2]), ["1 -> 2", "2 -> 3", "x = f(1,"]);
});

test("each operator of a chained comparison is flipped where it is written; a bool is flipped", () => {
  const flips = py.mutations("m.py", "x = a < b < c\n", new Set([1])).filter((m) => m.op === "flip comparison");
  assert.deepEqual(flips.map((m) => m.source), ["x = a <= b < c\n", "x = a < b <= c\n"]);
  assert.deepEqual(whats("X = True\n", [1]), ["True -> False", "X = True"]);
});

test("a name is swapped only for the names its scope binds: the module's, and its own function's", () => {
  const text = [
    "import os", "from a import b as c", "K, L = 1, 2", "", "", "class C:", "    pass", "", "",
    "def f(x, *, y):", "    z = x", "    return z", "", "", "M = K", "",
  ].join("\n");
  assert.deepEqual(whats(text, [12]), ["return z", "z -> C", "z -> K", "z -> L", "z -> M", "z -> c", "z -> f", "z -> os", "z -> x", "z -> y"]);
  assert.deepEqual(whats(text, [15]), ["K -> C", "K -> L", "K -> M", "K -> c", "K -> f", "K -> os", "M = K"]);
});

test("every mutation names the element it changes; a name is swapped only for another name in scope", () =>
  assert.deepEqual(listed(ms), [
    ["flip comparison", 2, ">", "> -> >="],
    ["swap name", 2, "a", "a -> b"], ["swap name", 2, "a", "a -> f"],
    ["move literal", 2, "0.5", "0.5 -> 1.5"],
    ["delete statement", 3, "return b", "return b"],
    ["swap name", 3, "b", "b -> a"], ["swap name", 3, "b", "b -> f"],
    ["delete statement", 4, "return 'x' + 'y'", "return 'x' + 'y'"],
    ["swap string", 4, "'x'", "'x' -> 'y'"], ["swap string", 4, "'y'", "'y' -> 'x'"],
  ].sort()));

test("a mutation that does not compile is never returned", () => {
  const text = "def f(a):\n    print(a)\n    global b\n    b = 1\n";
  const found = py.mutations("m.py", text, new Set([2]));
  assert.deepEqual(found.map((m) => m.what).sort(), ["a -> f", "print(a)"]);       // "a -> b" uses b before its global line
  const compiles = (source: string) =>
    execFileSync(PYTHON, ["-I", "-c", "import sys; compile(sys.stdin.read(), 'm.py', 'exec')"], { input: source });
  for (const m of found) compiles(m.source);
});

test("diffHash is the SHA-256 of the unified diff, which names the file and holds one line per change", () => {
  for (const m of ms) assert.equal(m.diffHash, sha256(m.diff));
  assert.equal(ms.find((m) => m.op === "flip comparison")!.diff,
    "--- a/f.py\n+++ b/f.py\n@@ -2 +2 @@\n-    if a > 0.5:\n+    if a >= 0.5:\n");
  assert.equal(py.mutations("m.py", "x = 1", new Set([1])).find((m) => m.op === "move literal")!.diff,
    "--- a/m.py\n+++ b/m.py\n@@ -1 +1 @@\n-x = 1\n+x = 2\n");
});

test("docstrings and the text of f-strings are never mutated, nor used as another string", () =>
  assert.deepEqual(whats('"""Doc."""\ndef f():\n    """Inner."""\n    return f"a{1}b" + "c"\nX = "d"\n', [1, 2, 3, 4, 5]), [
    "\"c\" -> \"d\"", "\"d\" -> \"c\"", "1 -> 2", "X = \"d\"", "return f\"a{1}b\" + \"c\"",
  ]));

test("a mutation stays in place when a string holds a line separator, or a character wider than one byte comes before it", () => {
  const flip = (text: string, line: number) => py.mutations("m.py", text, new Set([line])).find((m) => m.op === "flip comparison")!.source;
  assert.equal(flip('S = "\u2028"\nT = S > 1\n', 2), 'S = "\u2028"\nT = S >= 1\n');
  assert.equal(flip('T = ("é×", a > 1)\n', 1), 'T = ("é×", a >= 1)\n');
});

const ID = "tests/test_f.py::test_ok";
const O = { timeoutMs: 60_000 };
const f = (body: string) => `"""The toy's function."""\n\ndef f(xs):\n    ${body}\n`;
const withF = (body: string) => toyRepo({ "pkg/f.py": f(body) });
const pick = (o: TestOutcome) => (o.kind === "exception-in-lines" ? { kind: o.kind, exception: o.exception, file: o.file, line: o.line } : o.kind);

test("runTest: pass, assertion, exception inside the mutated lines, and error for an import error or an exception elsewhere", async () => {
  const passed = await py.runTest(toyRepo(), ID, O);
  assert.equal(passed.kind, "pass");
  assert.ok(passed.seconds > 0);
  const assertion = await py.runTest(withF("return xs[0] + 2"), ID, O);
  assert.equal(assertion.kind, "assertion");
  assert.match((assertion as { message: string }).message, /assert 3 == 2/);
  const indexError = withF("return xs[1] + 1");
  const inLines = { ...O, mutatedFile: "pkg/f.py", mutatedLines: new Set([4]) };
  assert.deepEqual(pick(await py.runTest(indexError, ID, inLines)),
    { kind: "exception-in-lines", exception: "IndexError", file: "pkg/f.py", line: 4 });
  assert.equal(pick(await py.runTest(indexError, ID, { ...inLines, mutatedLines: new Set([3]) })), "error");
  assert.equal(pick(await py.runTest(indexError, ID, { ...inLines, mutatedFile: "pkg/g.py" })), "error");
  assert.equal(pick(await py.runTest(indexError, ID, O)), "error");
  const importError = toyRepo({ "pkg/f.py": "import missing_module\n" + TOY["pkg/f.py"] });
  assert.equal(pick(await py.runTest(importError, ID, { ...O, mutatedFile: "pkg/f.py", mutatedLines: new Set([1]) })), "error");
  const raisesOnImport = toyRepo({ "pkg/f.py": TOY["pkg/f.py"] + "X = [][0]\n" });
  assert.equal(pick(await py.runTest(raisesOnImport, ID, { ...O, mutatedFile: "pkg/f.py", mutatedLines: new Set([5]) })), "error");
  const missing = await py.runTest(toyRepo(), "tests/test_f.py::test_missing", O);
  assert.equal(missing.kind, "error");
  assert.match((missing as { detail: string }).detail, /no test ran/);
  const unreadable = await py.runTest(toyRepo({ "pytest.ini": "[pytest]\naddopts = --no-such-option\n" }), ID, O);
  assert.equal(unreadable.kind, "error");
  assert.match((unreadable as { detail: string }).detail, /no test ran: [^]*--no-such-option/);
});

test("runTest: a failing pytest.raises is an assertion, an assert in a fixture is an error, a skipped test is never a pass, and an id naming several tests fails if one does", async () => {
  const root = toyRepo({
    "tests/test_f.py": "import pytest\nfrom pkg.f import f\n\n\ndef test_raises():\n    with pytest.raises(IndexError):\n" +
      '        f([1])\n\n\n@pytest.mark.skip(reason="later")\ndef test_skipped():\n    pass\n\n\n' +
      "@pytest.fixture\ndef broken():\n    assert False\n\n\ndef test_set_up(broken):\n    pass\n\n\n" +
      '@pytest.mark.parametrize("n", [1, 2])\ndef test_cases(n):\n    assert f([n]) == 2\n',
  });
  assert.equal((await py.runTest(root, "tests/test_f.py::test_raises", O)).kind, "assertion");
  assert.equal((await py.runTest(root, "tests/test_f.py::test_set_up", O)).kind, "error");
  assert.equal((await py.runTest(root, "tests/test_f.py::test_cases", O)).kind, "assertion");
  const skipped = await py.runTest(root, "tests/test_f.py::test_skipped", O);
  assert.equal(skipped.kind, "error");
  assert.match((skipped as { detail: string }).detail, /skipped/);
});

test("runTest stops a test that runs past its timeout", { timeout: 30_000 }, async () => {
  const outcome = await py.runTest(withF("while True:\n        pass"), ID, { timeoutMs: 2_000 });
  assert.equal(outcome.kind, "error");
  assert.match((outcome as { detail: string }).detail, /timeout/);
  assert.ok(outcome.seconds < 10);
});

test("runTest returns when the test ends, even if the test leaves a process running with output capture off", { timeout: 30_000 }, async () => {
  const root = toyRepo({
    "pytest.ini": "[pytest]\naddopts = -s\n",
    "tests/test_f.py": 'import subprocess\n\n\ndef test_ok():\n    subprocess.Popen(["sleep", "20"])\n',
  });
  const outcome = await py.runTest(root, ID, O);
  assert.equal(outcome.kind, "pass");
  assert.ok(outcome.seconds < 10);
});

test("collectTests lists collected test ids, and none from a test_ file with no test", async () => {
  const root = toyRepo({
    "tests/test_f.py": "import pytest\n" + TOY["tests/test_f.py"] + "\n\nclass TestB:\n    def test_b(self):\n        pass\n\n\n" +
      '@pytest.mark.parametrize("n", [1, 2])\ndef test_p(n):\n    pass\n',
    "tests/test_none.py": 'import warnings\nwarnings.warn("loud")\n\n\ndef helper():\n    pass\n',
    "tests/conftest.py": "import os\n",
  });
  assert.deepEqual(await py.collectTests(root, ["tests/test_f.py", "tests/test_none.py", "tests/conftest.py"]), new Map([
    ["tests/test_f.py", ["tests/test_f.py::test_ok", "tests/test_f.py::TestB::test_b", "tests/test_f.py::test_p[1]", "tests/test_f.py::test_p[2]"]],
    ["tests/test_none.py", []],
    ["tests/conftest.py", []],
  ]));
  assert.deepEqual(await py.collectTests(root, ["tests/test_none.py"]), new Map([["tests/test_none.py", []]]));
});

test("collectTests with no paths lists every file that pytest's own discovery collects tests from", async () => {
  const root = toyRepo({ "tests/test_g.py": "def test_g():\n    pass\n", "tests/helper.py": "def test_not_collected():\n    pass\n" });
  assert.deepEqual(await py.collectTests(root, []), new Map([["tests/test_f.py", [ID]], ["tests/test_g.py", ["tests/test_g.py::test_g"]]]));
});

test("collectTests is an error, never an empty list, when the test runner cannot collect a file", async () =>
  assert.rejects(py.collectTests(toyRepo({ "tests/test_bad.py": "import missing_module\n" }), ["tests/test_f.py", "tests/test_bad.py"]),
    /missing_module/));

test("runTest and collectTests write nothing into the repo they run in", async () => {
  const root = toyRepo();
  await py.collectTests(root, ["tests/test_f.py"]);
  await py.runTest(root, ID, O);
  const files = fs.readdirSync(root, { recursive: true, encoding: "utf8" }).filter((p) => fs.statSync(path.join(root, p)).isFile());
  assert.deepEqual(files.sort(), Object.keys(TOY).sort());
});

const READER = [
  "import inspect", "from pathlib import Path", "from pkg import f", "", "",
  "def read_it():", '    return open("pkg/f.py").read()', "", "",
  "def test_opens():", '    assert "x" in open("pkg/f.py").read()', "", "",
  "def test_reads():", '    assert Path("pkg/f.py").read_text()', "", "",
  "def test_getsource():", "    assert inspect.getsource(f)", "", "",
  "def test_file():", "    assert __file__", "", "",
  "def test_names_source():", '    assert Path("pkg") / "f.py"', "", "",
  "def test_calls():", "    assert f.f([1]) == 2 and read_it()", "", "",
  "class TestC:", "    def test_m(self):", '        assert open("x")', "",
].join("\n");

test("testReadsSource is true when the test's own body opens or reads a file, or uses getsource or __file__", () => {
  const names = ["test_opens", "test_reads", "test_getsource", "test_file", "test_names_source", "test_calls", "TestC::test_m",
    "test_calls[1]", "test_opens[a-b]"];
  assert.deepEqual(names.map((name) => py.testReadsSource("tests/test_r.py", READER, name)),
    [true, true, true, true, true, false, true, false, true]);
  assert.throws(() => py.testReadsSource("tests/test_r.py", READER, "test_missing"), /test_missing/);
});

test("assertions lists each test's assert statements by test name", () =>
  assert.deepEqual([...py.assertions("t.py", "def helper():\n    assert True\n\n\ndef test_a():\n    x = 1\n    assert f(1) == 2\n")],
    [["test_a", ["assert f(1) == 2"]]]));

test("assertions also lists the calls that check, pytest.raises, pytest.warns and assert helpers, in line order", () =>
  assert.deepEqual([...py.assertions("t.py", [
    "class TestB:", "    def test_b(self):", "        with pytest.raises(ValueError):", "            f(-1)",
    "        np.testing.assert_allclose(f(1), 2)", "        self.assertEqual(f(1), 2)", "        if f(2):",
    "            assert f(2) == 3", "        with pytest.warns(UserWarning):", "            g()", "",
  ].join("\n"))], [["TestB::test_b", [
    "pytest.raises(ValueError)", "np.testing.assert_allclose(f(1), 2)", "self.assertEqual(f(1), 2)", "assert f(2) == 3",
    "pytest.warns(UserWarning)",
  ]]]));
