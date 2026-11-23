// Open items and declined items. An item is put off only with a reason code whose evidence the script finds itself,
// in the question log or the repo; otherwise it is refused, and the item's step fails. Declined items also live on
// as commit trailers.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { questions, type LoggedQuestion } from "./question-log.ts";
import {
  isOneOf, readState, REASON_CODES, within, type DeclinedItem, type OpenItem, type ReasonCode, type RunPaths,
} from "./state.ts";

export class Refused extends Error {}

// The open items that wait on the user, as the status file and the report's first line count them.
export const WAITING_ON_USER: ReadonlySet<ReasonCode> = new Set(["user-unanswered", "needs-user-only-fact"]);

// The sentence every "continue?" question the script writes ends with (asking-the-user.md).
export const CONTINUE_SENTENCE = "If you continue, this step stays unchecked.";

// What a code may need a question to be.
const NEEDS = {
  unanswered: (q: LoggedQuestion) => q.answer === null,
  answered: (q: LoggedQuestion) => q.answer !== null,
  "of kind b": (q: LoggedQuestion) => q.kind === "b",
  "of kind c": (q: LoggedQuestion) => q.kind === "c",
  "the script's continue question": (q: LoggedQuestion) => q.text.includes(CONTINUE_SENTENCE),
};

// The codes whose evidence is a logged question, and what each needs it to be, besides naming the item and having
// been seen sent.
const QUESTION_CODES = {
  "user-unanswered": ["unanswered"],
  "user-deferred": ["answered"],
  "needs-user-only-fact": ["of kind c"],
  "budget-refused": ["of kind b", "answered"],
  "continued-by-user": ["of kind b", "answered", "the script's continue question"],
} as const satisfies Partial<Record<ReasonCode, readonly (keyof typeof NEEDS)[]>>;

// Every check the skill has, by the start of the item ids it checks, and whether this version ships it.
export type Checks = Readonly<Record<string, "shipped" | "later">>;

// A reason code, with what the script needs to find its evidence.
export type PutOff =
  | { code: keyof typeof QUESTION_CODES; question: string } // the logged question that names the item
  | { code: "other-owner"; owner: string } // a git ref, or a file in the repo, that shows the owner
  | { code: "later-version"; checks: Checks }
  | { code: "doer-deferred" };

// An item's check: its id up to the first colon, as "7.clause" is for "7.clause:R12#c3@models/lodestar".
export const checkOf = (item: string) => item.split(":")[0];

export function setOpen(p: RunPaths, item: string, putOff: PutOff): OpenItem {
  const { code } = putOff;
  if (!isOneOf(REASON_CODES, code)) throw new Refused(`${item} cannot be put off: "${code}" is not a reason code`);
  return { item, code, evidence: evidenceFor(p, item, putOff), needsPutOffQuestion: code === "doer-deferred" };
}

// Returns the evidence for putting the item off, as the script finds it, or refuses.
function evidenceFor(p: RunPaths, item: string, putOff: PutOff): string {
  const refuse = (why: string) => new Refused(`${item} cannot be put off as ${putOff.code}: ${why}`);
  switch (putOff.code) {
    case "other-owner":
      if (!ownerShown(readState(p).repo, putOff.owner)) throw refuse(`"${putOff.owner}" is neither a git ref nor a file in the repo`);
      return putOff.owner;
    case "later-version": {
      const check = checkOf(item);
      if (putOff.checks[check] === undefined) throw refuse(`${check} is not a check of the skill`);
      if (putOff.checks[check] === "shipped") throw refuse(`the check ${check} is in this version`);
      return `the check ${check} is in a later version`;
    }
    case "doer-deferred":
      return "";
    default: {
      const q = questions(p).find((x) => x.id === putOff.question);
      if (q === undefined) throw refuse(`question ${putOff.question} is not in the question log`);
      if (!q.items.includes(item)) throw refuse(`question ${q.id} does not name ${item}`);
      if (q.askedMessageId === null) throw refuse(`question ${q.id} was not seen sent: it has no message id`);
      for (const need of QUESTION_CODES[putOff.code]) if (!NEEDS[need](q)) throw refuse(`question ${q.id} must be ${need}`);
      return `question ${q.id}`;
    }
  }
}

// Whether the owner evidence exists: a file inside the repo, or a git ref in it.
function ownerShown(repo: string, owner: string): boolean {
  const file = path.resolve(repo, owner);
  if (within(repo, file) && fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return true;
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", "--end-of-options", `${owner}^{commit}`], { cwd: repo, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function declinedTrailer(d: DeclinedItem): string {
  return `Verify-Rules-Declined: ${d.line.replace(/\r\n?|\n/g, " ")}`;
}

// The line of every Verify-Rules-Declined trailer on the branch, oldest commit first, so later runs can leave those
// items out.
export function readDeclinedTrailers(repoDir: string, branch: string): string[] {
  const log = execFileSync("git", ["log", "--reverse", "--format=%(trailers:key=Verify-Rules-Declined,valueonly)", branch, "--"],
    { cwd: repoDir, encoding: "utf8" });
  return log.split("\n").filter((line) => line !== "");
}

export function firstLineCounts(open: OpenItem[], declined: DeclinedItem[]):
  { open: number; waiting: number; doer: number; other: number; declined: number } {
  const waiting = open.filter((o) => WAITING_ON_USER.has(o.code)).length;
  const doer = open.filter((o) => o.code === "doer-deferred").length;
  return { open: open.length, waiting, doer, other: open.length - waiting - doer, declined: declined.length };
}
