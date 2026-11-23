// The rule reader: every rule of every CLAUDE.md, with its CLAUDE.md, its bold sentence (or none), its number, its
// indent and its exact text. The copied opening and the System Rules block are skipped by their exact text.
import { createHash } from "node:crypto";
import path from "node:path";

export type FileLine = { kind: "path"; path: string; line: number } | { kind: "whole-folder"; line: number }
  | { kind: "needed"; line: number };

export interface Rule {
  claude: string; key: string; bold: string | null; number: number | null; indent: number;
  startLine: number; endLine: number; text: string; fileLine: FileLine | null; category: string | null;
  subrules: { bold: string | null; line: number }[];
}

export interface RuleRef { claude: string; bold: string | null; key: string }

type SkippedKind = "copied opening" | "global summary" | "system rules block";

export interface ReadResult {
  rules: Rule[]; skipped: { kind: SkippedKind; start: number; end: number }[];
  stray: { line: number; text: string }[]; problems: { line: number; text: string; problem: string }[];
}

const GLOBAL = "CLAUDE.md";
const SUMMARY_HEADING = "## What the CLAUDE.md files are";
const SYSTEM_RULES_HEADING = "## System Rules";
const NEVER_CHANGE = "Never change a CLAUDE.md unless the user directly asks you to.";

const HEADING = /^(#{1,6})(?:\s|$)/;
const ITEM = /^\s*(?:[-*+]|(\d+)[.)])\s+(?:\*\*(.+?)\*\*)?/;     // a bulleted or numbered item: its number, its bold sentence
const FENCE = /^\s*(`{3,}|~{3,})/;
const FILE_LINE = /^\s*\*File:\*/;
const FILE_VALUE = /^\s*\*File:\*\s*(?:`([^`]+)`|(the whole folder|needed))\s*$/;

const lines = (text: string) => text.replace(/\r\n/g, "\n").split("\n");

function headingLevel(line: string): number | null {
  const heading = HEADING.exec(line);
  return heading === null ? null : heading[1].length;
}

// The lines of the section that opens with this exact heading, up to the next heading of the same or a higher level,
// without its trailing blank lines; none if there is no such heading.
function section(all: string[], heading: string): string[] {
  const start = all.indexOf(heading);
  if (start === -1) return [];
  const level = headingLevel(heading)!;
  let end = start + 1;
  for (; end < all.length; end++) {
    const next = headingLevel(all[end]);
    if (next !== null && next <= level) break;
  }
  while (all[end - 1].trim() === "") end--;
  return all.slice(start, end);
}

function ruleNeverToChange(globalText: string): string[] {
  const rule = readClaudeMd(GLOBAL, globalText, globalText).rules.find((r) => r.bold === NEVER_CHANGE);
  return rule === undefined ? [] : rule.text.split("\n");
}

export function copiedOpening(globalText: string): string[] {
  return [...section(lines(globalText), SUMMARY_HEADING), ...ruleNeverToChange(globalText)];
}

// The runs of exact lines a CLAUDE.md skips. The global one holds the originals: its summary is skipped, and its rule
// never to change a CLAUDE.md is its own rule. Every other one skips its copies of both.
function skippedUnits(claude: string, globalText: string): { kind: SkippedKind; lines: string[] }[] {
  const global = lines(globalText);
  const block = { kind: "system rules block" as const, lines: section(global, SYSTEM_RULES_HEADING) };
  const units = claude === GLOBAL
    ? [{ kind: "global summary" as const, lines: section(global, SUMMARY_HEADING) }, block]
    : [{ kind: "copied opening" as const, lines: section(global, SUMMARY_HEADING) },
      { kind: "copied opening" as const, lines: ruleNeverToChange(globalText) }, block];
  return units.filter((unit) => unit.lines.length > 0);
}

export function ruleKey(claude: string, bold: string | null, text: string): string {
  if (bold !== null) return `${claude}::${bold}`;
  return `${claude}::unnamed::${createHash("sha256").update(text).digest("hex").slice(0, 12)}`;
}

function fileLine(value: RegExpExecArray, line: number): FileLine {
  if (value[1] !== undefined) return { kind: "path", path: value[1], line };
  return value[2] === "needed" ? { kind: "needed", line } : { kind: "whole-folder", line };
}

// A rule is an item at the start of its line that no rule's text holds. Its text goes on through every line indented
// deeper than it, every line straight after one of its lines, and every fenced block opened in it; it ends at the
// next rule at the same or a lower indent, a heading, a file line, or a line at its indent after a blank line.
export function readClaudeMd(claude: string, text: string, globalText: string): ReadResult {
  const all = lines(text);
  const units = skippedUnits(claude, globalText);
  const result: ReadResult = { rules: [], skipped: [], stray: [], problems: [] };
  let rule: Rule | null = null;                                  // the rule the next line may belong to
  let tied: Rule | null = null;                                  // the rule whose file line the last line was
  let fence: { marker: string; rule: Rule | null } | null = null;  // the open fenced block, and the rule holding it
  let category: string | null = null;
  let afterBlank = false;

  for (let i = 0; i < all.length; i++) {
    const line = all[i];
    const n = i + 1;
    const tiedBefore = tied;
    tied = null;

    if (fence !== null) {
      if (fence.rule !== null) fence.rule.endLine = n;
      if (line.trimStart().startsWith(fence.marker)) fence = null;
      continue;
    }
    // A copied opening's part or the System Rules block starts here, line for line: skip it whole, once.
    const unit = units.find((u) => u.lines.every((unitLine, k) => all[i + k] === unitLine));
    if (unit !== undefined) {
      units.splice(units.indexOf(unit), 1);
      const end = n + unit.lines.length - 1;
      const last = result.skipped.at(-1);
      if (last?.kind === unit.kind) last.end = end;
      else result.skipped.push({ kind: unit.kind, start: n, end });
      i = end - 1;
      rule = null;
      afterBlank = false;
      continue;
    }
    if (line.trim() === "") {
      afterBlank = true;
      continue;
    }
    const wasAfterBlank = afterBlank;
    afterBlank = false;

    if (headingLevel(line) !== null) {
      rule = null;
      category = line.replace(/^#+/, "").trim();
      continue;
    }
    if (FILE_LINE.test(line)) {
      const problem = (why: string) => result.problems.push({ line: n, text: line, problem: why });
      const value = FILE_VALUE.exec(line);
      if (tiedBefore !== null) problem("a rule names two files");
      else if (rule === null || wasAfterBlank) problem("a file line is not directly under its rule's text");
      else if (value === null) problem("a file line names no file, nor 'the whole folder' or 'needed'");
      else {
        rule.fileLine = fileLine(value, n);
        tied = rule;
      }
      rule = null;
      continue;
    }

    const item = ITEM.exec(line);
    const fenceStart = FENCE.exec(line);
    const indent = line.length - line.trimStart().length;
    if (rule !== null && (indent > rule.indent || (!wasAfterBlank && item === null))) {
      rule.endLine = n;
      if (fenceStart !== null) fence = { marker: fenceStart[1], rule };
      else if (item !== null) rule.subrules.push({ bold: item[2] ?? null, line: n });
      continue;
    }
    rule = null;
    if (fenceStart !== null) fence = { marker: fenceStart[1], rule: null };
    else if (item !== null) {
      rule = {
        claude, key: "", bold: item[2] ?? null, number: item[1] === undefined ? null : Number(item[1]), indent,
        startLine: n, endLine: n, text: "", fileLine: null, category, subrules: [],
      };
      result.rules.push(rule);
    } else result.stray.push({ line: n, text: line });
  }

  for (const r of result.rules) {
    r.text = all.slice(r.startLine - 1, r.endLine).join("\n");
    r.key = ruleKey(claude, r.bold, r.text);
  }
  return result;
}

// Every CLAUDE.md among the files (path from the repo root -> text), each read against the global one.
export function readAll(files: ReadonlyMap<string, string>): Map<string, ReadResult> {
  const globalText = files.get(GLOBAL) ?? "";
  const claudes = [...files].filter(([file]) => path.posix.basename(file) === "CLAUDE.md");
  return new Map(claudes.map(([file, text]) => [file, readClaudeMd(file, text, globalText)]));
}
