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
  // The skipped parts that version 1 does not check, for the gate to list as later-version items: the global
  // CLAUDE.md's own System Rules block, found by its heading until milestone L2 checks it against its reference.
  laterVersion: { kind: "system rules block"; start: number; end: number }[];
}

const GLOBAL = "CLAUDE.md";
const SUMMARY_HEADING = "## What the CLAUDE.md files are";
const SYSTEM_RULES_HEADING = "## System Rules";
const NEVER_CHANGE = "Never change a CLAUDE.md unless the user directly asks you to.";

const HEADING = /^(#{1,6})(?:\s|$)/;
const ITEM = /^\s*(?:[-*+]|(\d+)[.)])\s+(?:\*\*(.+?)\*\*)?/;     // a bulleted or numbered item: its number, its bold sentence
const FENCE_OPEN = /^\s*(`{3,}|~{3,})/;
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
const FILE_LINE = /^\s*\*File:\*/;
const FILE_VALUE = /^\s*\*File:\*\s*(?:`([^`]+)`|(the whole folder|needed))\s*$/;

const lines = (text: string) => text.replace(/\r\n/g, "\n").split("\n");
const indentOf = (line: string) => line.length - line.trimStart().length;
const isBlank = (line: string) => line.trim() === "";
const boldOf = (item: RegExpExecArray) => item[2]?.trim() ?? null;     // an item's bold sentence, trimmed, or none

// A fenced block opens at a line of three or more backticks or tildes, and closes at a line of the same character, at
// least as long, with nothing after it. One opened in a rule's text also ends before the first non-blank line indented
// no deeper than the rule's marker, as the rule's list item ends there; one opened outside every rule has no such end.
interface Fence { marker: string; ruleIndent: number | null; line: number }

function openFence(line: string, n: number, ruleIndent: number | null): Fence | null {
  const open = FENCE_OPEN.exec(line);
  return open === null ? null : { marker: open[1], ruleIndent, line: n };
}

// Where the line is: inside the fenced block, its closing line, or out of it (the block ended before the line).
function fenceLine(fence: Fence, line: string): "inside" | "closing" | "out" {
  if (fence.ruleIndent !== null && !isBlank(line) && indentOf(line) <= fence.ruleIndent) return "out";
  const close = FENCE_CLOSE.exec(line);
  const closes = close !== null && close[1][0] === fence.marker[0] && close[1].length >= fence.marker.length;
  return closes ? "closing" : "inside";
}

// How the reader reads each line of a rule's text: the rule's own item line or a sub-rule's ("item"), a line of a
// fenced block, its fence lines included ("fence"), or any other line ("text"). A numbered line straight after a line
// of text, with no bold sentence, numbered other than 1 and not at the indent of the sub-rule before it, is that text
// hard-wrapped, such as "16. It is measured first." after "The cap is set to" (Markdown starts a list inside a
// paragraph only at 1; a sub-rule numbered by its step opens with its bold sentence).
export type RuleTextLine = "item" | "fence" | "text";

export function ruleTextLines(text: string): RuleTextLine[] {
  const all = lines(text);
  const ruleIndent = indentOf(all[0]);
  const kinds: RuleTextLine[] = ["item"];
  let fence: Fence | null = null;
  let listIndent: number | null = null;       // the indent of the last sub-rule
  for (let k = 1; k < all.length; k++) {
    const line = all[k];
    if (fence !== null) {
      const where = fenceLine(fence, line);
      if (where === "closing") fence = null;
      if (where !== "out") {
        kinds.push("fence");
        continue;
      }
      fence = null;
    }
    fence = openFence(line, k + 1, ruleIndent);
    const item = ITEM.exec(line);
    const hardWrapped = item !== null && item[1] !== undefined && item[2] === undefined && Number(item[1]) !== 1 &&
      kinds[k - 1] !== "fence" && !isBlank(all[k - 1]) && indentOf(line) !== listIndent;
    const kind = fence !== null ? "fence" : item !== null && !hardWrapped ? "item" : "text";
    if (kind === "item") listIndent = indentOf(line);
    kinds.push(kind);
  }
  return kinds;
}

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
  while (isBlank(all[end - 1])) end--;
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

// A named rule's key is its CLAUDE.md and its bold sentence. An unnamed rule's is its CLAUDE.md and a hash of its text,
// and, from the second unnamed rule with that text in that CLAUDE.md on, which one it is (`occurrence`, from 1).
export function ruleKey(claude: string, bold: string | null, text: string, occurrence = 1): string {
  if (bold !== null) return `${claude}::${bold}`;
  const key = `${claude}::unnamed::${createHash("sha256").update(text).digest("hex").slice(0, 12)}`;
  return occurrence === 1 ? key : `${key}::${occurrence}`;
}

// The items in a rule's text after its first line, outside its fenced blocks.
function subrules(rule: Rule): Rule["subrules"] {
  const textLines = rule.text.split("\n");
  return ruleTextLines(rule.text).flatMap((kind, k) =>
    kind === "item" && k > 0 ? [{ bold: boldOf(ITEM.exec(textLines[k])!), line: rule.startLine + k }] : []);
}

function fileLine(value: RegExpExecArray, line: number): FileLine {
  if (value[1] !== undefined) return { kind: "path", path: value[1], line };
  return value[2] === "needed" ? { kind: "needed", line } : { kind: "whole-folder", line };
}

// A rule is an item at the start of its line that no rule's text holds. Its text runs over blank lines to the next
// rule at the same or a lower indent, the next heading, its file line, or a fence at its indent or lower; it holds
// every fenced block opened in it. A file line ties its rule only straight after a line of the rule's text. A fenced
// block outside every rule is stray, and one never closed is a problem.
export function readClaudeMd(claude: string, text: string, globalText: string): ReadResult {
  const all = lines(text);
  const units = skippedUnits(claude, globalText);
  const result: ReadResult = { rules: [], skipped: [], stray: [], problems: [], laterVersion: [] };
  let rule: Rule | null = null;           // the rule whose text the next line may go on
  let fence: Fence | null = null;         // the open fenced block, in `rule` if that is open
  let category: string | null = null;

  for (let i = 0; i < all.length; i++) {
    const line = all[i];
    const n = i + 1;

    if (fence !== null) {
      const where = fenceLine(fence, line);
      if (where === "closing") fence = null;
      if (where !== "out") {
        if (isBlank(line)) continue;
        if (rule !== null) rule.endLine = n;
        else result.stray.push({ line: n, text: line });
        continue;
      }
      fence = null;
    }
    // A copied opening's part or the System Rules block starts here, line for line: skip it whole, once.
    const unit = units.find((u) => u.lines.every((unitLine, k) => all[i + k] === unitLine));
    if (unit !== undefined) {
      units.splice(units.indexOf(unit), 1);
      const end = n + unit.lines.length - 1;
      const last = result.skipped.at(-1);
      const nextTo = last !== undefined && all.slice(last.end, i).every((l) => isBlank(l) || headingLevel(l) !== null);
      if (nextTo && last.kind === unit.kind) last.end = end;
      else result.skipped.push({ kind: unit.kind, start: n, end });
      if (unit.kind === "system rules block" && claude === GLOBAL) result.laterVersion.push({ kind: unit.kind, start: n, end });
      for (const [k, unitLine] of unit.lines.entries()) {
        const problem = "an item in the global's summary is never read as a rule";
        if (unit.kind === "global summary" && ITEM.test(unitLine)) result.problems.push({ line: n + k, text: unitLine, problem });
      }
      i = end - 1;
      rule = null;
      continue;
    }
    if (isBlank(line)) continue;

    if (headingLevel(line) !== null) {
      rule = null;
      category = line.replace(/^#+/, "").trim();
      continue;
    }
    if (FILE_LINE.test(line)) {
      const problem = (why: string) => result.problems.push({ line: n, text: line, problem: why });
      const value = FILE_VALUE.exec(line);
      if (result.rules.at(-1)?.fileLine?.line === n - 1) problem("a rule names two files");
      else if (rule === null || rule.endLine !== n - 1) problem("a file line is not directly under its rule's text");
      else if (value === null) problem("a file line names no file, nor 'the whole folder' or 'needed'");
      else rule.fileLine = fileLine(value, n);
      rule = null;
      continue;
    }

    const item = ITEM.exec(line);
    const indent = indentOf(line);
    if (rule !== null && (indent > rule.indent || (item === null && !FENCE_OPEN.test(line)))) {
      rule.endLine = n;
      fence = openFence(line, n, rule.indent);
      continue;
    }
    rule = null;
    fence = openFence(line, n, null);
    if (fence !== null) result.stray.push({ line: n, text: line });
    else if (item !== null) {
      rule = {
        claude, key: "", bold: boldOf(item), number: item[1] === undefined ? null : Number(item[1]), indent,
        startLine: n, endLine: n, text: "", fileLine: null, category, subrules: [],
      };
      result.rules.push(rule);
    } else result.stray.push({ line: n, text: line });
  }

  if (fence !== null) result.problems.push({ line: fence.line, text: all[fence.line - 1], problem: "a fenced block is never closed" });

  for (const [k, r] of result.rules.entries()) {
    r.text = all.slice(r.startLine - 1, r.endLine).join("\n");
    const twinsBefore = result.rules.slice(0, k).filter((o) => o.bold === null && o.text === r.text).length;
    r.key = ruleKey(claude, r.bold, r.text, twinsBefore + 1);
    r.subrules = subrules(r);
  }
  return result;
}

// Every CLAUDE.md among the files (path from the repo root -> text), each read against the global one.
export function readAll(files: ReadonlyMap<string, string>): Map<string, ReadResult> {
  const globalText = files.get(GLOBAL) ?? "";
  const claudes = [...files].filter(([file]) => path.posix.basename(file) === "CLAUDE.md");
  return new Map(claudes.map(([file, text]) => [file, readClaudeMd(file, text, globalText)]));
}
