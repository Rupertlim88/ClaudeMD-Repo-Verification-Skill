// The status file the user can read at any time: the step, what is being done, the items passed, the spend against
// each budget, the open items, what waits on the user and the record's hash; then the current step's items, where
// each long job writes its progress, and the events.
import { WAITING_ON_USER } from "./open-items.ts";
import { questions, type LoggedQuestion } from "./question-log.ts";
import { chainHead, checkedState } from "./record.ts";
import { isOneOf, ITEM_STATES, utcSeconds, writeWhole, type ItemState, type RunPaths, type RunState } from "./state.ts";

// A long job the run started, and the file it writes its progress lines to.
export interface Job { name: string; progressFile: string }

// What the gate says at the moment it writes the status file.
export interface Moment { now: Date; doing: string; unpaid: { checks: number; usd: number }; jobs: readonly Job[]; events: readonly string[] }

// Everything the status file shows: the moment, and what the run folder holds.
export interface StatusView extends Moment { state: RunState; questions: readonly LoggedQuestion[]; head: string }

const usd = (amount: number, decimals: number) => `$${amount.toFixed(decimals)}`;

function spendLine(s: RunState): string {
  const jev = usd(s.spend.jevUsd, 4);
  if (s.budgets === null) return `${jev} on Jev; ${s.spend.claudeRuns} Claude runs; no budgets set yet`;
  const hours = s.budgets.computeHours;
  const compute = hours === null ? "no compute budget" : `compute: at most ${hours} ${hours === 1 ? "hour" : "hours"} (Kaggle GPU or the repo's own unit)`;
  return `${jev} of ${usd(s.budgets.moneyUsd, 2)} on Jev; ${s.spend.claudeRuns} of ${s.budgets.claudeRuns} Claude runs; ${compute}`;
}

function openByCode(s: RunState): string {
  const counts = new Map<string, number>();
  for (const open of s.open) counts.set(open.code, (counts.get(open.code) ?? 0) + 1);
  return counts.size === 0 ? "none" : [...counts].map(([code, n]) => `${code} ${n}`).join(", ");
}

// Each question with no answer yet, then each open item whose code waits on the user.
function waitingOnYou(v: StatusView): string {
  const waiting = [
    ...v.questions.filter((q) => q.answer === null).map((q) => `question ${q.id} (${q.topic})`),
    ...v.state.open.filter((open) => WAITING_ON_USER.has(open.code)).map((open) => `item ${open.item}`),
  ];
  return waiting.length === 0 ? "nothing" : waiting.join(", ");
}

export function statusLines(v: StatusView): string[] {
  const s = v.state;
  for (const [id, item] of Object.entries(s.items)) {
    if (!isOneOf(ITEM_STATES, item.status)) throw new Error(`${id} has an item state that is not allowed: ${item.status}`);
  }
  // Item ids start with their step: "7.clause:R12#c3@models/lodestar".
  const stepItems: [string, ItemState][] =
    Object.entries(s.items).filter(([id]) => s.step !== null && id.startsWith(`${s.step}.`));
  const passed = stepItems.filter(([, item]) => item.status === "passed").length;
  return [
    "# verify-rules run status",
    "",
    `- step and round: ${s.step === null ? "not started" : `step ${s.step}, round ${s.round}`}`,
    `- now: ${v.doing}`,
    `- items passed: ${passed} of ${stepItems.length}${s.step === null ? "" : ` in step ${s.step}`}`,
    `- spend: ${spendLine(s)}`,
    `- checks still unpaid: ${v.unpaid.checks}, about ${usd(v.unpaid.usd, 4)}`,
    `- open items: ${openByCode(s)}`,
    `- updated: ${utcSeconds(v.now)}`,
    `- waiting on you: ${waitingOnYou(v)}`,
    // Printed on every update, so the user holds copies of the hash that a later rewrite of the record cannot change.
    // This protects only as far as someone compares them.
    `- record hash: ${v.head}`,
    "",
    `## Items${s.step === null ? "" : ` of step ${s.step}`}`,
    "",
    ...stepItems.map(([id, item]) => `- ${id}: ${item.status}`),
    "",
    "## Long jobs",
    "",
    ...(v.jobs.length === 0 ? ["- none"] : v.jobs.map((job) => `- ${job.name}: progress in ${job.progressFile}`)),
    "",
    "## Events",
    "",
    ...v.events.map((event) => `- ${event}`),
  ];
}

// Writes the status file whole, from the moment and from the run folder: the state as the gate checks it, the
// question log and the record's hash.
export function writeStatus(p: RunPaths, m: Moment): void {
  const v: StatusView = { ...m, state: checkedState(p), questions: questions(p), head: chainHead(p) };
  writeWhole(p.status, statusLines(v).join("\n") + "\n");
}
