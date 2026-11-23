"""Python's adapter, the helper side: what the tools read from Python files, read by Python's own parser.

It runs under the repo's own interpreter, always isolated (python -I), and uses the standard library only. Its one
argument names a command; it reads that command's JSON input on stdin and writes its JSON answer on stdout:
    facts         [{"path": ..., "text": ...}, ...]          ->  {path: the file's facts}
    mutations     {"path": ..., "text": ..., "lines": [...]}  ->  [each single mutation inside those lines]
    assertions    {"text": ...}                               ->  {test name: its checks, in line order}
    reads_source  {"text": ..., "test": ...}                  ->  whether that test's own body reads a file
    junit         {"xml": ..., "root": ...}                   ->  the outcome of the report's first test
"""
import ast
import difflib
import hashlib
import io
import itertools
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import PurePosixPath

# A line that writes a file: the write search of the LodeSTAR test's state builders, with every open() mode that writes.
WRITES = re.compile(r"\b(?:torch\.save|np\.save\w*|write_text|write_bytes|os\.replace|savefig|to_csv|json\.dump|_save)\b"
                    r"|\bopen\([^)]*['\"][rbt]*[wax+][bt+]*['\"]")
SUBPROCESS = ("subprocess.", "os.system", "os.popen", "os.exec", "os.spawn")
NOT_PARSED = {"parses": False, "heading": None, "pieces": None, "references": [], "writes": {}, "names": {},
              "definesTest": False, "emptyPackage": False}
FLIP = {ast.Gt: (">", ">="), ast.GtE: (">=", ">"), ast.Lt: ("<", "<="), ast.LtE: ("<=", "<"),
        ast.Eq: ("==", "!="), ast.NotEq: ("!=", "=="), ast.Is: ("is", "is not"), ast.IsNot: ("is not", "is"),
        ast.In: ("in", "not in"), ast.NotIn: ("not in", "in")}
SIMPLE = (ast.Expr, ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Return, ast.Raise, ast.Assert)
CHECKS = re.compile(r"assert|raises$|warns$")      # the last part of the name of a call that checks
# A test body that reads a file: the search of the LodeSTAR test's mutation audit.
READS = re.compile(r"\bopen\(|read_text\(|read_bytes\(|getsource|__file__|\.py['\"]")
FRAME = re.compile(r'^  File "(.+)", line (\d+)', re.M)


def heading(tree):
    """The first text line of the module docstring."""
    docstring = ast.get_docstring(tree)
    return next((line.strip() for line in docstring.split("\n") if line.strip()), None) if docstring else None


def first_line(node):
    """A definition starts at its first decorator."""
    return node.decorator_list[0].lineno if node.decorator_list else node.lineno


def branches(node, owner):
    """Each branch inside a piece, in the order the branches start: both arms of an if, a loop's body, each except
    arm, each case of a match, and both arms of a conditional expression."""
    found = []
    for sub in ast.walk(node):
        if isinstance(sub, ast.If):
            found.append(("if (body)", sub.lineno, sub.body[-1].end_lineno))
            if sub.orelse:
                found.append(("if (else)", sub.orelse[0].lineno, sub.orelse[-1].end_lineno))
        elif isinstance(sub, (ast.For, ast.AsyncFor, ast.While)):
            loop = "while" if isinstance(sub, ast.While) else "for"
            found.append((f"{loop} (body)", sub.body[0].lineno, sub.body[-1].end_lineno))
        elif isinstance(sub, ast.Try):
            found += [("except", handler.lineno, handler.end_lineno) for handler in sub.handlers]
        elif isinstance(sub, ast.Match):
            found += [("case", case.pattern.lineno, case.body[-1].end_lineno) for case in sub.cases]
        elif isinstance(sub, ast.IfExp):
            found += [("conditional (true)", sub.body.lineno, sub.body.end_lineno),
                      ("conditional (false)", sub.orelse.lineno, sub.orelse.end_lineno)]
    return [piece("branch", f"{owner}: {label}", start, end) for label, start, end in sorted(found, key=lambda b: b[1])]


def piece(kind, name, start, end):
    return {"kind": kind, "name": name, "start": start, "end": end}


def cut(tree, source):
    """The file's pieces, numbered P1, P2, ...: the heading, each import, function, class and method, each other
    top-level statement, and each branch inside them."""
    found = []
    for i, node in enumerate(tree.body):
        if i == 0 and ast.get_docstring(tree, clean=False) is not None:
            found.append(piece("heading", "module docstring", node.lineno, node.end_lineno))
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            found.append(piece("import", ast.get_source_segment(source, node), node.lineno, node.end_lineno))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            found.append(piece("function", node.name, first_line(node), node.end_lineno))
            found += branches(node, node.name)
        elif isinstance(node, ast.ClassDef):
            found.append(piece("class", node.name, first_line(node), node.end_lineno))
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    name = f"{node.name}.{item.name}"
                    found.append(piece("method", name, first_line(item), item.end_lineno))
                    found += branches(item, name)
        else:
            first = (ast.get_source_segment(source, node) or "").split("\n")[0][:60]
            found.append(piece("statement", first, node.lineno, node.end_lineno))
            found += branches(node, "top level")
    for n, each in enumerate(found, 1):
        each["id"] = f"P{n}"
    return found


def from_import(path, node):
    """The full dotted names a from-import reads; a relative one is read from the file's own folder."""
    package = PurePosixPath(path).parent.parts
    base = list(package[:len(package) + 1 - node.level]) if node.level else []
    module = base + (node.module.split(".") if node.module else [])
    return [".".join(module + ([] if alias.name == "*" else [alias.name])) for alias in node.names]


def call_name(func):
    """A call's dotted name, such as subprocess.run, or "" when it is not called by a plain name."""
    parts = []
    while isinstance(func, ast.Attribute):
        parts.insert(0, func.attr)
        func = func.value
    return ".".join([func.id] + parts) if isinstance(func, ast.Name) else ""


def strings(nodes):
    """Every string constant inside these nodes."""
    return [sub.value for node in nodes for sub in ast.walk(node) if isinstance(sub, ast.Constant) and isinstance(sub.value, str)]


def call_references(call):
    """What one call names: a module it imports or runs, a file it execs or starts, or a folder it puts on the path."""
    name = call_name(call.func)
    arguments = call.args + [keyword.value for keyword in call.keywords]
    if name in ("importlib.import_module", "import_module", "__import__"):
        return [("dynamic import", text) for text in strings(call.args[:1])]
    if name == "runpy.run_module":
        return [("module runner", text) for text in strings(call.args[:1])]
    if name in ("exec", "runpy.run_path"):
        return [("exec", text) for text in strings(arguments)]
    if name.startswith("sys.path."):
        return [("import path", text) for text in strings(arguments)]
    if name.startswith(SUBPROCESS):
        words = [word for text in strings(arguments) for word in text.split()]
        return [("module runner" if i > 0 and words[i - 1] == "-m" else "subprocess", word)
                for i, word in enumerate(words) if word != "-m"]
    return []


def references(path, tree):
    """Everything the file imports, or names in a dynamic import, a module runner, an exec, a subprocess call or the
    import path, in the order of its lines."""
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found += [(node.lineno, "import", alias.name) for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            found += [(node.lineno, "import", name) for name in from_import(path, node)]
        elif isinstance(node, ast.Call):
            found += [(node.lineno, kind, target) for kind, target in call_references(node)]
    return [{"kind": kind, "target": target, "line": line} for line, kind, target in sorted(found, key=lambda r: r[0])]


def mentions(tree):
    """(line, name) for each name a line uses, and each name an import on it binds."""
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            found.append((node.lineno, node.id))
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            found += [(node.lineno, (alias.asname or alias.name).split(".")[0]) for alias in node.names if alias.name != "*"]
    return found


def tests(tree):
    """(name, function) for each top-level function, and each method of a top-level class, named test...; a
    method is named with its class, as pytest names it (TestB::test_b)."""
    for node in tree.body:
        owner, functions = (f"{node.name}::", node.body) if isinstance(node, ast.ClassDef) else ("", [node])
        for f in functions:
            if isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef)) and f.name.startswith("test"):
                yield owner + f.name, f


def defines_a_test(tree):
    return next(tests(tree), None) is not None


def passes_names_on(node):
    """An import, or __all__ set to a list of names."""
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        return True
    return (isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name)
            and node.targets[0].id == "__all__" and isinstance(node.value, (ast.List, ast.Tuple))
            and all(isinstance(e, ast.Constant) and isinstance(e.value, str) for e in node.value.elts))


def empty_package(path, tree):
    """An __init__.py that holds nothing but comments, a docstring and the names it passes on."""
    if PurePosixPath(path).name != "__init__.py":
        return False
    body = tree.body[1:] if ast.get_docstring(tree, clean=False) is not None else tree.body
    return all(passes_names_on(node) for node in body)


def facts(path, text):
    try:
        tree = ast.parse(text)
    except (SyntaxError, ValueError):            # ValueError: a null byte, on older interpreters
        return NOT_PARSED
    pieces = cut(tree, text)
    lines = re.split(r"\r\n|\r|\n", text)       # numbered as Python's parser numbers them
    named = mentions(tree)
    return {
        "parses": True,
        "heading": heading(tree),
        "pieces": pieces,
        "references": references(path, tree),
        "writes": {p["id"]: [line for line in lines[p["start"] - 1:p["end"]] if WRITES.search(line)] for p in pieces},
        "names": {p["id"]: sorted({name for line, name in named if p["start"] <= line <= p["end"]}) for p in pieces},
        "definesTest": defines_a_test(tree),
        "emptyPackage": empty_package(path, tree),
    }


def source_lines(text):
    """The lines of a source, each with its line end, split where Python's parser splits them."""
    return io.StringIO(text, newline="").readlines()


def scopes(tree):
    """The module's own names, and, for each function, its lines and the names its arguments and assignments bind."""
    module = set()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
            module.add(node.name)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            module.update((a.asname or a.name).split(".")[0] for a in node.names)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                elements = target.elts if isinstance(target, ast.Tuple) else [target]
                module.update(e.id for e in elements if isinstance(e, ast.Name))
    functions = []
    for f in ast.walk(tree):
        if isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            names = {a.arg for a in f.args.args + f.args.kwonlyargs}
            names.update(sub.id for sub in ast.walk(f) if isinstance(sub, ast.Name) and isinstance(sub.ctx, ast.Store))
            functions.append((f.lineno, f.end_lineno, names))
    return module, functions


def other_names(name, module, functions):
    """The other names in scope where this name is used, if the name itself is one of the module's or a function's."""
    in_scope = module.union(*(names for start, end, names in functions if start <= name.lineno <= end))
    return sorted(in_scope - {name.id}) if name.id in in_scope else []


def never_mutated(tree):
    """What no mutation changes: each docstring (its statement and its string), and the text parts of f-strings."""
    found = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) \
                and ast.get_docstring(node, clean=False) is not None:
            found |= {id(node.body[0]), id(node.body[0].value)}
        elif isinstance(node, ast.JoinedStr):
            found |= {id(part) for part in node.values}
    return found


def compiles(source, path):
    try:
        compile(source, path, "exec", dont_inherit=True)
        return True
    except (SyntaxError, ValueError):
        return False


def unified_diff(path, before, after):
    """The diff of one change, with no lines of context, every line ending in a newline."""
    diff = difflib.unified_diff(source_lines(before), source_lines(after), f"a/{path}", f"b/{path}", n=0)
    return "".join(line if line.endswith("\n") else line + "\n" for line in diff)


def mutations(request):
    """Every single mutation from the five fixed operators whose node lies wholly inside the given lines, and that
    compiles: flip a comparison; move a number by one (a bool is flipped); delete a simple statement (it becomes
    pass); swap a name for another name in scope; swap a string for another string of the same file."""
    path, text, lines = request["path"], request["text"], set(request["lines"])
    tree = ast.parse(text)
    split = source_lines(text)
    starts = [0, *itertools.accumulate(map(len, split))]
    module, functions = scopes(tree)
    fixed = never_mutated(tree)

    def at(line, column):                      # a parser position (a line from 1, a UTF-8 byte column) in the text
        return starts[line - 1] + len(split[line - 1].encode()[:column].decode(errors="ignore"))

    def span(node):
        return at(node.lineno, node.col_offset), at(node.end_lineno, node.end_col_offset)

    def is_string(node):
        return isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in fixed

    literals = {}                              # each string's value -> its first text in the file
    for node in ast.walk(tree):
        if is_string(node):
            literals.setdefault(node.value, text[slice(*span(node))])

    found = []

    def add(op, node, start, end, new, element, what):
        source = text[:start] + new + text[end:]
        if compiles(source, path):
            diff = unified_diff(path, text, source)
            found.append({"op": op, "line": node.lineno, "what": what, "element": element, "source": source,
                          "diff": diff, "diffHash": hashlib.sha256(diff.encode()).hexdigest()})

    for node in ast.walk(tree):
        if getattr(node, "lineno", None) is None or id(node) in fixed \
                or not lines.issuperset(range(node.lineno, node.end_lineno + 1)):
            continue
        start, end = span(node)
        old = text[start:end]
        if isinstance(node, ast.Compare):
            for i, op in enumerate(node.ops):            # each operator is written between its two operands
                before, after = FLIP[type(op)]
                gap = span(node.left if i == 0 else node.comparators[i - 1])[1], span(node.comparators[i])[0]
                written = re.search(r"\s*" + re.escape(before).replace(r"\ ", r"\s+") + r"\s*", text[slice(*gap)])
                add("flip comparison", node, gap[0] + written.start(), gap[0] + written.end(), f" {after} ",
                    before, f"{before} -> {after}")
        elif isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            new = repr(not node.value) if isinstance(node.value, bool) else repr(node.value + 1)
            add("move literal", node, start, end, new, old, f"{old} -> {new}")
        elif is_string(node):
            for value, other in literals.items():
                if value != node.value:
                    add("swap string", node, start, end, other, old, f"{old} -> {other}")
        elif isinstance(node, SIMPLE):
            add("delete statement", node, start, end, "pass", old, old.split("\n")[0])
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            for other in other_names(node, module, functions):
                add("swap name", node, start, end, other, node.id, f"{node.id} -> {other}")
    return found


def assertions(request):
    """Each test's checks: its assert statements, and its calls that check (pytest.raises, pytest.warns and any
    assert... helper), in line order."""
    text = request["text"]

    def checks(test):
        found = [node for node in ast.walk(test) if isinstance(node, ast.Assert)
                 or isinstance(node, ast.Call) and CHECKS.match(call_name(node.func).split(".")[-1])]
        return [ast.get_source_segment(text, node) for node in sorted(found, key=lambda n: (n.lineno, n.col_offset))]

    return {name: checks(test) for name, test in tests(ast.parse(text))}


def reads_source(request):
    """Whether the test's own body opens or reads a file, uses getsource or __file__, or names a .py file."""
    text = request["text"]
    test = dict(tests(ast.parse(text)))[request["test"].split("[")[0]]
    return bool(READS.search(ast.get_source_segment(text, test)))


def raised(traceback, root):
    """The exception a native traceback ends with, named as it prints it (a builtin bare, IndexError; any other with
    its module, pkg.g.MyError), and its innermost frame's file (from the root) and line; "" and 0 for no frame."""
    frames = list(FRAME.finditer(traceback))
    if not frames:
        return "", "", 0
    innermost = frames[-1]
    after = traceback[innermost.end():].split("\n")[1:]
    exception = next((line for line in after if line and not line[0].isspace()), "")
    file = os.path.relpath(os.path.realpath(innermost[1]), os.path.realpath(root))
    return exception.split(":")[0], file, int(innermost[2])


def junit(request):
    """The outcome of the tests in a pytest junit report: the first failure, error or skip, else pass, or none when no
    test ran; with the message, the exception and the innermost frame of what went wrong."""
    cases = list(ET.fromstring(request["xml"]).iter("testcase"))
    bad = next((child for case in cases for child in case if child.tag in ("failure", "error", "skipped")), None)
    result = "none" if not cases else "pass" if bad is None else bad.tag
    exception, file, line = raised("" if bad is None else bad.text or "", request["root"])
    return {"result": result, "message": "" if bad is None else bad.get("message", ""), "exception": exception,
            "file": file, "line": line}


COMMANDS = {
    "facts": lambda files: {file["path"]: facts(file["path"], file["text"]) for file in files},
    "mutations": mutations,
    "assertions": assertions,
    "reads_source": reads_source,
    "junit": junit,
}

if __name__ == "__main__":
    answer = COMMANDS[sys.argv[1]](json.loads(sys.stdin.buffer.read().decode("utf-8")))
    sys.stdout.buffer.write(json.dumps(answer).encode("utf-8"))
