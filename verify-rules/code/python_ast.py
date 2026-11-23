"""Python's adapter, the helper side: what the tools read from Python files, read by Python's own parser.

It runs under the repo's own interpreter, always isolated (python -I), and uses the standard library only. Its one
argument names a command; it reads that command's JSON input on stdin and writes its JSON answer on stdout:
    facts    [{"path": ..., "text": ...}, ...]  ->  {path: the file's facts}
"""
import ast
import json
import re
import sys
from pathlib import PurePosixPath

# A line that writes a file: the write search of the LodeSTAR test's state builders, with every open() mode that writes.
WRITES = re.compile(r"\b(?:torch\.save|np\.save\w*|write_text|write_bytes|os\.replace|savefig|to_csv|json\.dump|_save)\b"
                    r"|\bopen\([^)]*['\"][rbt]*[wax+][bt+]*['\"]")
SUBPROCESS = ("subprocess.", "os.system", "os.popen", "os.exec", "os.spawn")
NOT_PARSED = {"parses": False, "heading": None, "pieces": None, "references": [], "writes": {}, "names": {},
              "definesTest": False, "emptyPackage": False}


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


def defines_a_test(tree):
    """A top-level function, or a method of a top-level class, named test..."""
    top = tree.body
    functions = top + [node for top_class in top if isinstance(top_class, ast.ClassDef) for node in top_class.body]
    return any(isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef)) and f.name.startswith("test") for f in functions)


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


COMMANDS = {"facts": lambda files: {file["path"]: facts(file["path"], file["text"]) for file in files}}

if __name__ == "__main__":
    answer = COMMANDS[sys.argv[1]](json.loads(sys.stdin.buffer.read().decode("utf-8")))
    sys.stdout.buffer.write(json.dumps(answer).encode("utf-8"))
