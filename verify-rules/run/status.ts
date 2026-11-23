// The status file the user can read at any time: the step, what is being done, the items passed, the spend
// against each budget, the open items and what waits on the user; then the current step's items and the events.
import { WAITING_ON_USER } from "./open-items.ts";
import { isOneOf, ITEM_STATES, utcSeconds, writeWhole, type ItemState, type RunPaths, type RunState } from "./state.ts";

const usd = (amount: number, decimals: number) => `$${amount.toFixed(decimals)}`;

function spendLine(s: RunState): string {
  const jev = usd(s.spend.jevUsd, 4);
  if (s.budgets === null) return `${jev} on Jev; ${s.spend.claudeRuns} Claude runs; no budgets set yet`;
  return `${jev} of ${usd(s.budgets.moneyUsd, 2)} on Jev; ${s.spend.claudeRuns} of ${s.budgets.claudeRuns} Claude runs`;
}

function openByCode(s: RunState): string {
  const counts = new Map<string, number>();
  for (const open of s.open) counts.set(open.code, (counts.get(open.code) ?? 0) + 1);
  return counts.size === 0 ? "none" : [...counts].map(([code, n]) => `${code} ${n}`).join(", ");
}

export function statusLines(s: RunState, now: Date, doing: string, unpaid: { checks: number; usd: number },
  events: string[]): string[] {
  for (const [id, item] of Object.entries(s.items)) {
    if (!isOneOf(ITEM_STATES, item.status)) throw new Error(`${id} has an item state that is not allowed: ${item.status}`);
  }
  // Item ids start with their step: "7.clause:R12#c3@models/lodestar".
  const stepItems: [string, ItemState][] =
    Object.entries(s.items).filter(([id]) => s.step !== null && id.startsWith(`${s.step}.`));
  const passed = stepItems.filter(([, item]) => item.status === "passed").length;
  const waiting = s.open.filter((open) => WAITING_ON_USER.has(open.code)).map((open) => open.item);
  return [
    "# verify-rules run status",
    "",
    `- step and round: ${s.step === null ? "not started" : `step ${s.step}, round ${s.round}`}`,
    `- now: ${doing}`,
    `- items passed: ${passed} of ${stepItems.length}${s.step === null ? "" : ` in step ${s.step}`}`,
    `- spend: ${spendLine(s)}`,
    `- checks still unpaid: ${unpaid.checks}, about ${usd(unpaid.usd, 4)}`,
    `- open items: ${openByCode(s)}`,
    `- updated: ${utcSeconds(now)}`,
    `- waiting on you: ${waiting.length === 0 ? "nothing" : waiting.join(", ")}`,
    "",
    `## Items${s.step === null ? "" : ` of step ${s.step}`}`,
    "",
    ...stepItems.map(([id, item]) => `- ${id}: ${item.status}`),
    "",
    "## Events",
    "",
    ...events.map((event) => `- ${event}`),
  ];
}

export function writeStatus(p: RunPaths, s: RunState, now: Date, doing: string, unpaid: { checks: number; usd: number },
  events: string[]): void {
  writeWhole(p.status, statusLines(s, now, doing, unpaid, events).join("\n") + "\n");
}
