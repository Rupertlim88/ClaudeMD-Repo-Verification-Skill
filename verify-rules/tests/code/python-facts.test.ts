import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { blankLineBlocks, languageFor } from "../../code/language.ts";
import { pythonLanguage } from "../../code/python.ts";
import { tmpDir } from "../helpers/tmp.ts";

const PYTHON = process.env.VR_TEST_PYTHON ?? "python3";
const py = pythonLanguage(PYTHON);
const facts = (text: string, file = "m.py") => py.facts([{ path: file, text }]).get(file)!;
const spans = (text: string) => facts(text).pieces!.map((p) => [p.id, p.kind, p.name, p.start, p.end]);

test("the heading is the first text line of the module docstring, after a shebang and an encoding line", () =>
  assert.equal(facts('#!/usr/bin/env python\n# -*- coding: utf-8 -*-\n"""How LodeSTAR\'s outline is made.\n\nMore.\n"""\n').heading,
    "How LodeSTAR's outline is made."));

test("a docstring whose first line is empty gives its first text line", () => {
  assert.equal(facts('"""\nThe heading.\n"""\n').heading, "The heading.");
  assert.equal(facts('"""\n        \n   The heading.\n"""\n').heading, "The heading.");
});

test("the heading keeps every character", () =>
  assert.equal(facts('"""Size is 64 × 64 px, 4 %: it’s fixed —"""\n').heading, "Size is 64 × 64 px, 4 %: it’s fixed —"));

test("no docstring gives no heading; a file that does not parse has parses false and pieces null", () => {
  assert.equal(facts("x = 1\n").heading, null);
  assert.deepEqual(facts("def (:\n"), {
    parses: false, heading: null, pieces: null, references: [], writes: {}, names: {}, definesTest: false, emptyPackage: false,
  });
});

test("pieces: heading, imports, functions, classes, methods, top-level statements and branches, with line spans", () =>
  assert.deepEqual(spans('"""Doc."""\nimport os\nX = 1\n\n\ndef f(a):\n    if a:\n        return 1\n    return 2\n\n\n' +
    "class C:\n    def m(self):\n        return 3\n"), [
    ["P1", "heading", "module docstring", 1, 1], ["P2", "import", "import os", 2, 2], ["P3", "statement", "X = 1", 3, 3],
    ["P4", "function", "f", 6, 9], ["P5", "branch", "f: if (body)", 7, 8], ["P6", "class", "C", 12, 14],
    ["P7", "method", "C.m", 13, 14],
  ]));

test("a definition starts at its first decorator; each branch kind is a piece, in the order the branches start", () =>
  assert.deepEqual(spans([
    "@dec", "class D:", "    pass", "", "",
    "def g(xs):", "    for x in xs:", "        try:", "            y = 1 if x else 2", "        except ValueError:", "            pass",
    "    while xs:", "        xs.pop()", "    if xs:", "        pass", "    else:", "        pass",
    "    match xs:", "        case []:", "            return 0", "",
    'if __name__ == "__main__":', "    g([])", "",
  ].join("\n")), [
    ["P1", "class", "D", 1, 3], ["P2", "function", "g", 6, 20],
    ["P3", "branch", "g: for (body)", 8, 11], ["P4", "branch", "g: conditional (true)", 9, 9],
    ["P5", "branch", "g: conditional (false)", 9, 9], ["P6", "branch", "g: except", 10, 11],
    ["P7", "branch", "g: while (body)", 13, 13], ["P8", "branch", "g: if (body)", 14, 15], ["P9", "branch", "g: if (else)", 17, 17],
    ["P10", "branch", "g: case", 19, 20],
    ["P11", "statement", 'if __name__ == "__main__":', 22, 23], ["P12", "branch", "top level: if (body)", 22, 23],
  ]));

test("references: import, relative from-import read from the file's folder, importlib.import_module, __import__, '-m x' in a subprocess call, exec, sys.path", () =>
  assert.deepEqual(facts([
    "import os", "from .b import f", 'importlib.import_module("tests.helper")', '__import__("x.y")',
    'subprocess.run([sys.executable, "-m", "tools.run"])', 'exec(open("tests/helper.py").read())', 'sys.path.insert(0, "tests")', "",
  ].join("\n"), "pkg/sub/a.py").references.map((r) => [r.kind, r.target]), [
    ["import", "os"], ["import", "pkg.sub.b.f"], ["dynamic import", "tests.helper"], ["dynamic import", "x.y"],
    ["module runner", "tools.run"], ["exec", "tests/helper.py"], ["read", "tests/helper.py"], ["import path", "tests"],
  ]));

test("references: shell commands, runpy, an imported import_module, a star import and a joined import path, with their lines; a dynamic import or module runner names only its first argument", () =>
  assert.deepEqual(facts([
    'os.system("python -m tools.x")', 'subprocess.check_call(["bash", "run.sh"])', 'runpy.run_module("tools.y")',
    'runpy.run_path("scripts/z.py")', "from importlib import import_module", 'import_module("a.b")', "from . import *",
    'sys.path.append(os.path.join(os.path.dirname(__file__), "lib"))', 'runpy.run_module("tools.w", run_name="__main__")',
    '__import__("x.y", fromlist=["z"])', "",
  ].join("\n"), "pkg/a.py").references, [
    { kind: "subprocess", target: "python", line: 1 }, { kind: "module runner", target: "tools.x", line: 1 },
    { kind: "subprocess", target: "bash", line: 2 }, { kind: "subprocess", target: "run.sh", line: 2 },
    { kind: "module runner", target: "tools.y", line: 3 }, { kind: "exec", target: "scripts/z.py", line: 4 },
    { kind: "import", target: "importlib.import_module", line: 5 }, { kind: "dynamic import", target: "a.b", line: 6 },
    { kind: "import", target: "pkg", line: 7 }, { kind: "import path", target: "lib", line: 8 },
    { kind: "module runner", target: "tools.w", line: 9 }, { kind: "dynamic import", target: "x.y", line: 10 },
  ]));

test("references: a file opened, or named by a Path, is read", () =>
  assert.deepEqual(facts([
    'open("part/README.md").read()', 'io.open(os.path.join(HERE, "notes.txt"))', 'Path("data/a.csv").read_text()',
    'pathlib.Path("b.json")', 'print("not a file")', "",
  ].join("\n")).references.map((r) => [r.kind, r.target, r.line]), [
    ["read", "part/README.md", 1], ["read", "notes.txt", 2], ["read", "data/a.csv", 3], ["read", "b.json", 4],
  ]));

test("writes lists each piece's lines that write a file", () =>
  assert.deepEqual(facts([
    '"""Saves the model."""', "import os", "", "",
    "def save(state, path):", '    temporary = path + ".partial"', "    torch.save(state, temporary)", "    os.replace(temporary, path)", "", "",
    "def log(path, text):", '    with open(path, "wb") as f:', "        f.write(text)", "    with open(path) as f:", "        return f.read()", "",
  ].join("\n")).writes, {
    P1: [], P2: [], P3: ["    torch.save(state, temporary)", "    os.replace(temporary, path)"], P4: ['    with open(path, "wb") as f:'],
  }));

test("names lists, per piece, the names an import binds or its lines use", () =>
  assert.deepEqual(facts("import numpy as np\nfrom os import path as p, sep\n\n\ndef save(x):\n    return np.save(p.join(x, sep))\n").names,
    { P1: ["np"], P2: ["p", "sep"], P3: ["np", "p", "sep", "x"] }));

test("definesTest and emptyPackage follow the content rules", () => {
  assert.equal(facts("class TestB:\n    def test_b(self):\n        pass\n", "test_m.py").definesTest, true);
  assert.equal(facts("async def test_c():\n    pass\n", "test_m.py").definesTest, true);
  assert.equal(facts("def helper():\n    pass\n", "test_m.py").definesTest, false);
  assert.equal(facts('"""Doc."""\nfrom .a import b\nimport os\n__all__ = ["b"]\n', "p/__init__.py").emptyPackage, true);
  assert.equal(facts("", "p/__init__.py").emptyPackage, true);
  assert.equal(facts('"""Doc."""\ndef f():\n    return 1\n"""Doc."""\n', "p/__init__.py").emptyPackage, false);
  assert.equal(facts('"""Doc."""\n__all__ = names()\n', "p/__init__.py").emptyPackage, false);
  assert.equal(facts('"""Doc."""\nsteps = ["train", "test"]\n', "p/__init__.py").emptyPackage, false);
  assert.equal(facts('"""Doc."""\n', "p/other.py").emptyPackage, false);
});

test("one helper call analyses many files", () => {
  const dir = tmpDir("python-wrapper");
  const calls = path.join(dir, "calls");
  const wrapper = path.join(dir, "python");
  fs.writeFileSync(wrapper, `#!/bin/sh\necho call >> "${calls}"\nexec ${PYTHON} "$@"\n`, { mode: 0o755 });
  const files = Array.from({ length: 100 }, (_, i) => ({ path: `m${i}.py`, text: `"""Module ${i}."""\n` }));
  const all = pythonLanguage(wrapper).facts(files);
  assert.equal(all.size, 100);
  assert.equal(all.get("m42.py")!.heading, "Module 42.");
  assert.equal(fs.readFileSync(calls, "utf8"), "call\n");
});

test("the helper runs isolated: a json.py planted in the working folder and on PYTHONPATH is not imported", () => {
  const planted = tmpDir("planted");
  fs.writeFileSync(path.join(planted, "json.py"), 'raise SystemExit("the planted json.py was imported")\n');
  const before = { cwd: process.cwd(), pythonPath: process.env.PYTHONPATH };
  process.chdir(planted);
  process.env.PYTHONPATH = planted;
  try {
    assert.equal(facts('"""A."""\n').heading, "A.");
  } finally {
    process.chdir(before.cwd);
    if (before.pythonPath === undefined) delete process.env.PYTHONPATH;
    else process.env.PYTHONPATH = before.pythonPath;
  }
});

test("an interpreter that cannot run is an error, never empty facts", () =>
  assert.throws(() => pythonLanguage(path.join(tmpDir("none"), "python")).facts([{ path: "a.py", text: "" }]), /ENOENT/));

test("languageFor picks Python for .py and nothing for .json", () => {
  assert.equal(languageFor("pkg/a.py", [py]), py);
  assert.equal(languageFor("data/table.json", [py]), null);
  assert.equal(languageFor("Makefile", [py]), null);
});

test("blankLineBlocks cuts a file into the blocks between blank lines", () =>
  assert.deepEqual(blankLineBlocks("a = 1\nb = 2\n\n\n  c(\n"), [
    { id: "P1", kind: "block", name: "a = 1", start: 1, end: 2 }, { id: "P2", kind: "block", name: "c(", start: 5, end: 5 },
  ]));
