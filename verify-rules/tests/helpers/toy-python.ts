// A toy Python repo for the adapter's test runs: pkg/f.py, its test in tests/test_f.py, and pytest.ini. Files given
// replace or add to the toy's own.
import fs from "node:fs";
import path from "node:path";
import { tmpDir } from "./tmp.ts";

export const TOY: Record<string, string> = {
  "pytest.ini": "[pytest]\n",
  "pkg/f.py": '"""The toy\'s function."""\n\ndef f(xs):\n    return xs[0] + 1\n',
  "tests/test_f.py": "from pkg.f import f\n\n\ndef test_ok():\n    assert f([1]) == 2\n",
};

export function toyRepo(files: Record<string, string> = {}): string {
  const root = tmpDir("toy-python");
  for (const [name, text] of Object.entries({ ...TOY, ...files })) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}
