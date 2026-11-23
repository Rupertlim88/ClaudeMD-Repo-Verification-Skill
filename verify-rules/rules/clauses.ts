// The clause-table builder: the first cut of a rule's text into clauses, and the check of any clause list against
// the text and its floor. A clause is a [start, end) span of the rule's text, so it is an exact substring of it.
import { ruleTextLines, type Rule } from "./rule-reader.ts";

export const KEYWORDS: readonly string[] =
  ["never", "only", "always", "at most", "at least", "before", "after", "each", "every", "if", "unless", "when", "until"];

export interface Clause { id: string; rule: string; start: number; end: number; text: string }
export interface ClauseCheck { ok: boolean; clauses: number; floor: number; problems: string[] }

type Span = [number, number];

// The keyword phrases that are one marker each: "only" or "never" before a condition, such as "only after" or "never
// before" ("at most" and "at least" are keywords themselves). Any other run of keywords is a marker for each.
const PHRASES = ["only", "never"].flatMap((first) =>
  ["before", "after", "if", "unless", "when", "until"].map((condition) => `${first} ${condition}`));
const MARKERS = [...PHRASES, ...KEYWORDS].map((marker) => marker.replace(" ", "\\s+")).join("|");
const KEYWORD_MARKER = new RegExp(`\\b(?:${MARKERS})\\b`, "gi");
// A number: a date (2026-11-23), a number with thousands commas (5,000.5), or digits with any points (0.96, 22.18.0).
const NUMBER_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
const NUMBER = new RegExp(
  `\\b(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)*)\\b|\\b(?:${NUMBER_WORDS})\\b`, "gi");
const WORD = /[\p{L}\p{N}]+/gu;
const WORD_CHARACTER = /^[\p{L}\p{N}]$/u;
const ABBREVIATION = /\b(?:e\.g|i\.e|et al|vs|cf)$/i;
const SENTENCE_END = /[.?!][)\]"'’”]*(\s+)(?=(\S))/g;     // a stop, any closing brackets or quotes, the space after
const LIST_MARKER = /^(\s*)([-*+]|\d+[.)])(?=\s)/;
const TABLE_LINE = /^\s*\|/;
const TAG = /\*\([^\n]*?\)\*/g;                      // such as *(NIST REC-API-3)*

const blank = (s: string) => s.replace(/[^\n]/g, " ");

// A part of the text that is never cut: a fenced block or a table (each a run of lines), or a tag.
interface Whole { kind: "fenced block" | "table" | "tag"; start: number; end: number }

interface Reading { words: string; scan: string; subruleStarts: number[]; numbers: Span[]; keywords: Span[]; wholes: Whole[] }

// The rule's text as the cut reads it, each the same length as the text. In `words`, list markers are blanked out,
// so the rule's own list number and its sub-rules' numbers are not words. In `scan`, bold markers, fenced blocks
// (as the rule reader finds them), table lines and tags are blanked out too, so none of them holds a number, a
// keyword or a sentence end, and no cut falls inside a block, a table or a tag.
function reading(text: string): Reading {
  const words: string[] = [];
  const scan: string[] = [];
  const subruleStarts: number[] = [];
  const wholes: Whole[] = [];
  const kinds = ruleTextLines(text);
  let offset = 0;
  for (const [i, line] of text.split("\n").entries()) {
    const block = kinds[i] === "fence" ? "fenced block" : TABLE_LINE.test(line) ? "table" : null;
    if (block !== null) {
      words.push(line);
      scan.push(blank(line));
      const last = wholes.at(-1);
      if (last?.kind === block && last.end === offset - 1) last.end = offset + line.length;
      else wholes.push({ kind: block, start: offset, end: offset + line.length });
    } else {
      const marker = kinds[i] === "item" ? LIST_MARKER.exec(line) : null;
      const unmarked = marker === null ? line : marker[1] + blank(marker[2]) + line.slice(marker[0].length);
      if (marker !== null && i > 0) subruleStarts.push(offset);
      for (const tag of unmarked.matchAll(TAG)) {
        wholes.push({ kind: "tag", start: offset + tag.index, end: offset + tag.index + tag[0].length });
      }
      words.push(unmarked);
      scan.push(unmarked.replace(TAG, blank).replace(/\*\*/g, "  "));
    }
    offset += line.length + 1;
  }
  const scanText = scan.join("\n");
  const spans = (pattern: RegExp) => [...scanText.matchAll(pattern)].map((m): Span => [m.index, m.index + m[0].length]);
  return { words: words.join("\n"), scan: scanText, subruleStarts, numbers: spans(NUMBER), keywords: spans(KEYWORD_MARKER), wholes };
}

const within = (markers: Span[], [start, end]: Span) => markers.filter(([s]) => s >= start && s < end);

// A sentence ends at ".", "?" or "!", with any closing brackets or quotes after it, followed by space and a next
// sentence that does not start in lower case, and not after an abbreviation ("etc." can end a sentence). The next
// sentence starts at its first character, or at the start of its line when a line break lies between them. Each
// sub-rule starts a sentence.
function sentenceSpans(text: string, r: Reading): Span[] {
  const cuts = new Set([0, ...r.subruleStarts, text.length]);
  for (const end of r.scan.matchAll(SENTENCE_END)) {
    if (/\p{Ll}/u.test(end[2]) || ABBREVIATION.test(r.scan.slice(0, end.index))) continue;
    const first = end.index + end[0].length;                       // the next sentence's first character
    const lineStart = r.scan.lastIndexOf("\n", first - 1) + 1;
    cuts.add(lineStart > end.index ? lineStart : first);
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

const strictlyInside = (edge: number, [start, end]: Span) => start < edge && edge < end;

// What a clause edge falls inside, if anything: a fenced block, a table, a tag, a number or a word.
function insideOf(edge: number, text: string, r: Reading): string | null {
  const whole = r.wholes.find((w) => strictlyInside(edge, [w.start, w.end]));
  if (whole !== undefined) return whole.kind;
  if (r.numbers.some((number) => strictlyInside(edge, number))) return "number";
  return WORD_CHARACTER.test(text.charAt(edge - 1)) && WORD_CHARACTER.test(text.charAt(edge)) ? "word" : null;
}

// Each span must be a clause: inside the text, not empty, overlapping no other, within one sentence, with no edge
// inside a block, a table, a tag, a number or a word, and holding at most one number and one keyword. Together the
// clauses cover every word, and there are at least as many distinct ones as the floor.
export function checkClauses(text: string, spans: readonly Span[]): ClauseCheck {
  const r = reading(text);
  const problems: string[] = [];
  const clauses: Span[] = [];
  for (const [start, end] of spans) {
    if (start === end) problems.push(`the span ${start}-${end} is empty`);
    else if (start < 0 || start > end || end > text.length) problems.push(`the span ${start}-${end} is not inside the text`);
    else clauses.push([start, end]);
  }
  clauses.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const boundaries = sentenceSpans(text, r).flat();
  const covered = new Array<boolean>(text.length).fill(false);
  let reach = 0;                                                 // the furthest end of the clauses so far
  for (const [start, end] of clauses) {
    const clause = JSON.stringify(text.slice(start, end));
    if (start < reach) problems.push(`the clause ${clause} overlaps an earlier clause`);
    reach = Math.max(reach, end);
    covered.fill(true, start, end);
    const boundary = boundaries.find((b) => strictlyInside(b, [start, end]));
    if (boundary !== undefined) problems.push(`the clause ${clause} crosses the sentence boundary at ${boundary}`);
    const numbers = within(r.numbers, [start, end]).length;
    const keywords = within(r.keywords, [start, end]).length;
    if (numbers > 1) problems.push(`the clause ${clause} holds ${numbers} numbers`);
    if (keywords > 1) problems.push(`the clause ${clause} holds ${keywords} keywords`);
  }
  for (const edge of new Set(clauses.flat())) {
    const inside = insideOf(edge, text, r);
    if (inside !== null) problems.push(`the clause edge at ${edge} is inside a ${inside}`);
  }
  for (const word of r.words.matchAll(WORD)) {
    if (!covered.slice(word.index, word.index + word[0].length).every(Boolean)) {
      problems.push(`the word ${JSON.stringify(word[0])} at ${word.index} is in no clause`);
    }
  }
  const distinct = new Set(clauses.map(([start, end]) => `${start}-${end}`)).size;
  const need = floorOf(text, r);
  if (distinct < need) problems.push(`${distinct} clauses, below the floor of ${need}`);
  return { ok: problems.length === 0, clauses: distinct, floor: need, problems };
}

// The rule's clause table: the first cut, each clause cut again at the reviewer's further cuts that fall inside it.
// A further cut can only split a clause; it never joins two, and one inside a block, a table, a tag, a number or a
// word fails the check.
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
