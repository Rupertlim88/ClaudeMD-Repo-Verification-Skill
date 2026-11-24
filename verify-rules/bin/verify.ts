// The one command-line entry of /verify-rules: `node <skill>/bin/verify.ts <command> …`. Each command prints what the
// doer needs and exits non-zero when what it checks fails. With --run, the output of rules, ties, clauses and items is
// also captured in the run folder and recorded, so that a Jev state or a checker can cite it.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkerPrompt, saveCheckerAnswer } from "../checks/checker.ts";
import { rulesOf, stateOf, stepState, tieItems, type TieItem } from "../checks/items.ts";
import { accountNames, askJev, QUESTIONS } from "../checks/jev.ts";
import { pythonLanguage } from "../code/python.ts";
import { clauseTable } from "../rules/clauses.ts";
import { readAll } from "../rules/rule-reader.ts";
import { brokenLines, DEFAULT_EXEMPT, exemptPerGroup, gitRepoView, tieCheck, type RepoView } from "../rules/tie-check.ts";
import { logQuestion, questions, recordAnswer } from "../run/question-log.ts";
import { append, capture, entries, type Captured } from "../run/record.ts";
import { createRun, isOneOf, openRun, readState, STEP_IDS, updateState, type RunPaths } from "../run/state.ts";
import { writeStatus } from "../run/status.ts";

const SKILL = path.resolve(import.meta.dirname, "..");
const SELF = path.join(SKILL, "bin", "verify.ts");

const USAGE = `usage: node ${SELF} <command> …
  start <repo> --doer <model id> [--base <folder>]   make the run folder and find the situation
  rules <repo> [--json] [--run <folder>]              the rule reader's result
  ties <repo> [--json] [--run <folder>]               the two-way tie check; exits 1 on a broken tie
  clauses <repo> [--rule "<bold sentence>"] [--json] [--run <folder>]   each rule's clauses and floor
  items <repo> [--folder <path>] [--json] [--run <folder>]   the four-part tie check's items and their jev commands
  worktree --run <folder>                             make the run's branch and worktree from the start commit
  capture --run <folder> --name <word> [--test] -- <command> …   run a command in the run's worktree (in the repo before it exists) and capture it; --test records it as a test command
  jev --run <folder> --item <id> --template <name> [--rule "<bold>"] [--file <path>] [--step <id>] [--evidence <file>]…
  status --run <folder>
  step --run <folder> --step <${STEP_IDS.join("|")}>
  budget --run <folder> --question <id> --usd <amount> --claude-runs <count> [--compute-hours <hours>]
  log-question --run <folder> --kind <a|b|c> --topic <topic> [--items <id,id>] [--recommendation <text>]   (text on stdin)
  log-answer --run <folder> --id <question id> [--message-id <id>]   (the answer on stdin, exactly as typed)
  checker-prompt --run <folder> --step <id>
  checker-answer --run <folder> --step <id> --model <model id>   (the checker's whole answer on stdin)
Every command that takes <repo> also takes --python <interpreter> (default: the repo's .venv, else python3).`;

class Usage extends Error {}

interface Args { positional: string[]; flags: Map<string, string[]>; json: boolean; test: boolean }

function parse(argv: string[]): Args {
  const a: Args = { positional: [], flags: new Map(), json: false, test: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") a.json = true;
    else if (argv[i] === "--test") a.test = true;
    else if (argv[i].startsWith("--")) {
      if (i + 1 >= argv.length) throw new Usage(`${argv[i]} needs a value`);
      a.flags.set(argv[i].slice(2), [...a.flags.get(argv[i].slice(2)) ?? [], argv[++i]]);
    } else a.positional.push(argv[i]);
  }
  return a;
}

const one = (a: Args, name: string) => a.flags.get(name)?.at(-1);
function need(a: Args, name: string): string {
  const value = one(a, name);
  if (value === undefined) throw new Usage(`--${name} is needed`);
  return value;
}
const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const shell = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : quote(s));
const stdin = () => fs.readFileSync(0, "utf8").replace(/\n$/, "");
const git = (repo: string, ...args: string[]) => {
  try {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

function languagesFor(repo: string, a: Args) {
  const venv = path.join(repo, ".venv", "bin", "python");
  const given = one(a, "python");
  return [pythonLanguage(given === undefined ? (fs.existsSync(venv) ? venv : "python3") : given.includes("/") ? path.resolve(given) : given)];
}

async function tieReport(repo: string, a: Args) {
  const languages = languagesFor(repo, a);
  const view = await gitRepoView(repo, languages);
  return { view, languages, report: tieCheck(view, DEFAULT_EXEMPT, languages) };
}

type Output = { text: string; code: number };

function tiesText(view: RepoView, report: Awaited<ReturnType<typeof tieReport>>["report"]): Output {
  const rules = new Map(rulesOf(view).map((rule) => [rule.key, rule]));
  const needed = report.notYetTied.rules.filter((r) => rules.get(r.key)?.fileLine?.kind === "needed");
  const unmarked = report.notYetTied.rules.filter((r) => rules.get(r.key)?.fileLine?.kind !== "needed");
  const lines = [
    ...brokenLines(report).map((line) => `BROKEN  ${line}`),
    ...needed.map((r) => `rule needing a file  ${r.claude}: ${r.bold}`),
    ...unmarked.map((r) => `rule not yet marked  ${r.claude}: ${r.bold}`),
    ...report.notYetTied.files.map((file) => `file not yet tied  ${file}`),
    ...report.cannotCarryHeading.map((file) => `cannot carry a heading  ${file}`),
    `${report.broken.length} broken ties; ${needed.length} rules needing a file, ${unmarked.length} rules not yet marked, ` +
      `${report.notYetTied.files.length} files not yet tied`,
    `(${report.ties.length} ties both ways, ${report.general.length} general rules; exempt: ` +
      `${Object.entries(exemptPerGroup(report)).filter(([, n]) => n > 0).map(([group, n]) => `${group} ${n}`).join(", ") || "none"})`,
  ];
  return { text: lines.join("\n"), code: report.broken.length > 0 ? 1 : 0 };
}

async function rulesCommand(repo: string, a: Args): Promise<Output> {
  const view = await gitRepoView(repo, []);
  const read = readAll(new Map(view.files.filter((f) => path.posix.basename(f) === "CLAUDE.md").map((f) => [f, view.read(f)])));
  if (a.json) return { text: JSON.stringify(Object.fromEntries(read), null, 2), code: 0 };
  const lines = [...read].flatMap(([claude, r]) => [
    `${claude}: ${r.rules.length} rules (${r.rules.filter((x) => x.bold !== null).length} named, ` +
      `${r.rules.filter((x) => x.bold === null).length} unnamed), ${r.rules.filter((x) => x.fileLine !== null).length} file lines; ` +
      `skipped: ${r.skipped.map((s) => `${s.kind} ${s.start}-${s.end}`).join(", ") || "nothing"}; ` +
      `${r.stray.length} stray lines, ${r.problems.length} problems`,
    ...r.stray.map((s) => `  stray line ${s.line}: ${s.text.trim()}`),
    ...r.problems.map((p) => `  problem line ${p.line}: ${p.problem}: ${p.text.trim()}`),
  ]);
  return { text: lines.join("\n"), code: 0 };
}

async function clausesCommand(repo: string, a: Args): Promise<Output> {
  const view = await gitRepoView(repo, []);
  const wanted = one(a, "rule");
  const rules = rulesOf(view).filter((r) => wanted === undefined || r.bold === wanted);
  if (rules.length === 0) throw new Error(`no rule has the bold sentence "${wanted}"`);
  const tables = rules.map((rule) => ({ rule, ...clauseTable(rule) }));
  const code = tables.some((t) => !t.check.ok) ? 1 : 0;
  if (a.json) return { text: JSON.stringify(tables.map((t) => ({ claude: t.rule.claude, bold: t.rule.bold, clauses: t.clauses, check: t.check })), null, 2), code };
  const lines = tables.flatMap(({ rule, clauses, check }) => [
    `${rule.claude}: ${rule.bold === null ? `(unnamed, line ${rule.startLine})` : `"${rule.bold}"`} ${check.clauses} clauses, ` +
      `floor ${check.floor}: ${check.ok ? "passes" : "FAILS"}`,
    ...clauses.map((c, k) => `  c${k + 1} [${c.start}-${c.end}] ${JSON.stringify(c.text)}`),
    ...check.problems.map((problem) => `  problem: ${problem}`),
  ]);
  return { text: lines.join("\n"), code };
}

const NOT_AUTOMATED = [
  "part 2: whether each clause is tested (a single mutation inside its lines makes a named test fail): the mutation runner has no command yet",
  "part 3: question 1 for each mapped piece, which needs the function-to-clause table, not built yet",
  "part 4: candidate rules found by key words outside the file's own CLAUDE.md, and the per-sentence follow-up",
];

function jevCommandOf(item: TieItem, a: Args): string {
  const run = one(a, "run");
  const python = one(a, "python");
  return `node ${shell(SELF)} jev --run ${run === undefined ? `"$RUN"` : quote(run)} --item ${quote(item.id)} --template ${item.template} ` +
    `--rule ${quote((item.candidate ?? item.rule).bold!)}${item.file === null ? "" : ` --file ${quote(item.file)}`}` +
    (python === undefined ? "" : ` --python ${quote(python.includes("/") ? path.resolve(python) : python)}`);
}

async function itemsCommand(repo: string, a: Args): Promise<Output> {
  const { view, report, languages } = await tieReport(repo, a);
  const { items } = tieItems(view, report, languages, one(a, "folder") ?? "");
  if (a.json) return { text: JSON.stringify(items.map((i) => ({ ...i, command: jevCommandOf(i, a) })), null, 2), code: 0 };
  const count = (part: TieItem["part"]) => items.filter((i) => i.part === part).length;
  const lines = [
    `The user's four-part check of the two-way ties (tools: tie-stage check), built by script from ${repo}, scope: ` +
      `${one(a, "folder") ?? "the whole repo"}.`,
    `${items.length} items: part 1 ${count("1")}, part 2 ${count("2")} clauses and ${count("2-list")} clause lists, part 3 ` +
      `${count("3")}, part 4 ${count("4")}. Ask Jev each item with its command, then give the step to the Claude checker.`,
    "Not automated yet, so the Claude checker judges them:",
    ...NOT_AUTOMATED.map((x) => `- ${x}`),
  ];
  let rule = "";
  for (const item of items) {
    if (item.rule.key !== rule) {
      rule = item.rule.key;
      lines.push("", `== ${item.file ?? "(no file tied)"}  <->  ${item.rule.claude}: "${item.rule.bold}"`,
        `   the rule's text: ${item.rule.claude}, lines ${item.rule.startLine}-${item.rule.endLine}` +
          (item.file === null ? "" : `; the file: ${item.file}`));
    }
    lines.push(`  [part ${item.part}] ${item.id}`, `    Q: ${item.question}`,
      `    the state holds: ${QUESTIONS.templates[item.template].holds}`, `    $ ${jevCommandOf(item, a)}`);
  }
  return { text: lines.join("\n"), code: 0 };
}

// Rewrites the status file, with the record's last entries as its events.
function refresh(p: RunPaths, doing: string): void {
  const events = entries(p).slice(-15).map((e) =>
    `${e.t} ${e.kind}${e.item === undefined ? "" : ` ${e.item}`}${e.verdict === undefined ? "" : `: ${e.verdict}`}`);
  writeStatus(p, { now: new Date(), doing, unpaid: { checks: 0, usd: 0 }, jobs: [], events });
}

function captured(p: RunPaths, name: string): { name: string; text: string } {
  const file = path.relative(p.root, path.resolve(p.root, name));
  const named = entries(p).map((e) => e.output as Captured | undefined).filter((o) => o?.file === file).map((o) => o!.sha256);
  if (!fs.existsSync(path.join(p.root, file)) || !named.includes(capture(p, file).sha256)) {
    throw new Error(`${name} was not captured by verify in this run folder (or it changed since): only captured outputs may be evidence`);
  }
  return { name: file, text: fs.readFileSync(path.join(p.root, file), "utf8") };
}

async function jevCommand(a: Args): Promise<Output> {
  const p = openRun(need(a, "run"));
  const repo = readState(p).repo;
  const id = need(a, "item");
  const template = QUESTIONS.templates[need(a, "template")];
  if (template === undefined) throw new Error(`there is no template "${one(a, "template")}": see checks/questions.json`);
  let question = template.question;
  let state: string;
  if (template.state === "step-check") {
    const evidence = (a.flags.get("evidence") ?? []).map((name) => captured(p, name));
    const view = await gitRepoView(repo, []);
    state = stepState(fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8"), need(a, "step"),
      { view, bold: one(a, "rule") ?? null, file: one(a, "file") ?? null }, evidence);
  } else {
    const { view, report, languages } = await tieReport(repo, a);
    const item = tieItems(view, report, languages, "").items.find((i) => i.id === id);
    if (item === undefined) throw new Error(`there is no item ${id}: run \`verify items\` and copy its command`);
    const rule = (item.candidate ?? item.rule).bold;
    if (item.template !== one(a, "template")) throw new Error(`item ${id} is asked with the template ${item.template}`);
    if (one(a, "rule") !== rule) throw new Error(`item ${id} is about the rule "${rule}", not "${one(a, "rule")}"`);
    if ((one(a, "file") ?? null) !== item.file) throw new Error(`item ${id} is about the file ${item.file ?? "(none)"}`);
    question = item.question;
    state = stateOf(item, view, report);
  }
  const answer = await askJev(p, { item: id, template: need(a, "template"), question, state }, { accountNames: accountNames(repo) });
  refresh(p, `Jev answered ${id}`);
  const s = readState(p);
  const lines = [
    `${id}  ${need(a, "template")}  p=${answer.p ?? "none"}  ${answer.verdict.toUpperCase()}  ` +
      `(pass at ${template.pass ?? "never: Jev may only fail this question"}, fail below ${template.fail})`,
    ...(answer.unusable === null ? [] : [`UNUSABLE: ${answer.unusable}: Jev cannot be used for this item (branches/checker-unusable.md)`]),
    `model ${answer.model}, provider ${answer.provider}, request ${answer.requestId}; ${answer.inputTokens} input tokens, $${answer.usd.toFixed(6)}`,
    `raw answer: ${path.join(p.root, answer.file)}; spend $${s.spend.jevUsd.toFixed(6)} of $${s.budgets?.moneyUsd} on ${s.spend.jevCalls} Jev calls`,
  ];
  return { text: lines.join("\n"), code: 0 };
}

async function start(repoArg: string, a: Args): Promise<Output> {
  const repo = fs.realpathSync(repoArg);
  const doer = need(a, "doer");
  const p = createRun(path.basename(repo), new Date(), one(a, "base") ?? path.join(os.homedir(), ".cache", "verify-rules", "runs"), repo);
  const { report } = await tieReport(repo, a);
  const claudes = report.exempt.filter((e) => e.group === "CLAUDE.md files").length;
  const untied = report.notYetTied.rules.length + report.notYetTied.files.length;
  const guess = claudes === 0 ? (report.counted.length === 0 ? "A" : "B") : report.broken.length === 0 && untied === 0 ? "D" : "C";
  const counts = { countedFiles: report.counted.length, claudeMd: claudes, broken: report.broken.length, notYetTied: untied };
  const startCommit = git(repo, "rev-parse", "HEAD");
  const branch = git(repo, "branch", "--show-current");
  updateState(p, (s) => {
    Object.assign(s, { startCommit, branch, doerModel: doer, situation: { guess, counts }, step: "0", round: 1,
      stepStartCommit: startCommit || null,
      baseline: startCommit, baselineHow: `the start commit, ${startCommit} (the head of ${branch || "a detached head"} when the run started)` });
  });
  append(p, "start", { repo, doer, situation: guess, counts });
  refresh(p, "step 0: the run is set up");
  const SITUATIONS = { A: "an empty or new repo", B: "code but no CLAUDE.md", C: "CLAUDE.md files present, with ties broken or missing",
    D: "CLAUDE.md files present, nothing broken and nothing not yet tied" };
  const v = `node ${shell(SELF)}`;
  const text = [
    `Run folder: ${p.root}`,
    `Situation: ${guess} (${SITUATIONS[guess]}), a first guess by script; step 1 confirms it.`,
    `Counts: ${counts.countedFiles} counted files, ${claudes} CLAUDE.md files, ${counts.broken} broken ties, ${untied} not yet tied.`,
    `Status file, which the user can read at any time: ${p.status}`,
    "",
    "Next (SKILL.md: How to run this version):",
    `  RUN=${quote(p.root)}`,
    "  1. Ask the user for the budgets (money for Jev, the number of Claude checker runs, and compute hours such as Kaggle",
    `     GPU hours, where the repo uses compute). Log the question, then ask it word for word:`,
    `     ${v} log-question --run "$RUN" --kind b --topic budgets <<'Q'`,
    "  2. Log the answer exactly as the user typed it, then set the budgets:",
    `     ${v} log-answer --run "$RUN" --id q1 <<'A'`,
    `     ${v} budget --run "$RUN" --question q1 --usd <amount> --claude-runs <count> --compute-hours <hours>`,
    `  3. ${v} rules ${shell(repo)} --run "$RUN"   and   ${v} ties ${shell(repo)} --run "$RUN"`,
    "  4. Check other people's work (branches/other-people.md), then make the run's worktree; every capture after it,",
    `     the test commands first, runs there: ${v} worktree --run "$RUN"`,
    ...(guess === "A" || guess === "B" ? ["  Then open branches/situation-a.md (A) or branches/interview.md (B)."] : []),
  ].join("\n");
  return { text, code: 0 };
}

// The next evidence file of a name, from the run folder: evidence/<name>-<n>.txt.
function nextEvidence(p: RunPaths, name: string): string {
  if (!/^[\w-]+$/.test(name)) throw new Usage(`--name must be one word, not "${name}"`);
  return path.join("evidence", `${name}-${fs.readdirSync(p.evidence).filter((f) => f.startsWith(`${name}-`)).length + 1}.txt`);
}

function record(p: RunPaths, file: string, command: string, exit: number): string {
  append(p, "output", { command, exit, output: capture(p, file) });
  refresh(p, `captured ${file}`);
  return `captured: ${file}`;
}

// Runs a command in the run's repo, printing its output as it comes and writing it to the evidence file as it goes;
// then records the file with the command's exit code, which it returns.
// With isTest, the command is also recorded in the state as one of the run's test commands.
// Makes the run's branch, verify-rules/run-<the run's start time>, and its worktree in the run folder, both from the
// start commit, and records them: every later capture runs there (branches/other-people.md).
function worktreeCommand(p: RunPaths): Output {
  const s = readState(p);
  if (s.worktree !== null) throw new Error(`the run already has its worktree, ${s.worktree}, on ${s.runBranch}`);
  const time = /(\d{8}T\d{6}Z)$/.exec(p.root)?.[1];
  if (time === undefined || s.startCommit === "") throw new Error("the run has no start time or start commit: run start first");
  const runBranch = `verify-rules/run-${time}`;
  execFileSync("git", ["worktree", "add", "-q", "-b", runBranch, p.worktree, s.startCommit], { cwd: s.repo, stdio: ["ignore", "ignore", "pipe"] });
  updateState(p, (x) => { x.worktree = p.worktree; x.runBranch = runBranch; });
  append(p, "worktree", { worktree: p.worktree, runBranch, from: s.startCommit });
  refresh(p, `worktree made on ${runBranch}`);
  return { text: `worktree: ${p.worktree}, on ${runBranch}, from the start commit ${s.startCommit}; every capture now runs there`, code: 0 };
}

async function captureCommand(p: RunPaths, name: string, command: string[], isTest: boolean): Promise<number> {
  if (command.length === 0) throw new Usage("capture needs the command after --");
  const s = readState(p);
  if (isTest && s.worktree === null)
    throw new Error("test commands run in the run's worktree (branches/test-commands.md): make it first with `verify worktree`");
  const cwd = s.worktree ?? s.repo;
  const file = nextEvidence(p, name);
  const fd = fs.openSync(path.join(p.root, file), "w");
  const write = (chunk: string) => { process.stdout.write(chunk); fs.writeSync(fd, chunk); };
  write(`$ ${command.map(shell).join(" ")}\nin: ${cwd}\n`);
  const exit = await new Promise<number>((resolve) => {
    const child = spawn(command[0], command.slice(1), { cwd });
    child.stdout.setEncoding("utf8").on("data", write);
    child.stderr.setEncoding("utf8").on("data", write);
    child.on("error", (e) => { write(`${e.message}\n`); resolve(127); });
    child.on("close", (code) => resolve(code ?? 1));
  });
  write(`exit ${exit}\n`);
  fs.closeSync(fd);
  if (isTest) updateState(p, (s) => { s.testCommands.push({ name, command: command.join(" "), exit, outputFile: file }); });
  console.log(record(p, file, command.join(" "), exit));
  return exit;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...all] = argv;
  const dash = all.indexOf("--");
  const rest = dash === -1 ? all : all.slice(0, dash);
  const a = parse(rest);
  const repo = () => {
    if (a.positional[0] === undefined) throw new Usage(`${command} needs <repo>`);
    return fs.realpathSync(a.positional[0]);
  };
  const run = () => openRun(need(a, "run"));
  let out: Output;
  switch (command) {
    case "start": out = await start(repo(), a); break;
    case "rules": out = await rulesCommand(repo(), a); break;
    case "ties": {
      const { view, report } = await tieReport(repo(), a);
      out = a.json ? { text: JSON.stringify(report, null, 2), code: report.broken.length > 0 ? 1 : 0 } : tiesText(view, report);
      break;
    }
    case "clauses": out = await clausesCommand(repo(), a); break;
    case "items": out = await itemsCommand(repo(), a); break;
    case "jev": out = await jevCommand(a); break;
    case "worktree": out = worktreeCommand(run()); break;
    case "capture": return captureCommand(run(), need(a, "name"), dash === -1 ? [] : all.slice(dash + 1), a.test);
    case "status": out = { text: fs.readFileSync(run().status, "utf8").trimEnd(), code: 0 }; break;
    case "step": {
      const p = run();
      const step = need(a, "step");
      if (!isOneOf(STEP_IDS, step)) throw new Usage(`--step must be one of ${STEP_IDS.join(", ")}`);
      const round = updateState(p, (s) => {
        s.round = s.step === step ? s.round + 1 : 1;
        s.step = step;
        s.stepStartCommit = git(s.repo, "rev-parse", "HEAD") || null;
        return s.round;
      });
      append(p, "step", { step, round });
      refresh(p, `step ${step}, round ${round}`);
      out = { text: `step ${step}, round ${round}`, code: 0 };
      break;
    }
    case "budget": {
      const p = run();
      const id = need(a, "question");
      const q = questions(p).find((x) => x.id === id);
      if (q?.answer == null) throw new Error(`question ${id} has no answer in the question log yet: the budgets come from the user's answer`);
      if (q.kind !== "b") throw new Error(`the budgets are a kind b question (branches/asking-the-user.md); ${id} is kind ${q.kind}: ask it again as kind b`);
      const hours = one(a, "compute-hours");
      const budgets = { moneyUsd: Number(need(a, "usd")), claudeRuns: Number(need(a, "claude-runs")),
        computeHours: hours === undefined ? null : Number(hours), questionId: id };
      if (!(budgets.moneyUsd >= 0) || !Number.isInteger(budgets.claudeRuns) || !(budgets.computeHours === null || budgets.computeHours >= 0))
        throw new Usage("--usd and --compute-hours must be amounts and --claude-runs a count");
      updateState(p, (s) => { s.budgets = budgets; });
      append(p, "budgets", budgets);
      refresh(p, "budgets set");
      const compute = budgets.computeHours === null ? "no compute" : `at most ${budgets.computeHours} compute hours`;
      out = { text: `budgets: $${budgets.moneyUsd} for Jev, ${budgets.claudeRuns} Claude checker runs, ${compute} (from ${id}: "${q.answer}")`, code: 0 };
      break;
    }
    case "log-question": {
      const p = run();
      const q = logQuestion(p, { kind: need(a, "kind") as "a", topic: need(a, "topic"), text: stdin(),
        recommendation: one(a, "recommendation") ?? null, items: (one(a, "items") ?? "").split(",").filter((x) => x !== "") });
      refresh(p, `waiting on the user: ${q.id}`);
      out = { text: `logged ${q.id}: ask it now, word for word; then log the answer exactly as typed:\n` +
        `node ${shell(SELF)} log-answer --run ${quote(p.root)} --id ${q.id} <<'A'`, code: 0 };
      break;
    }
    case "log-answer": {
      const p = run();
      const q = recordAnswer(p, need(a, "id"), stdin(), one(a, "message-id") ?? null, new Date());
      refresh(p, `the user answered ${q.id}`);
      out = { text: `logged the answer to ${q.id}`, code: 0 };
      break;
    }
    case "checker-prompt": {
      const p = run();
      const s = readState(p);
      out = { text: checkerPrompt({ skill: SKILL, run: p.root, repo: s.repo, step: need(a, "step"), round: s.round }), code: 0 };
      break;
    }
    case "checker-answer": {
      const p = run();
      const r = saveCheckerAnswer(p, need(a, "step"), need(a, "model"), stdin());
      refresh(p, `checker answered step ${need(a, "step")}`);
      const fails = r.items.filter((i) => i.verdict === "FAIL");
      out = { text: [`step ${need(a, "step")}: ${r.verdict} (the checker's own line: STEP ${r.stepLine ?? "missing"}); ` +
        `${r.items.length} item lines, ${fails.length} FAIL`, ...fails.map((f) => `FAIL  ${f.item}: ${f.evidence}`),
        `saved: ${path.join(p.root, r.file)}`].join("\n"), code: r.verdict === "PASS" ? 0 : 1 };
      break;
    }
    default:
      throw new Usage(command === undefined ? "a command is needed" : `there is no command "${command}"`);
  }
  const runFolder = one(a, "run");
  if (runFolder !== undefined && ["rules", "ties", "clauses", "items"].includes(command)) {
    const p = openRun(runFolder);
    const file = nextEvidence(p, command);
    fs.writeFileSync(path.join(p.root, file), out.text + "\n");
    out.text += `\n${record(p, file, [command, ...rest].join(" "), out.code)}`;
  }
  console.log(out.text);
  return out.code;
}

main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e: unknown) => {
  console.error(`verify: ${e instanceof Error ? e.message : String(e)}`);
  if (e instanceof Usage) console.error(USAGE);
  process.exitCode = 2;
});
