// The items of the user's four-part check of the two-way ties, each with its fixed question filled in, and the state
// each question is asked about, built by script from the repo's files, never from text the doer types.
import { createHash } from "node:crypto";
import path from "node:path";
import { languageFor, type FileFacts, type Language, type Piece } from "../code/language.ts";
import { clauseTable, type Clause } from "../rules/clauses.ts";
import { readAll, type Rule } from "../rules/rule-reader.ts";
import { brokenLines, type RepoView, type TieReport } from "../rules/tie-check.ts";
import { fillQuestion, QUESTIONS } from "./jev.ts";

export interface TieItem {
  id: string; part: "1" | "2" | "2-list" | "3" | "4"; template: string; question: string; rule: Rule;
  file: string | null; clause: { n: number; clause: Clause } | null; piece: Piece | null; candidate: Rule | null; writes: string[];
}

// The pieces part 4 asks about: the code of a file, not its heading or its imports.
const PIECE_KINDS = new Set(["function", "class", "method", "statement"]);

const folderOf = (file: string) => (path.posix.dirname(file) === "." ? "" : path.posix.dirname(file));
const covers = (claude: string, file: string) => folderOf(claude) === "" || file.startsWith(`${folderOf(claude)}/`);
const isData = (file: string) => file.endsWith("/");
const short = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 8);
// A clause as a sentence: without its list marker or bold markers, on one line.
const plain = (text: string) => text.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

export function rulesOf(view: RepoView): Rule[] {
  const claudes = view.files.filter((file) => path.posix.basename(file) === "CLAUDE.md");
  return [...readAll(new Map(claudes.map((claude) => [claude, view.read(claude)]))).values()].flatMap((r) => r.rules);
}

// The file or folder of data a rule's file line names, from the repo root; null for a rule with no such line.
const targetOf = (rule: Rule) => (rule.fileLine?.kind === "path" ? path.posix.join(folderOf(rule.claude), rule.fileLine.path) : null);

// Part 1 for every specific rule; parts 2, 3 and 4 for every rule tied both ways; all inside the scope's folder ("" is
// the whole repo). Part 4 asks each piece of a tied file about every other specific rule of the same CLAUDE.md.
export function tieItems(view: RepoView, report: TieReport, languages: readonly Language[], scope: string): { items: TieItem[] } {
  const rules = new Map(rulesOf(view).map((rule) => [rule.key, rule]));
  const tiedFile = new Map(report.ties.map((t) => [t.rule.key, t.file]));
  const folder = scope.replace(/\/+$/, "");
  const inScope = (claude: string) => folder === "" || folderOf(claude) === folder || folderOf(claude).startsWith(`${folder}/`);
  const facts = new Map<string, FileFacts>();
  for (const language of languages) {
    const files = report.ties.map((t) => t.file).filter((file) => !isData(file) && languageFor(file, languages) === language);
    for (const [file, f] of language.facts(files.map((file) => ({ path: file, text: view.read(file) })))) facts.set(file, f);
  }

  const items: TieItem[] = [];
  for (const ref of report.specific.filter((r) => inScope(r.claude))) {
    const rule = rules.get(ref.key)!;
    const file = tiedFile.get(rule.key) ?? null;
    const add = (part: TieItem["part"], id: string, template: string, values: Record<string, string>, more: Partial<TieItem> = {}) =>
      items.push({ id, part, template, question: fillQuestion(QUESTIONS.templates[template], values), rule, file, clause: null,
        piece: null, candidate: null, writes: [], ...more });
    add("1", `tie.p1:${targetOf(rule) ?? `rule-${short(rule.key)}`}`, "tie-part1", {});
    if (file === null) continue;
    for (const [k, clause] of clauseTable(rule).clauses.entries())
      add("2", `tie.p2:${file}#c${k + 1}`, "tie-part2-clause", { file, clause: plain(clause.text) }, { clause: { n: k + 1, clause } });
    add("2-list", `tie.p2-list:${file}`, "tie-part2-list", {});
    add("3", `tie.p3:${file}`, "tie-part3-file", { file, bold: rule.bold! });
    const candidates = report.specific.filter((r) => r.claude === rule.claude && r.key !== rule.key).map((r) => rules.get(r.key)!);
    const f = facts.get(file);
    for (const piece of (f?.pieces ?? []).filter((p) => PIECE_KINDS.has(p.kind))) {
      for (const candidate of candidates) {
        add("4", `tie.p4:${file}@${piece.id}~${tiedFile.get(candidate.key) ?? `rule-${short(candidate.key)}`}`, "tie-part4-piece",
          { bold: candidate.bold! }, { piece, candidate, writes: f!.writes[piece.id] ?? [] });
      }
    }
  }
  return { items };
}

const numbered = (lines: string[], first = 1) => lines.map((line, i) => `${String(first + i).padStart(4)}  ${line}`).join("\n");

// A file with its numbered lines; or a folder of data as its listing: each file's name and size, and a text file's
// first lines.
function fileBlock(view: RepoView, file: string): string {
  if (!isData(file)) return `FILE ${file}:\n${numbered(view.read(file).split("\n"))}`;
  const prefix = file === "./" ? "" : file;
  const listing = view.files.filter((f) => f.startsWith(prefix)).map((f) => {
    const text = view.read(f);
    const head = text.includes("\0") ? "(binary)" : text.split("\n").slice(0, 5).join("\n");
    return `${f.slice(prefix.length)} (${Buffer.byteLength(text)} bytes)\n${head}`;
  });
  return `FOLDER OF DATA ${file}: each of its files, with its size and its first lines:\n${listing.join("\n\n")}`;
}

const ruleBlock = (title: string, rule: Rule) => `${title} (${rule.claude}), its whole text:\n${rule.text}`;

// The state the item's question is asked about: only what its part of the tie check says the state holds.
export function stateOf(item: TieItem, view: RepoView, report: TieReport): string {
  const { rule, file } = item;
  switch (QUESTIONS.templates[item.template].state) {
    case "tie-output": {
      const target = targetOf(rule);
      const tied = report.ties.some((t) => t.rule.key === rule.key);
      const lines = brokenLines(report).filter((line) => (target !== null && line.includes(target)) || line.includes(`"${rule.bold}"`));
      return `THE TWO-WAY TIE CHECK, RUN BY SCRIPT, FOR ONE RULE AND ITS FILE\nrule (${rule.claude}): ${rule.bold}\n` +
        `its file line names: ${target ?? "no file"}\ntied both ways: ${tied ? "yes" : "no"}\n` +
        `broken lines naming this rule or its file:\n${lines.join("\n") || "none"}`;
    }
    case "clause":
      return `${ruleBlock("RULE", rule)}\n\nCLAUSE c${item.clause!.n}:\n${plain(item.clause!.clause.text)}\n\n${fileBlock(view, file!)}`;
    case "clause-list": {
      const { clauses, check } = clauseTable(rule);
      const rows = clauses.map((c, k) => `c${k + 1} [${c.start}-${c.end}] ${JSON.stringify(c.text)}`).join("\n");
      const verdict = check.ok ? "passes its floor" : `fails (${check.problems.join("; ")})`;
      return `${ruleBlock("RULE", rule)}\n\nCLAUSE LIST, built by script (a span is the clause's character positions in the rule's ` +
        `text):\n${rows}\n\nSCRIPT CHECK: ${verdict}: ${check.clauses} clauses, floor ${check.floor}`;
    }
    case "file-serves": {
      const general = new Set(report.general.map((g) => g.rule.key));
      const over = rulesOf(view).filter((r) => general.has(r.key) && covers(r.claude, file!));
      return `${fileBlock(view, file!)}\n\n${ruleBlock("ITS RULE", rule)}\n\nTHE GENERAL RULES OVER ITS FOLDER, from every CLAUDE.md ` +
        `that covers it:\n${over.map((r) => `(${r.claude})\n${r.text}`).join("\n\n") || "none"}`;
    }
    case "piece-rule": {
      const piece = item.piece!;
      const lines = view.read(file!).split("\n").slice(piece.start - 1, piece.end);
      return `PIECE ${piece.id} (${piece.kind} ${piece.name}) of ${file}, lines ${piece.start}-${piece.end}:\n` +
        `${numbered(lines, piece.start)}\n\nWHAT IT WRITES, found by script: ${item.writes.join("; ") || "nothing found"}\n\n` +
        `THE FILE'S OWN RULE (${rule.claude}): ${rule.bold}\n\n${ruleBlock("THE OTHER RULE", item.candidate!)}`;
    }
    default:
      throw new Error(`the template ${item.template} is not a tie check question`);
  }
}

// The state of a step's check: the step's own instructions from SKILL.md, the rule and file it is about if any, and the
// outputs that verify captured in the run folder.
export function stepState(skill: string, step: string, about: { view: RepoView; bold: string | null; file: string | null } | null,
  evidence: readonly { name: string; text: string }[]): string {
  const lines = skill.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`### Step ${step}.`));
  if (start === -1) throw new Error(`SKILL.md has no step ${step}`);
  const end = lines.findIndex((line, i) => i > start && /^#{2,3} /.test(line));
  const parts = [`INSTRUCTIONS (SKILL.md, step ${step}):\n${lines.slice(start, end === -1 ? undefined : end).join("\n").trim()}`];
  if (about?.bold != null) {
    const found = rulesOf(about.view).filter((r) => r.bold === about.bold);
    if (found.length !== 1) throw new Error(`${found.length} rules have the bold sentence "${about.bold}"; one is needed`);
    parts.push(ruleBlock("THE RULE", found[0]));
  }
  if (about?.file != null) parts.push(fileBlock(about.view, about.file));
  parts.push(`EVIDENCE, captured by verify in the run folder:\n${evidence.map((e) => `--- ${e.name} ---\n${e.text}`).join("\n")}`);
  return parts.join("\n\n");
}
