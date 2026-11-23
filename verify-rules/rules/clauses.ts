// The clause-table builder: the first cut of a rule's text into clauses, and the check of any clause list against
// the text and its floor. A clause is a [start, end) span of the rule's text, so it is an exact substring of it.
import type { Rule } from "./rule-reader.ts";

export const KEYWORDS: readonly string[] =
  ["never", "only", "always", "at most", "at least", "before", "after", "each", "every", "if", "unless", "when", "until"];

export interface Clause { id: string; rule: string; start: number; end: number; text: string }
export interface ClauseCheck { ok: boolean; clauses: number; floor: number; problems: string[] }

type Span = [number, number];

const KEYWORD = KEYWORDS.map((k) => k.replace(" ", "\\s+")).join("|");
const KEYWORD_MARKER = new RegExp(`\\b(?:${KEYWORD})(?:\\s+(?:${KEYWORD}))*\\b`, "gi");   // "only after" is one marker
const NUMBER_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
const NUMBER = new RegExp(`\\b(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?\\b|\\b(?:${NUMBER_WORDS})\\b`, "gi");
const WORD = /[\p{L}\p{N}]+/gu;
const ABBREVIATION = /\b(?:e\.g|i\.e|et al|etc|vs|cf)$/i;
const LIST_MARKER = /^(\s*)([-*+]|\d+[.)])(?=\s)/;
const FENCE = /^\s*(`{3}|~{3})/;
const TABLE_LINE = /^\s*\|/;
const TAG = /\*\([^\n]*?\)\*/g;                      // such as *(NIST REC-API-3)*

const blank = (s: string) => s.replace(/[^\n]/g, " ");

interface Reading { words: string; scan: string; subruleStarts: number[]; numbers: Span[]; keywords: Span[] }

// The rule's text as the cut reads it, each the same length as the text. In `words`, list markers are blanked out,
// so the rule's own list number and its sub-rules' numbers are not words. In `scan`, bold markers, fenced blocks,
// table lines and tags are blanked out too, so none of them holds a number, a keyword or a sentence end, and no cut
// falls inside a block, a table or a tag.
function reading(text: string): Reading {
  const words: string[] = [];
  const scan: string[] = [];
  const subruleStarts: number[] = [];
  let offset = 0;
  let inFence = false;
  for (const [i, line] of text.split("\n").entries()) {
    const fenceLine = FENCE.test(line);
    if (inFence || fenceLine || TABLE_LINE.test(line)) {
      words.push(line);
      scan.push(blank(line));
      if (fenceLine) inFence = !inFence;
    } else {
      const marker = LIST_MARKER.exec(line);
      const unmarked = marker === null ? line : marker[1] + blank(marker[2]) + line.slice(marker[0].length);
      if (marker !== null && i > 0) subruleStarts.push(offset);
      words.push(unmarked);
      scan.push(unmarked.replace(TAG, blank).replace(/\*\*/g, "  "));
    }
    offset += line.length + 1;
  }
  const scanText = scan.join("\n");
  const spans = (pattern: RegExp) => [...scanText.matchAll(pattern)].map((m): Span => [m.index, m.index + m[0].length]);
  return { words: words.join("\n"), scan: scanText, subruleStarts, numbers: spans(NUMBER), keywords: spans(KEYWORD_MARKER) };
}

const within = (markers: Span[], [start, end]: Span) => markers.filter(([s]) => s >= start && s < end);

// A sentence ends at ".", "?" or "!" followed by space and a next sentence that does not start in lower case, and
// not after an abbreviation. The next sentence starts at its first character, or at the start of its line when a line
// break lies between them. Each sub-rule starts a sentence.
function sentenceSpans(text: string, r: Reading): Span[] {
  const cuts = new Set([0, ...r.subruleStarts, text.length]);
  for (const end of r.scan.matchAll(/[.?!](\s+)(?=(\S))/g)) {
    if (/\p{Ll}/u.test(end[2]) || ABBREVIATION.test(r.scan.slice(0, end.index))) continue;
    const space = end[1];
    const breakAt = space.lastIndexOf("\n");
    cuts.add(end.index + 1 + (breakAt === -1 ? space.length : breakAt + 1));
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  return sorted.slice(1).map((end, k): Span => [sorted[k], end]).filter(([s, e]) => /[\p{L}\p{N}]/u.test(r.words.slice(s, e)));
}

export function sentences(text: string): Span[] {
  return sentenceSpans(text, reading(text));
}

// Between two markers, the cut goes after the last comma, semicolon or colon between them (and its spaces),
// or else right before the second marker.
function cutBetween(scan: string, from: number, to: number): number {
  const punctuation = [...scan.slice(from, to).matchAll(/[,;:]\s*/g)].at(-1);
  return punctuation === undefined ? to : from + punctuation.index + punctuation[0].length;
}

// Each sentence, cut until no clause holds two numbers or two keywords.
export function firstCut(text: string): Span[] {
  const r = reading(text);
  const todo = sentenceSpans(text, r);
  const clauses: Span[] = [];
  while (todo.length > 0) {
    const span = todo.shift()!;
    const crowded = [within(r.numbers, span), within(r.keywords, span)].find((markers) => markers.length > 1);
    if (crowded === undefined) {
      clauses.push(span);
      continue;
    }
    const cut = cutBetween(r.scan, crowded[0][1], crowded[1][0]);
    todo.unshift([span[0], cut], [cut, span[1]]);
  }
  return clauses;
}

function floorOf(text: string, r: Reading): number {
  return sentenceSpans(text, r)
    .reduce((sum, span) => sum + Math.max(1, within(r.numbers, span).length, within(r.keywords, span).length), 0);
}

// Per sentence, the larger of 1, its numbers and its keywords, summed over the sentences.
export function floor(text: string): number {
  return floorOf(text, reading(text));
}

export function checkClauses(text: string, spans: readonly Span[]): ClauseCheck {
  const r = reading(text);
  const problems: string[] = [];
  const covered = new Array<boolean>(text.length).fill(false);
  for (const [start, end] of spans) {
    if (!(start >= 0 && start < end && end <= text.length)) {
      problems.push(`the span ${start}-${end} is not inside the text`);
      continue;
    }
    covered.fill(true, start, end);
    const clause = JSON.stringify(text.slice(start, end));
    const numbers = within(r.numbers, [start, end]).length;
    const keywords = within(r.keywords, [start, end]).length;
    if (numbers > 1) problems.push(`the clause ${clause} holds ${numbers} numbers`);
    if (keywords > 1) problems.push(`the clause ${clause} holds ${keywords} keywords`);
  }
  for (const word of r.words.matchAll(WORD)) {
    if (!covered.slice(word.index, word.index + word[0].length).every(Boolean)) {
      problems.push(`the word ${JSON.stringify(word[0])} at ${word.index} is in no clause`);
    }
  }
  const need = floorOf(text, r);
  if (spans.length < need) problems.push(`${spans.length} clauses, below the floor of ${need}`);
  return { ok: problems.length === 0, clauses: spans.length, floor: need, problems };
}

// The rule's clause table: the first cut, each clause cut again at the reviewer's further cuts that fall inside it.
// A further cut can only split a clause; it never joins two.
export function clauseTable(rule: Rule, furtherCuts: readonly number[] = []): { clauses: Clause[]; check: ClauseCheck } {
  const spans = firstCut(rule.text).flatMap(([start, end]) => {
    const inside = [...new Set(furtherCuts)].filter((cut) => cut > start && cut < end).sort((a, b) => a - b);
    const bounds = [start, ...inside, end];
    return bounds.slice(1).map((to, k): Span => [bounds[k], to]);
  });
  const clauses = spans.map(([start, end], k) =>
    ({ id: `${rule.key}#c${k + 1}`, rule: rule.key, start, end, text: rule.text.slice(start, end) }));
  return { clauses, check: checkClauses(rule.text, spans) };
}
