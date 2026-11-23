// The two-way tie check: every counted file is tied to exactly one specific rule of the lowest-level CLAUDE.md that
// covers it, and every specific rule to exactly one file. It reads the rules of every CLAUDE.md, each file's heading
// and imports, and the exempt list; it reports what is broken, in both directions, and what is not yet tied.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { languageFor, type FileFacts, type Language, type Reference } from "../code/language.ts";
import { readAll, type Rule, type RuleRef } from "./rule-reader.ts";

export const EXEMPT_GROUPS = ["tests", "docs", "tool settings", "CLAUDE.md files", "copied into .claude", "empty package file"] as const;
export type ExemptGroup = (typeof EXEMPT_GROUPS)[number];
export interface ExemptPattern { pattern: string; group: ExemptGroup; reason: string }
// ownSkills: the skills under .claude/skills/ whose master copy is this repo, which are counted like any other code.
export interface ExemptConfig { patterns: ExemptPattern[]; ownSkills: string[] }
// collected: the files the test runner collects at least one test from; runnerConfig: the files it loads as settings.
export interface RepoView {
  root: string; files: string[]; read(path: string): string; ignoredOnDisk: ReadonlySet<string>;
  collected: ReadonlySet<string>; runnerConfig: ReadonlySet<string>;
}
export interface Broken { file: string; problem: string; claude?: string; rule?: string }
export interface TieReport {
  lowest: string[]; specific: RuleRef[]; general: { rule: RuleRef; mark: "whole-folder" | null }[];
  unnamed: RuleRef[]; counted: string[]; exempt: { file: string; group: ExemptGroup; pattern: string; reason: string }[];
  refusedExempt: { file: string; group: ExemptGroup; why: string }[]; ties: { rule: RuleRef; file: string }[];
  broken: Broken[]; notYetTied: { rules: RuleRef[]; files: string[] }; cannotCarryHeading: string[];
}

const NOTE = "RULE.md";                     // a folder of data's note, whose title is its rule's bold sentence
// A code file is known by its extension or by a first line that names an interpreter. SQL is not on the list:
// database migrations are a folder of data.
const CODE = new Set([".py", ".pyw", ".ipynb", ".sh", ".bash", ".zsh", ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".tsx",
  ".jsx", ".rb", ".pl", ".php", ".go", ".rs", ".java", ".kt", ".c", ".h", ".cc", ".cpp", ".hpp", ".cs", ".swift", ".r", ".jl",
  ".lua", ".ps1", ".bat"]);
const HEADING_WRONG = "its heading does not state the bold sentence of the rule that names it";
const USES: Record<Reference["kind"], string> = {
  "import": "imports", "dynamic import": "imports", "module runner": "runs", "exec": "execs", "subprocess": "calls",
  "read": "reads", "import path": "puts on the import path",
};

// The exempt list by default; a repo writes its own from its layout (tools: Exempt-list 12). The first pattern whose
// group's content rule holds places a file.
export const DEFAULT_EXEMPT: ExemptConfig = {
  patterns: [
    { pattern: "**/CLAUDE.md", group: "CLAUDE.md files", reason: "they hold the rules, which the hierarchy checks check" },
    { pattern: ".claude/**", group: "copied into .claude", reason: "installed or copied from another repo" },
    { pattern: "**/tests/**", group: "tests", reason: "a tests folder" },
    { pattern: "**/test_*.py", group: "tests", reason: "a test file" },
    { pattern: "**/*_test.py", group: "tests", reason: "a test file" },
    { pattern: "**/conftest.py", group: "tests", reason: "the test runner's settings for the tests below it" },
    { pattern: "**/docs/**", group: "docs", reason: "the docs" },
    { pattern: "**/README.md", group: "docs", reason: "a folder's overview" },
    ...[".github/workflows/**", "**/package.json", "**/package-lock.json", "**/requirements.txt", "**/pyproject.toml",
      "**/pytest.ini", "**/setup.cfg", "**/tox.ini", "**/tsconfig.json", "**/.gitignore", "**/.gitattributes"]
      .map((pattern) => ({ pattern, group: "tool settings" as const, reason: "read by a tool, not by the repo's own code" })),
    { pattern: "**/__init__.py", group: "empty package file", reason: "it lets other code use the folder's code" },
  ],
  ownSkills: [],
};

const folderOf = (file: string) => (path.posix.dirname(file) === "." ? "" : path.posix.dirname(file));
const inside = (file: string, folder: string) => (folder === "" ? !file.startsWith("../") : file.startsWith(`${folder}/`));
const isCode = (file: string, text: string) => CODE.has(path.posix.extname(file)) || text.startsWith("#!");
const inDocsFolder = (file: string) => folderOf(file).split("/").includes("docs");
const cannotCarryHeading = (file: string, text: string) => path.posix.extname(file) === ".json" || text.includes("\0");
const ref = (rule: Rule): RuleRef => ({ claude: rule.claude, bold: rule.bold, key: rule.key });
// A folder of data is named with a trailing "/"; its files start with this prefix ("" for the repo root's "./").
const prefixOf = (folder: string) => (folder === "./" ? "" : folder);
// A rule's words without its list marker and indents, so that copies written with "-" or "1." compare as the same.
const words = (text: string) => text.split("\n").map((line) => line.trim()).join("\n").replace(/^(?:[-*+]|\d+[.)])\s+/, "");

// Whether a path matches a pattern part by part: ** stands for any number of whole parts, * for any run of
// characters inside one part.
export function matchesPattern(file: string, pattern: string): boolean {
  const part = (name: string, glob: string) =>
    new RegExp(`^${glob.split("*").map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`).test(name);
  const match = (names: string[], globs: string[]): boolean => {
    if (globs.length === 0) return names.length === 0;
    if (globs[0] === "**") return match(names, globs.slice(1)) || (names.length > 0 && match(names.slice(1), globs));
    return names.length > 0 && part(names[0], globs[0]) && match(names.slice(1), globs.slice(1));
  };
  return match(file.split("/"), pattern.split("/"));
}

// The files Python may run to import a dotted name from the repo root: each module and package on its path.
function moduleFiles(name: string): string[] {
  const parts = name.split(".");
  return parts.flatMap((_, i) => [`${parts.slice(0, i + 1).join("/")}.py`, `${parts.slice(0, i + 1).join("/")}/__init__.py`]);
}

export function tieCheck(repo: RepoView, config: ExemptConfig, languages: readonly Language[]): TieReport {
  const known = new Set(repo.files);
  const claudes = repo.files.filter((file) => path.posix.basename(file) === "CLAUDE.md");
  const lowest = claudes.filter((claude) => !claudes.some((other) => other !== claude && inside(other, folderOf(claude))));
  const nearest = (file: string) =>
    claudes.filter((claude) => inside(file, folderOf(claude))).sort((a, b) => b.length - a.length)[0] ?? null;
  const facts = new Map<string, FileFacts>();
  for (const language of languages) {
    const files = repo.files.filter((file) => languageFor(file, languages) === language);
    for (const [file, fileFacts] of language.facts(files.map((file) => ({ path: file, text: repo.read(file) })))) facts.set(file, fileFacts);
  }
  const heading = (file: string) => {
    if (facts.has(file)) return facts.get(file)!.heading;
    if (path.posix.extname(file) !== ".md") return null;
    return repo.read(file).split("\n").find((line) => line.startsWith("# "))?.slice(2).trim() ?? null;
  };

  const report: TieReport = {
    lowest, specific: [], general: [], unnamed: [], counted: [], exempt: [], refusedExempt: [], ties: [], broken: [],
    notYetTied: { rules: [], files: [] }, cannotCarryHeading: [],
  };
  const broken = (file: string, problem: string, claude?: string, rule?: string) => report.broken.push({ file, problem, claude, rule });
  const read = readAll(new Map(claudes.map((claude) => [claude, repo.read(claude)])));
  const named = new Map<string, Rule[]>();     // each path a rule names (a folder of data ends in "/") -> the rules naming it

  // rule -> file: a specific rule's file line names one file, inside its CLAUDE.md's folder, whose heading states it;
  // or a folder of data whose note states it and which holds no code file.
  function tie(rule: Rule, line: string) {
    const target = path.posix.join(folderOf(rule.claude), line);
    const fail = (file: string, problem: string) => broken(file, problem, rule.claude, rule.bold!);
    if (!inside(target, folderOf(rule.claude))) {
      fail(target, "is outside the folder of the CLAUDE.md that names it");
      return;
    }
    if (named.has(target)) fail(target, "is named by two rules");
    named.set(target, [...named.get(target) ?? [], rule]);
    const isData = target.endsWith("/");
    if (isData) {
      for (const file of repo.files.filter((file) => file.startsWith(prefixOf(target)) && isCode(file, repo.read(file))))
        fail(file, "is code inside a folder of data");
    }
    const own = isData ? prefixOf(target) + NOTE : target;       // the file whose heading states the rule
    if (!known.has(own)) fail(target, isData ? "is a folder of data with no note naming its rule" : "names a file that does not exist");
    else if (heading(own) !== rule.bold) fail(target, isData ? "its note does not state the bold sentence of the rule that names it" : HEADING_WRONG);
    else report.ties.push({ rule: ref(rule), file: target });
  }

  const seen = new Map<string, { claude: string; kind: string; text: string }>();     // each bold sentence's first use
  for (const [claude, result] of read) {
    const isLowest = lowest.includes(claude);
    for (const rule of result.rules) {
      if (rule.bold === null) {
        report.unnamed.push(ref(rule));
        if (isLowest) broken(claude, "a rule with no bold sentence cannot be tied", claude, rule.text.split("\n")[0].trim());
      } else if (!isLowest || rule.fileLine?.kind === "whole-folder") {
        report.general.push({ rule: ref(rule), mark: rule.fileLine?.kind === "whole-folder" ? "whole-folder" : null });
      } else {
        report.specific.push(ref(rule));
        if (rule.fileLine?.kind === "path") tie(rule, rule.fileLine.path);
        else report.notYetTied.rules.push(ref(rule));
      }
    }
    if (isLowest) {
      for (const problem of result.problems) broken(claude, problem.problem, claude, problem.text.trim());
      for (const stray of result.stray) broken(claude, `line ${stray.line} is not a heading, the copied opening, a rule's text or a file line`);
    }
    // Bold sentences are unique in the whole repo, among rules and sub-rules alike.
    const lines = repo.read(claude).split(/\r?\n/);
    const items = result.rules.flatMap((rule) => [{ bold: rule.bold, line: rule.startLine, kind: "rule", text: rule.text },
      ...rule.subrules.map((sub) => ({ bold: sub.bold, line: sub.line, kind: "sub-rule", text: lines[sub.line - 1] }))]);
    for (const item of items) {
      if (item.bold === null) continue;
      const first = seen.get(item.bold);
      if (first === undefined) seen.set(item.bold, { claude, kind: item.kind, text: item.text });
      else broken(claude, `the bold sentence '${item.bold}' is also the bold sentence of a ${first.kind} in ${first.claude} ` +
        `(texts ${words(first.text) === words(item.text) ? "agree" : "differ"})`, claude, item.bold);
    }
  }
  report.ties = report.ties.filter((t) => named.get(t.file)!.length === 1);

  // What each file's references name, and who names each file.
  const namedBy = (file: string, reference: Reference) => [...new Set(["", folderOf(file)].flatMap((base) => {
    if (["import", "dynamic import", "module runner"].includes(reference.kind)) return moduleFiles(reference.target).map((m) => path.posix.join(base, m));
    const named = path.posix.join(base, reference.target);
    return reference.kind === "import path" ? repo.files.filter((f) => inside(f, named)) : [named];
  }))].filter((f) => known.has(f));
  const users = new Map<string, Set<string>>();
  for (const [file, fileFacts] of facts)
    for (const reference of fileFacts.references) for (const target of namedBy(file, reference)) users.set(target, (users.get(target) ?? new Set()).add(file));

  // Test files: what the test runner collects or loads as settings, then each file a tests pattern matches that only
  // test files use, until no more are found.
  const tests = new Set([...repo.collected, ...repo.runnerConfig]);
  const testPatterns = config.patterns.filter((p) => p.group === "tests");
  for (let grew = true; grew;) {
    grew = false;
    for (const file of repo.files.filter((f) => !tests.has(f) && testPatterns.some((p) => matchesPattern(f, p.pattern)))) {
      const by = [...users.get(file) ?? []];
      if (by.length > 0 && by.every((user) => tests.has(user))) grew = Boolean(tests.add(file));
    }
  }
  const claudeFolders = new Set(claudes.map(folderOf));
  // Each group's content rule: why the group refuses a file its pattern matched, or null when the file belongs to it.
  const content: Record<ExemptGroup, (file: string) => string | null> = {
    "tests": (file) => (tests.has(file) ? null : "the test runner collects no test from it nor loads it as settings, and not only tests use it"),
    "docs": (file) => (inDocsFolder(file) ? (isCode(file, repo.read(file)) ? "is a code file" : null)
      : claudeFolders.has(folderOf(file)) ? null : "is an overview below a folder's top"),
    "tool settings": () => null,
    "CLAUDE.md files": () => null,
    "copied into .claude": (file) => (config.ownSkills.some((skill) => inside(file, `.claude/skills/${skill}`)) ? "is this repo's own skill" : null),
    "empty package file": (file) => (facts.get(file)?.emptyPackage ? null : "holds more than comments, a docstring and the names it passes on"),
  };

  // The exempt list: the first pattern whose group's content rule holds places the file; any other file is counted.
  const groupOf = new Map<string, ExemptGroup>();
  for (const file of repo.files) {
    const refused: { file: string; group: ExemptGroup; why: string }[] = [];
    for (const { pattern, group, reason } of config.patterns.filter((p) => matchesPattern(file, p.pattern))) {
      const why = content[group](file);
      if (why === null) {
        report.exempt.push({ file, group, pattern, reason });
        groupOf.set(file, group);
        break;
      }
      if (!refused.some((x) => x.group === group)) refused.push({ file, group, why });
    }
    if (!groupOf.has(file)) report.refusedExempt.push(...refused);
  }
  const exempt = new Set(groupOf.keys());
  for (const file of repo.files.filter((f) => inDocsFolder(f) && isCode(f, repo.read(f)))) broken(file, "is a code file inside a docs folder");

  // The import and call test: no counted file, nor any empty package file passing names on, may import, run, exec,
  // call, read or put on the import path an exempt file; tool settings a tool or the code reads as settings aside, and
  // the empty package files themselves, which exist to be imported. Nor may it import from a tests folder, or a module
  // git ignores, which the check would not see.
  for (const file of repo.files.filter((f) => !exempt.has(f) || groupOf.get(f) === "empty package file")) {
    const reported = new Set<string>();
    for (const reference of facts.get(file)?.references ?? []) {
      const used = namedBy(file, reference).filter((target) => exempt.has(target) && groupOf.get(target) !== "empty package file"
        && !(groupOf.get(target) === "tool settings" && ["subprocess", "read"].includes(reference.kind)));
      for (const target of used.filter((target) => !reported.has(target))) {
        reported.add(target);
        broken(file, `${USES[reference.kind]} ${target}, which is exempt as ${groupOf.get(target)}`);
      }
      if (reference.kind !== "import") continue;
      if (used.length === 0 && reference.target.split(".").includes("tests")) broken(file, `imports ${reference.target} from a tests folder`);
      for (const module of moduleFiles(reference.target).filter((module) => repo.ignoredOnDisk.has(module)))
        broken(file, `imports ${module}, which git ignores`);
    }
  }

  // file -> rule: a counted file no rule names is not yet tied, unless its heading states some rule, or its nearest
  // CLAUDE.md is not lowest-level; a folder of data counts as one file.
  const dataFolders = [...named.keys()].filter((target) => target.endsWith("/"));
  const ruleWith = new Map([...read.values()].flatMap((result) => result.rules).filter((r) => r.bold !== null).map((r) => [r.bold!, r]));
  for (const file of repo.files.filter((file) => !exempt.has(file))) {
    if (dataFolders.some((folder) => file.startsWith(prefixOf(folder)))) continue;
    report.counted.push(file);
    if (named.has(file)) continue;
    const claimed = ruleWith.get(heading(file) ?? "");
    const owner = nearest(file);
    if (claimed !== undefined) broken(file, "its heading states a rule that does not name it", claimed.claude, claimed.bold!);
    else if (owner !== null && !lowest.includes(owner)) broken(file, "its nearest CLAUDE.md is not lowest-level", owner);
    else {
      report.notYetTied.files.push(file);
      if (cannotCarryHeading(file, repo.read(file))) report.cannotCarryHeading.push(file);
    }
  }
  report.counted = [...report.counted, ...dataFolders].sort();
  return report;
}

export function exemptPerGroup(r: TieReport): Record<ExemptGroup, number> {
  return Object.fromEntries(EXEMPT_GROUPS.map((group) => [group, r.exempt.filter((e) => e.group === group).length])) as Record<ExemptGroup, number>;
}

export function brokenLines(r: TieReport): string[] {
  return r.broken.map((b) => `${b.file}: ${b.problem}${b.rule === undefined ? "" : ` (${b.claude}: "${b.rule}")`}`).sort();
}

// The files git tracks, and the new ones it does not ignore, that exist on disk, each named whole; the files on disk
// that git ignores; the files each language's test runner collects tests from by its own discovery, and the settings
// files it loads for them (a settings file, such as conftest.py, applies to the tests in its folder and below).
export async function gitRepoView(root: string, languages: readonly Language[]): Promise<RepoView> {
  const listed = (...options: string[]) =>
    execFileSync("git", ["ls-files", "-z", ...options], { cwd: root, encoding: "utf8", maxBuffer: 1 << 30 }).split("\0").filter((f) => f !== "");
  const files = [...new Set(listed("--cached", "--others", "--exclude-standard"))]
    .filter((file) => fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile() === true).sort();
  const collected = new Set<string>();
  for (const language of languages.filter((l) => files.some((file) => languageFor(file, languages) === l)))
    for (const [file, ids] of await language.collectTests(root, [])) if (ids.length > 0) collected.add(file);
  const runnerConfig = files.filter((file) => languages.some((l) => l.testRunnerConfig.includes(path.posix.basename(file)))
    && [...collected].some((test) => inside(test, folderOf(file))));
  return {
    root, files, read: (file) => fs.readFileSync(path.join(root, file), "utf8"),
    ignoredOnDisk: new Set(listed("--others", "--ignored", "--exclude-standard")), collected, runnerConfig: new Set(runnerConfig),
  };
}
