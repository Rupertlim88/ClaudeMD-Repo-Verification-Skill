// The two-way tie check: every counted file is tied to exactly one specific rule of the lowest-level CLAUDE.md that
// covers it, and every specific rule to exactly one file. It reads the rules of every CLAUDE.md, each file's heading
// and imports, and the exempt list; it reports what is broken, in both directions, and what is not yet tied.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { languageFor, type FileFacts, type Language } from "../code/language.ts";
import { readAll, type Rule, type RuleRef } from "./rule-reader.ts";

export type ExemptGroup = "tests" | "docs" | "tool settings" | "CLAUDE.md files" | "empty package file";
export interface ExemptPattern { pattern: string; group: ExemptGroup; reason: string }
export interface ExemptConfig { patterns: ExemptPattern[] }
export interface RepoView { root: string; files: string[]; read(path: string): string; ignoredOnDisk: ReadonlySet<string> }
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

const folderOf = (file: string) => (path.posix.dirname(file) === "." ? "" : path.posix.dirname(file));
const inside = (file: string, folder: string) => (folder === "" ? !file.startsWith("../") : file.startsWith(`${folder}/`));
const isCode = (file: string, text: string) => CODE.has(path.posix.extname(file)) || text.startsWith("#!");
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

// Each group's content rule: why the group refuses a file its pattern matched, or null when the file belongs to it.
const CONTENT: Record<ExemptGroup, (file: string, text: string, facts: FileFacts | undefined) => string | null> = {
  "tests": (file, _text, facts) =>
    folderOf(file).split("/").includes("tests") || facts?.definesTest ? null : "defines no test, outside a tests folder",
  "docs": (file, text) => (isCode(file, text) ? "is a code file" : null),
  "tool settings": () => null,
  "CLAUDE.md files": () => null,
  "empty package file": (_file, _text, facts) =>
    facts?.emptyPackage ? null : "holds more than comments, a docstring and the names it passes on",
};

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

  // The exempt list: the first pattern whose group's content rule holds places the file; any other file is counted.
  const exempt = new Set<string>();
  for (const file of repo.files) {
    const refused: { file: string; group: ExemptGroup; why: string }[] = [];
    for (const { pattern, group, reason } of config.patterns.filter((p) => matchesPattern(file, p.pattern))) {
      const why = CONTENT[group](file, repo.read(file), facts.get(file));
      if (why !== null) refused.push({ file, group, why });
      else {
        report.exempt.push({ file, group, pattern, reason });
        exempt.add(file);
        break;
      }
    }
    if (!exempt.has(file)) report.refusedExempt.push(...refused);
  }

  // Counted code may not import from a tests folder, nor a module that git ignores, which the check would not see.
  for (const file of repo.files.filter((file) => !exempt.has(file))) {
    for (const reference of facts.get(file)?.references.filter((r) => r.kind === "import") ?? []) {
      if (reference.target.split(".").includes("tests")) broken(file, `imports ${reference.target} from a tests folder`);
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

export function brokenLines(r: TieReport): string[] {
  return r.broken.map((b) => `${b.file}: ${b.problem}${b.rule === undefined ? "" : ` (${b.claude}: "${b.rule}")`}`).sort();
}

// The files git tracks, and the new ones it does not ignore, that exist on disk, each named whole; and the files on
// disk that git ignores.
export function gitRepoView(root: string): RepoView {
  const listed = (...options: string[]) =>
    execFileSync("git", ["ls-files", "-z", ...options], { cwd: root, encoding: "utf8", maxBuffer: 1 << 30 }).split("\0").filter((f) => f !== "");
  const files = [...new Set(listed("--cached", "--others", "--exclude-standard"))]
    .filter((file) => fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile() === true).sort();
  return {
    root, files, read: (file) => fs.readFileSync(path.join(root, file), "utf8"),
    ignoredOnDisk: new Set(listed("--others", "--ignored", "--exclude-standard")),
  };
}
