// Open items and declined items. An item is put off only with a reason code whose evidence the script finds;
// otherwise it is refused, and the item's step fails. Declined items also live on as commit trailers.
import { execFileSync } from "node:child_process";
import type { LoggedQuestion } from "./question-log.ts";
import { isOneOf, REASON_CODES, type DeclinedItem, type OpenItem, type ReasonCode } from "./state.ts";

export class Refused extends Error {}

// The open items that wait on the user, as the status file and the report's first line count them.
export const WAITING_ON_USER: ReadonlySet<ReasonCode> = new Set(["user-unanswered", "needs-user-only-fact"]);

interface PutOffContext {
  questions: LoggedQuestion[]; shippedChecks: ReadonlySet<string>; check: string; questionId?: string; ownerEvidence?: string;
}

// Returns the evidence for putting the item off with this code, or refuses.
function evidenceFor(item: string, code: ReasonCode, ctx: PutOffContext): string {
  const refuse = (why: string) => new Refused(`${item} cannot be put off as ${code}: ${why}`);
  const loggedQuestion = () => {
    const q = ctx.questions.find((x) => x.id === ctx.questionId);
    if (q === undefined) throw refuse(`question ${ctx.questionId ?? "(none named)"} is not in the question log`);
    return q;
  };
  switch (code) {
    case "user-unanswered": {
      const q = loggedQuestion();
      if (q.answer !== null) throw refuse(`question ${q.id} has an answer`);
      return `question ${q.id}`;
    }
    case "needs-user-only-fact": {
      const q = loggedQuestion();
      if (q.kind !== "c") throw refuse(`question ${q.id} is not a request of kind c`);
      return `question ${q.id}`;
    }
    case "user-deferred":
    case "budget-refused":
    case "continued-by-user": {
      const q = loggedQuestion();
      if (q.answer === null) throw refuse(`question ${q.id} has no answer from the user`);
      return `question ${q.id}`;
    }
    case "other-owner":
      if (!ctx.ownerEvidence) throw refuse("no ownership note, branch or pull request is given");
      return ctx.ownerEvidence;
    case "later-version":
      if (ctx.shippedChecks.has(ctx.check)) throw refuse(`the check ${ctx.check} is in this version`);
      return `the check ${ctx.check} is not in this version`;
    case "doer-deferred":
      return "";
  }
}

export function setOpen(item: string, code: ReasonCode, ctx: PutOffContext): OpenItem {
  if (!isOneOf(REASON_CODES, code)) throw new Refused(`${item} cannot be put off: "${code}" is not a reason code`);
  return { item, code, evidence: evidenceFor(item, code, ctx), needsPutOffQuestion: code === "doer-deferred" };
}

export function declinedTrailer(d: DeclinedItem): string {
  return `Verify-Rules-Declined: ${d.line.replace(/\r?\n/g, " ")}`;
}

// Every Verify-Rules-Declined trailer on the branch, oldest commit first, so later runs can leave those items out.
export function readDeclinedTrailers(repoDir: string, branch: string): string[] {
  const log = execFileSync("git", ["log", "--reverse", "--format=%(trailers:key=Verify-Rules-Declined)", branch],
    { cwd: repoDir, encoding: "utf8" });
  return log.split("\n").filter((line) => line !== "");
}

export function firstLineCounts(open: OpenItem[], declined: DeclinedItem[]):
  { open: number; waiting: number; doer: number; other: number; declined: number } {
  const waiting = open.filter((o) => WAITING_ON_USER.has(o.code)).length;
  const doer = open.filter((o) => o.code === "doer-deferred").length;
  return { open: open.length, waiting, doer, other: open.length - waiting - doer, declined: declined.length };
}
