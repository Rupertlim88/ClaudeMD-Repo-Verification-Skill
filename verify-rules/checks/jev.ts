// The Jev client: asks TypeSafe's Jev one fixed question about one state built by script, through the Vercel AI
// Gateway, with secrets stripped first. It saves the raw answer in the run folder, records it in the record with its
// hash, and reads Jev's p against the question's thresholds: pass, fail or unsure. An answer that TypeSafe did not
// serve cannot be used.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { addAnswer } from "../run/record.ts";
import { updateState, withLock, writeWhole, type RunPaths } from "../run/state.ts";

export interface Template {
  question: string; role: "may only fail" | "decides with the Claude checker" | "weak signal";
  pass: number | null; fail: number; state: string; source: string;
}

export const QUESTIONS: { model: string; provider: string; usdPerInputToken: number; templates: Record<string, Template> } =
  JSON.parse(fs.readFileSync(new URL("./questions.json", import.meta.url), "utf8"));

export type Verdict = "pass" | "fail" | "unsure" | "unusable";

// Below the fail line is a fail; at or above the pass line, a pass; anything else is unsure. A may-only-fail question
// has no pass line, so it is never a pass.
export function verdictOf(t: Template, p: number): Exclude<Verdict, "unusable"> {
  if (p < t.fail) return "fail";
  return t.pass !== null && p >= t.pass ? "pass" : "unsure";
}

export function fillQuestion(t: Template, values: Readonly<Record<string, string>>): string {
  return t.question.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (values[name] === undefined) throw new Error(`the question needs a value for {${name}}`);
    return values[name];
  });
}

const PATTERNS: { kind: string; pattern: RegExp; replace: string }[] = [
  { kind: "email", pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, replace: "<email>" },
  { kind: "key", pattern: /\b(?:KGAT_\w+|sk-[\w-]{16,}|ghp_\w{20,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16}|xox[abpr]-[\w-]+)/g, replace: "<key>" },
  // A quoted value given to a name about an account, a user, an owner or a secret: ACCOUNT = "name".
  { kind: "account setting", pattern: /\b(\w*(?:account|username|user|owner|token|secret|password|api_?key)\w*\s*[:=]\s*)(["'])[^"'\n]+\2/gi,
    replace: "$1$2<removed>$2" },
];

// The state with every email, key-shaped token, account setting and given account name replaced; and, for each, its
// kind and line, never its value.
export function stripSecrets(text: string, accountNames: readonly string[]): { text: string; removed: { kind: string; line: number }[] } {
  const removed: { kind: string; line: number }[] = [];
  const names = accountNames.filter((n) => n !== "").map((n) => ({
    kind: "account name", pattern: new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), replace: "<account>" }));
  for (const { kind, pattern, replace } of [...PATTERNS, ...names]) {
    text = text.replace(pattern, (...m) => {
      removed.push({ kind, line: text.slice(0, m.at(-2) as number).split("\n").length });
      return m[0].replace(new RegExp(pattern.source, pattern.flags.replace("g", "")), replace);
    });
  }
  return { text, removed };
}

// The account names a state must not carry, found by script: the owner in the repo's origin remote.
export function accountNames(repo: string): string[] {
  let url = "";
  try {
    url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return [];
  }
  const owner = /[:/]([^/:]+)\/[^/]+?\s*$/.exec(url.trim())?.[1];
  return owner === undefined ? [] : [owner];
}

// What the client reads from a decide call's result.
export interface DecideRaw {
  answers: Record<string, { type: string; probability?: number }>;
  usage?: { inputTokens?: number; outputTokens?: number };
  warnings?: unknown[];
  response?: { modelId?: string; headers?: Record<string, string> };
  providerMetadata?: { gateway?: { routing?: { finalProvider?: string }; cost?: string } } & Record<string, unknown>;
}
export type Decide = (a: { model: string; state: string; questions: { q: { type: "boolean"; instructions: string } } }) => Promise<DecideRaw>;

// The AI SDK's experimental_decide through the Vercel AI Gateway, which needs AI_GATEWAY_API_KEY.
const gatewayDecide: Decide = async (a) => {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is not set: set it to a Vercel AI Gateway key (in a cloud session whose proxy adds the key: " +
      "AI_GATEWAY_API_KEY=proxy-injected NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt)");
  }
  const { experimental_decide } = await import("ai");
  const r = await experimental_decide({ ...a, maxRetries: 2, abortSignal: AbortSignal.timeout(90_000) });
  return {
    answers: r.answers, usage: r.usage, warnings: r.warnings, response: { modelId: r.response.modelId, headers: r.response.headers },
    providerMetadata: r.providerMetadata as DecideRaw["providerMetadata"],
  };
};

export interface JevRequest { item: string; template: string; question: string; state: string }
export interface JevAnswer {
  n: number; p: number | null; verdict: Verdict; unusable: string | null; provider: string | null; model: string | null;
  requestId: string | null; inputTokens: number; usd: number; file: string;
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

// Sends one request, within the money budget, and records it: the raw answer in jev/<n>-<item>.json, an answer entry
// naming that file by its hash, the item's answer in the state, and the spend.
export async function askJev(p: RunPaths, req: JevRequest, opts: { decide?: Decide; accountNames: readonly string[] }): Promise<JevAnswer> {
  const t = QUESTIONS.templates[req.template];
  if (t === undefined) throw new Error(`there is no question template "${req.template}"`);
  const n = updateState(p, (s) => {
    if (s.budgets === null) throw new Error("no budgets are set: ask the user for them, then run `verify budget` (branches/budget.md)");
    if (s.spend.jevUsd >= s.budgets.moneyUsd) throw new Error(`the money budget of $${s.budgets.moneyUsd} is spent: stop and ask (branches/budget.md)`);
    return ++s.spend.jevCalls;
  });
  const { text: state, removed } = stripSecrets(req.state, opts.accountNames);
  if (removed.length > 0) {
    const log = path.join(p.jev, "stripped.jsonl");
    withLock(p, () => writeWhole(log, (fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "") +
      removed.map((r) => JSON.stringify({ n, item: req.item, ...r }) + "\n").join("")));
  }
  const started = Date.now();
  const raw = await (opts.decide ?? gatewayDecide)({ model: QUESTIONS.model, state, questions: { q: { type: "boolean", instructions: req.question } } });
  const seconds = (Date.now() - started) / 1000;

  const probability = raw.answers.q?.probability;
  const provider = raw.providerMetadata?.gateway?.routing?.finalProvider ?? null;
  const unusable = typeof probability !== "number" ? "the answer holds no probability"
    : provider !== QUESTIONS.provider ? `served by ${provider ?? "no recorded provider"}, not ${QUESTIONS.provider}` : null;
  const inputTokens = raw.usage?.inputTokens ?? 0;
  const cost = Number(raw.providerMetadata?.gateway?.cost);
  const usd = Number.isFinite(cost) ? cost : inputTokens * QUESTIONS.usdPerInputToken;
  const answer: JevAnswer = {
    n, p: typeof probability === "number" ? probability : null, verdict: unusable === null ? verdictOf(t, probability!) : "unusable",
    unusable, provider, model: raw.response?.modelId ?? null, requestId: raw.response?.headers?.["x-vercel-id"] ?? null, inputTokens, usd,
    file: path.join("jev", `${String(n).padStart(4, "0")}-${req.item.replace(/[^\w.:@~#-]/g, "_")}.json`),
  };
  writeWhole(path.join(p.root, answer.file), JSON.stringify({
    n, item: req.item, template: req.template, question: req.question, askedModel: QUESTIONS.model, state, stateSha256: sha256(state),
    seconds, answer: { ...answer, file: undefined }, response: raw,
  }, null, 2) + "\n");
  updateState(p, (s) => {
    s.items[req.item] ??= { status: "in progress", answers: [] };
    s.spend.jevInputTokens += inputTokens;
    s.spend.jevOutputTokens += raw.usage?.outputTokens ?? 0;
    s.spend.jevUsd += usd;
  });
  addAnswer(p, req.item, { check: req.template, by: `jev ${answer.model ?? QUESTIONS.model}`, verdict: answer.verdict }, answer.file);
  return answer;
}
