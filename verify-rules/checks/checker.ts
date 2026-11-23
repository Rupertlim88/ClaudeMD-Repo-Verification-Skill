// The Claude checker: its fixed prompt, filled in for one step; and its answer, read by its form, captured in the run
// folder and recorded with the checker's own model id, which must be an explicit id other than the doer's.
import fs from "node:fs";
import path from "node:path";
import { append, capture } from "../run/record.ts";
import { readState, updateState, writeWhole, type RunPaths } from "../run/state.ts";

const PROMPT = new URL("./checker-prompt.md", import.meta.url);
const CHECKS = ["CORRECT", "SAME", "COMPLETE"] as const;
const ITEM_LINE = /^\s*(PASS|FAIL)\s*[—–-]+\s*(\S+)\s*[—–-]+\s*(\S.*)$/;
const CHECK_LINE = /^\s*(CORRECT|SAME|COMPLETE)\s*[:—–-]?\s*(PASS|FAIL)\s*$/;
const STEP_LINE = /^\s*STEP\s+(PASS|FAIL)\s*$/;

export function checkerPrompt(v: { skill: string; run: string; repo: string; step: string; round: number }): string {
  const values: Record<string, string> = { SKILL: v.skill, RUN: v.run, REPO: v.repo, STEP: v.step, ROUND: String(v.round) };
  return fs.readFileSync(PROMPT, "utf8").replace(/\{\{(\w+)\}\}/g, (_, name: string) => values[name]);
}

type Mark = "PASS" | "FAIL";
export interface ParsedAnswer {
  items: { verdict: Mark; item: string; evidence: string }[]; checks: Partial<Record<(typeof CHECKS)[number], Mark>>;
  stepLine: Mark | null; verdict: Mark; notes: string[];
}

// Each line is an item's verdict with its evidence, one of the three checks, the checker's step line, or a note. The
// step passes only when there is at least one item, no item failed, and all three checks passed.
export function parseAnswer(text: string): ParsedAnswer {
  const r: ParsedAnswer = { items: [], checks: {}, stepLine: null, verdict: "FAIL", notes: [] };
  for (const line of text.split("\n").filter((l) => l.trim() !== "" && !l.trim().startsWith("```"))) {
    const item = ITEM_LINE.exec(line);
    const check = CHECK_LINE.exec(line);
    const step = STEP_LINE.exec(line);
    if (item !== null) r.items.push({ verdict: item[1] as Mark, item: item[2], evidence: item[3].trim() });
    else if (check !== null) r.checks[check[1] as (typeof CHECKS)[number]] = check[2] as Mark;
    else if (step !== null) r.stepLine = step[1] as Mark;
    else r.notes.push(line.trim());
  }
  const passed = r.items.length > 0 && r.items.every((i) => i.verdict === "PASS") && CHECKS.every((c) => r.checks[c] === "PASS");
  r.verdict = passed ? "PASS" : "FAIL";
  return r;
}

// Saves the checker's whole answer as checkers/step-<step>-<n>.md and records it. A model named by an alias, or the
// doer's own model, is refused.
export function saveCheckerAnswer(p: RunPaths, step: string, model: string, text: string): ParsedAnswer & { file: string } {
  const doer = readState(p).doerModel;
  if (!/^claude-[a-z0-9.-]+$/.test(model)) throw new Error(`a checker's model must be an explicit Claude model id, not "${model}"`);
  if (doer === "" || model.startsWith(doer)) throw new Error(`the checker's model must differ from the doer's (${doer || "not recorded"})`);
  const parsed = parseAnswer(text);
  const n = updateState(p, (s) => ++s.spend.claudeRuns);
  const file = path.join("checkers", `step-${step}-${n}.md`);
  writeWhole(path.join(p.root, file), text);
  append(p, "checker", { step, model, verdict: parsed.verdict, stepLine: parsed.stepLine, checks: parsed.checks,
    fails: parsed.items.filter((i) => i.verdict === "FAIL").map((i) => i.item), passes: parsed.items.filter((i) => i.verdict === "PASS").length,
    output: capture(p, file) });
  return { ...parsed, file };
}
