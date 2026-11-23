// Python's adapter, the TypeScript side: it runs python_ast.py under the repo's own interpreter, once per batch of
// files, isolated, in an empty temporary folder, and reads its JSON answer; and it collects and runs the repo's tests
// with pytest, as the repo runs them.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FileFacts, Language, Mutation, RunTestOptions, TestOutcome } from "./language.ts";

const HELPER = fileURLToPath(new URL("./python_ast.py", import.meta.url));
const ASSERTIONS = new Set(["AssertionError", "Failed"]);       // an assert, and pytest's own fail (pytest.raises, pytest.fail)

interface Report { result: "pass" | "skipped" | "failure" | "error" | "none"; message: string; exception: string; file: string; line: number }
interface PytestRun { status: number | null; timedOut: boolean; output: string; junit: string | null; seconds: number }

function runHelper(interpreter: string, command: string, input: unknown): unknown {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "verify-rules-python-"));
  try {
    const run = spawnSync(interpreter, ["-I", HELPER, command],
      { cwd, input: JSON.stringify(input), encoding: "utf8", maxBuffer: 1 << 30 });
    if (run.error !== undefined) throw run.error;
    if (run.status !== 0) throw new Error(`python_ast.py ${command} failed with exit ${run.status}: ${run.stderr}`);
    return JSON.parse(run.stdout);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

// Runs pytest in the repo as the repo runs its tests (not isolated), with no bytecode and no cache written into it.
// Its output goes to a file, not a pipe, so that a process the tests leave running cannot hold the run open; past the
// timeout, pytest is killed.
function pytest(interpreter: string, root: string, args: string[], timeoutMs?: number): Promise<PytestRun> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-rules-pytest-"));
  const [outputFile, junitFile] = [path.join(dir, "output"), path.join(dir, "junit.xml")];
  const output = fs.openSync(outputFile, "w");
  const started = performance.now();
  const child = spawn(interpreter, ["-m", "pytest", ...args, "-p", "no:cacheprovider", `--junitxml=${junitFile}`],
    { cwd: root, stdio: ["ignore", output, output], env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  fs.closeSync(output);
  let timedOut = false;
  const timer = timeoutMs === undefined ? undefined : setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, timeoutMs);
  return new Promise<PytestRun>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status) => resolve({
      status, timedOut, output: fs.readFileSync(outputFile, "utf8"),
      junit: fs.existsSync(junitFile) ? fs.readFileSync(junitFile, "utf8") : null, seconds: (performance.now() - started) / 1000,
    }));
  }).finally(() => {
    clearTimeout(timer);
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

// A test counts against a mutation only when it fails on an assertion, or on an exception whose innermost frame lies
// inside the mutated lines; anything else that is not a pass is an error.
function outcome(report: Report, run: PytestRun, opts: RunTestOptions): TestOutcome {
  const { seconds } = run;
  if (report.result === "pass") return { kind: "pass", seconds };
  if (report.result === "failure" && ASSERTIONS.has(report.exception)) return { kind: "assertion", message: report.message, seconds };
  if (report.result === "failure" && report.file === opts.mutatedFile && opts.mutatedLines?.has(report.line))
    return { kind: "exception-in-lines", exception: report.exception, file: report.file, line: report.line, seconds };
  if (report.result === "none") return { kind: "error", detail: `no test ran: ${run.output.slice(-400)}`, seconds };
  return { kind: "error", detail: `${report.result}: ${report.message}`, seconds };
}

export function pythonLanguage(interpreter: string): Language {
  return {
    name: "Python",
    extensions: [".py"],
    facts: (files) => new Map(Object.entries(runHelper(interpreter, "facts", files) as Record<string, FileFacts>)),
    mutations: (file, text, lines) => runHelper(interpreter, "mutations", { path: file, text, lines: [...lines] }) as Mutation[],
    assertions: (_file, text) => new Map(Object.entries(runHelper(interpreter, "assertions", { text }) as Record<string, string[]>)),
    testReadsSource: (_file, text, testName) => runHelper(interpreter, "reads_source", { text, test: testName }) as boolean,

    async collectTests(root, paths) {
      const run = await pytest(interpreter, root, ["--collect-only", "-q", ...paths]);
      if (run.status !== 0 && run.status !== 5) throw new Error(`pytest could not collect the tests (exit ${run.status}):\n${run.output}`);
      const ids = run.output.split("\n");
      return new Map(paths.map((file) => [file, ids.filter((id) => id.startsWith(`${file}::`))]));
    },

    async runTest(root, testId, opts) {
      const run = await pytest(interpreter, root, [testId, "-q", "-x", "--tb=native"], opts.timeoutMs);
      if (run.timedOut) return { kind: "error", detail: `timeout after ${opts.timeoutMs / 1000} s`, seconds: run.seconds };
      const none: Report = { result: "none", message: "", exception: "", file: "", line: 0 };
      return outcome(run.junit === null ? none : runHelper(interpreter, "junit", { xml: run.junit, root }) as Report, run, opts);
    },
  };
}
