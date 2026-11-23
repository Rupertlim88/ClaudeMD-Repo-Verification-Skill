# verify-rules version 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build version 1 of the `/verify-rules` tools: one gate that owns every check, with the user's four-part rule ↔ file check, the three checks after every step, the two lists with the question log, and saving and resuming, so that a real run on a copy of senior-thesis-research's `models/lodestar` finds what the LodeSTAR test found, with no part of the exam written by the doer.

**Architecture:** TypeScript tools run directly by Node 22 (type stripping; no build step), one file per tool, in the folders of `docs/claude-md-proposal.md` §7.1. The doer drives one CLI, `checks/gate.ts`; the gate builds every item list, state and canary, sends Jev requests through the pinned Jev client, starts Claude checkers through one launcher, parses their answers, chains every verdict into the record, and writes the report's first line. The language-specific parts (headings, pieces, imports, mutations, test runs) sit behind one `Language` interface. Version 1 has one language, Python, whose adapter runs a standard-library-only helper under the target repo's own interpreter.

**Tech Stack:** Node 22.23 (`node:test`, type stripping, measured), TypeScript for type checks only, AI SDK `ai@7.0.179` (`experimental_decide`, measured in the LodeSTAR test) through the Vercel AI Gateway, the `claude` CLI 2.1.330, git, and the target repo's Python 3 `ast` and pytest.

**Spec:** `verify-rules/SKILL.md` (the core, the steps, the trigger table), `verify-rules/branches/*.md`, `docs/tools.md` (each tool's checks), `docs/claude-md-proposal.md` §7 (the structure). Every task's implementer reads SKILL.md's core first.

**This plan is temporary.** It is deleted when version 1 is done.

### How this plan cites the spec

- `tools: <Section> <n>` is the numbered check `n` as printed under that section of `docs/tools.md`. Where a section restarts its numbers under a sub-heading, the sub-heading is named: `tools: Gate job1.2` (under "1. It starts the checkers"), `tools: Tie-stage p3b.2` (under "Is everything in the file asked for by its rule?"), `tools: Tie-stage p4.12` (Part 4), `tools: Record 3` (under "3. It keeps the record").
- `SKILL: core n`, `SKILL: target n`, `SKILL: step n`, `SKILL: never "<words>"` and `SKILL: checkpoint` point into `verify-rules/SKILL.md`.
- `branch: <file>` is `verify-rules/branches/<file>`.

## Global Constraints

- Node 22.18 or later with type stripping on (measured: 22.23.5 runs `.ts` and `node --test` finds `*.test.ts`). Erasable TypeScript only: no `enum`, no `namespace`, no parameter properties. `npm run typecheck` (`tsc --noEmit`) passes.
- One dependency file: `verify-rules/package.json`, every version exact (`npm install --save-exact`), with its lockfile. The tools use nothing else but Node's standard library, git, the `claude` CLI, and the target repo's own interpreter and test runner. `code/python_ast.py` uses the Python standard library only and always runs with `-I`.
- Everything is built test-first with superpowers:test-driven-development: the failing test is seen failing, then the least code passes it. Tests live in `verify-rules/tests/`, mirroring the tool folders. Python adapter tests use `VR_TEST_PYTHON` (default `python3`; measured: 3.13.18 with pytest 9.1.1).
- The run folder is outside the repo being checked. Nothing a run makes enters that repo apart from empty checkpoint commits and their trailers on the run's own branch.
- Every state file is written whole: to `<path>.<process id>.partial`, flushed to disk, then renamed.
- Every read-modify-write of the run folder holds the run folder's lock (`withLock`, Task 1); `append` and `updateState` take it themselves, and a writer that changes two files (an answer in the record and the state) holds it around both. The lock is never held while a child process runs.
- The gate reads the state only through `checkedState` (Task 2) and the questions only through `questions` (Task 4), which check them against the record.
- The doer never writes a verdict, a probability, a checker's state, a checker's prompt, a Jev question, a mutation, a clause list, a coverage table, the record or the report's first line (SKILL: core 8; SKILL: never). Every tool's public functions take raw inputs (files, tables, transcripts), never verdict text.
- Questions are in positive form and one request is about one item (tools: State-builder 7, 8).
- Claude model ids are explicit and never aliases; a checker's model differs from the doer's (tools: Gate job1.2). The command line is `claude -p --model <id> --disable-slash-commands --strict-mcp-config --no-session-persistence --output-format json`, never `--bare` (tools: Launcher 10).
- Jev is called by a pinned version id (`typesafe-ai/jev-<version>`), never the alias (tools: Jev 7).
- Nothing secret leaves the machine: every state goes through the secret stripper. No email address, account name, key or token is written into a test fixture or a tracked file.
- States and packs never hold absolute paths; files are named from the repo root.
- Staging by path only; never `git add -A`, `git add .` or `git commit -a`.
- This plan creates and changes no CLAUDE.md.
- Text shown to the user uses plain words and short sentences (branch: asking-the-user.md).
- Every commit ends with the attribution lines of the session's system reminder.

## Review Focus

These are the inputs most likely to break a real run that no other task's tests would reach. Each one has its test in the task named.

1. **CLAUDE.md text with CRLF line ends, or bold sentences with `×`, `%`, `’`, dashes or a trailing colon.** The reader keeps every character, and headings compare byte for byte. Tests: Task 6 (`bold sentences keep every character`, `a CRLF file reads the same rules`), Task 10 (`a heading that differs by one character is broken`).
2. **Paths with spaces or accents.** Git lists them whole, and the tie check reads them. Test: Task 10 (`git lists names with spaces and accents whole`, ported).
3. **The gate process killed in the middle of a checkpoint.** The state stays readable, the round is void, and the next checkpoint is the next round with new canaries. Test: Task 26 (`a kill during the round leaves the state valid and the round void`).
4. **The gateway erroring, timing out, or serving Jev from a fallback provider.** The client retries 3 times, then the checker cannot be used: the run stops and asks, and never substitutes. Tests: Task 17 (`an answer from another provider is unusable`), Task 25 (`a checker that cannot be used stops the step`).
5. **A mutant that loops forever** (a flipped loop condition). The test run is stopped at its timeout and counts as an error, never as a kill. Test: Task 9 (`runTest stops a test that runs past its timeout`).

---

## What a version-1 run does

- It runs step 0, step 7, the tie stage (the four parts and their conditions, as step 12 runs them, on the ties that exist now; it writes none), step 8, step 9 (the lists are shown, the answers read and logged; nothing is written) and step 14 (the final check, the whole-process question, the shortcut audit and the report).
- It runs in situations C and D only. In A or B it stops and says so.
- It writes no CLAUDE.md, heading or file line. In the repo it makes only empty checkpoint commits on the run's branch, in the run's worktree.
- Every item whose check version 1 does not have yet is open with the reason code `later-version` (Task 5). So a version-1 run always ends "incomplete: <list>". The list names the steps and checks that are not in version 1.

## Reuse decisions

| Source (measured) | What it holds | Decision |
|---|---|---|
| `/home/user/senior-thesis-research/tests/claude_ties.py` (268 lines) and its 35 tests | The repo's hardened two-way tie check | **Ported** to `rules/tie-check.ts`: its behaviour and all 35 test cases, same names. **Extended** with the cases tools: Tie-check 17 asks for that it misses (it reads only the nearest CLAUDE.md for headings, does not flag stray lines, misses shared bold sentences with higher CLAUDE.md files). **Run as is** in the acceptance test as the repo's own check, and its broken list is compared with the skill's. |
| LodeSTAR test tools, `…/scratchpad/lodestar-test/tools/` (2,206 lines, Python) | | Mostly **rewritten in TypeScript**, keeping the logic that its tests and the run proved. Kept as **Python** only where Python's own parser is the point. Per file: |
| ↳ `rules.py` | rule reader | rewritten → `rules/rule-reader.ts` (copied opening by exact lines, file line ends a rule, stray lines, sub-rules kept) |
| ↳ `clauses.py` | first cut, floor, check | rewritten → `rules/clauses.ts`, with the fixes of LodeSTAR problem 11 (keyword phrases as one marker; list number stripped) |
| ↳ `pieces.py` `cut` | piece cutter | **kept in Python** → `code/python_ast.py facts`; `table` rewritten → `code/piece-table.ts` |
| ↳ `mutate.py` `generate`, `_scopes`, `run_test` | four operators, scopes, junit reading | **kept in Python** → `code/python_ast.py mutations` and `junit`, plus the fifth operator (swap string), the element each mutation changes, a compile filter, and "exception inside the mutated lines" (LodeSTAR problem 6); `copy_tree` rewritten → `code/mutate.ts` |
| ↳ `audit_mutations.py` | clause → mutation table | rewritten → `code/mutate.ts` (cap with element targeting, the six conditions, resumable) |
| ↳ `jev.py` (`Q`, `read`, `_one`, `ask`) | questions, reading, logging, provider check | rewritten → `checks/questions.ts` (questions), `checks/thresholds.ts` (reading), `checks/jev.ts` (sending). Its hard-coded account names are dropped; the stripper gets names by script (Task 15). |
| ↳ `jev_client.mjs` (15 lines) | the `experimental_decide` call, request id, routing | **kept** as the call inside `checks/jev.ts`, with the pinned model id |
| ↳ `builders.py` | state builders | rewritten → `checks/questions.ts`, **keeping each calibrated state's layout**, because the thresholds were measured on those layouts |
| ↳ `checker.py`, `run_checker.py` | Claude checker runs, model check, line parser | rewritten → `checks/claude-checker.ts` (ranking, flags, reported-model check, parser kept) |
| ↳ `second_checker.py`, `shortcut_audit.py`, `reviewers.py` | three prompts | rewritten → fixed prompts in `checks/claude-checker.ts`; the reviewer form is the one branch: step-agents.md now fixes |
| ↳ `pack.py` | evidence pack | rewritten → `checks/gate.ts`, copying sections from the instructions snapshot (Task 20) instead of line numbers of an old spec |
| ↳ `record.py` | record, state, question log, status | rewritten → `run/record.ts`, `run/state.ts`, `run/question-log.ts`, `run/status.ts`; the chain format is kept (SHA-256 of the previous hash plus the entry's sorted-key JSON) |
| ↳ `lister.py` | item lister for one folder | rewritten → `run/items.ts`, for the whole repo with no hard-coded paths |
| ↳ `lists.py` | the two lists | rewritten → `rules/lists.ts`; its script diff wording is kept |
| ↳ `budget.py`, `final.py` | estimate; summary and first line | rewritten → `run/budget.ts`, `run/report.ts`; the first line comes from item states, never typed (LodeSTAR problem 2) |
| ↳ `tie_script.py`, `gate_part2.py`, `gate_part34.py`, `gate_s0.py`, `gate_s1*.py`, `gate_s7.py` | the tie stage and checkpoints, with hard-coded rule ids, files and canaries | rewritten → `checks/tie-stage.ts` and `checks/gate.ts`; the hard-coded ids become item-lister output, the hand-made canaries become canary-builder output |
| ↳ `dups.py`, `step1.py`, `step1_table.py` | duplicates; step 1 | **not in version 1** (milestones L2 and L4) |
| ↳ `tests/test_tools.py` (5 tests) | | its cases are kept in Tasks 6, 7, 8 and 9 |
| `…/scratchpad/sim/jev.mjs` (the path given; the file is at `…/scratchpad/sim/jev/jev.mjs`) | Jev call through the deprecated `experimental_evaluate`, no provider or request id | **not reused**; the LodeSTAR test's `jev_client.mjs` replaced it |
| `…/scratchpad/stress-ties/calibration.json`, `jev-log.jsonl` (287 answers, each with id and label), `states/` (287) | the live test's calibration | imported into `checks/calibration/` (Task 16); the states and their faults are rebuilt with version 1's builders and re-sent on the pinned version (Task 34) |
| LodeSTAR run folder `jev/jev-log.jsonl` (273 answers, 14 canaries) | known-wrong items | the 14 canaries are added to the calibration set as known wrong (tools: Thresholds 6) |
| `…/scratchpad/stress-loopholes/reqs.json`, `reqs2.json` | 21 saved loophole-hunt states, answers only in tools.md's prose | J1 (whole-folder mark, 0.90) and J4/J4c/J4d (clause lists) are added as reported items, and re-sent in Task 34 |

## File structure

Every path is under `verify-rules/`. Files marked **new** are not in the proposal's tree (§7.1); see "Points that need the user's confirmation".

```
package.json, package-lock.json, tsconfig.json, .gitignore    tool settings
SKILL.md                                    gains a short "Running version 1" section (Task 33)
checks/
  gate.ts            the one CLI the doer uses; start, per-item checks, checkpoints, same proofs, probe mode
  tie-stage.ts       the four parts in the user's order, and their conditions
  jev.ts             the Jev client
  claude-checker.ts  the launcher: ranking table, flags, fixed prompts and answer forms, parsers
  questions.ts       the state-builder registry: fixed questions, state builders, fact builders, who must pass
  instructions.json  generated by questions.ts from SKILL.md, the branches and docs/tools.md (new; not counted)
  thresholds.ts      reading an answer; computing thresholds from the calibration set
  calibration/       folder of data: items.jsonl, thresholds.json, stress-ties-calibration.json
  canaries.ts        the canary builder
  secrets.ts         the secret stripper
rules/
  rule-reader.ts  clauses.ts  tie-check.ts  effect.ts  lists.ts
code/
  language.ts        the Language interface and the lookup by file type (new)
  python.ts          Python's adapter: the TypeScript side (new)
  python_ast.py      Python's adapter: the standard-library helper run under the repo's interpreter (new)
  pieces.ts  piece-table.ts  mutate.ts
run/
  state.ts  record.ts  status.ts  question-log.ts  conversation.ts  open-items.ts
  items.ts  situation.ts  budget.ts  report.ts
tests/
  helpers/  (tmp repos, fake claude, fake Jev)   one test file per tool   acceptance/
```

## Open values, and how each is set

| Value | Tool | Version-1 default | How it is set |
|---|---|---|---|
| Jev's pinned version | `jev.ts` | `typesafe-ai/jev-1.14.0`, provisional | **Measured** in Task 34: the calibration set is sent on 1.13.0 and 1.14.0 (≈ 574 calls, ≈ $0.05); the version with no false pass and the fewest unsure answers wins. Needs the user's go. |
| Pass and fail thresholds per question type | `thresholds.ts` | computed from `calibration/items.jsonl` (Task 16) | **Measured**: Task 16 from the existing data, again in Task 34 on version 1's own states |
| Mutation cap per clause | `mutate.ts` | 16 (the LodeSTAR run's setting) | **Measured** in Task 35 on the LodeSTAR copy: per clause, the rank of the first killing mutation in targeting order; the cap is the smallest that keeps every kill found at 64. Needs the user's go. |
| Per-test timeout | `mutate.ts` | 3 × the test's unbroken time, at least 60 s | **Measured** on each test's unbroken run (mechanical) |
| Ranking table of Claude models | `claude-checker.ts` | fable-5-2 = mythos-5-2 > fable-5-1 = mythos-5-1 > fable-5 > opus-5-5 > opus-5 > opus-4-8 > opus-4-7 > opus-4-6 > sonnet-5-5 > sonnet-5 > haiku-5-5, from the claude-api skill's model list (cached 2026-11-03) | **Listed for the user**: capability order is a judgment. Which models this account can run is **measured** by probe mode (Task 36). |
| Checker 1, second checker, shortcut audit | `claude-checker.ts` | claude-fable-5-2, claude-fable-5-1, claude-fable-5-2 | follow from the ranking; the only models ranked at or above the doer (claude-opus-5-5) are Fable and Mythos |
| Reviewer model (step 7) | `claude-checker.ts` | claude-sonnet-5-5 (what the LodeSTAR test used) | **Listed for the user**: reviewers only need a model other than the doer's; a cheaper one costs less, and the checkers judge their citations |
| Claude run timeout | `claude-checker.ts` | 1,800 s | **Measured** from the LodeSTAR test (76–336 s per run) |
| Evidence pack size limit | `gate.ts` | 600,000 characters | **Measured** from the LodeSTAR test (170k–255k per pack); a bigger pack is refused, with its sizes |
| Jev requests in parallel | `jev.ts` | 6 | **Measured**: 0 errors at 6 in the LodeSTAR test |
| Waits between a checker's 3 retries | `gate.ts` | 30, 60, 120 s | mechanical |
| Money cap; most Claude runs | `budget.ts` | none | **the user**, at step 0 (kind b) |
| Jev's price | `budget.ts` | read from the gateway's model list at the estimate | **measured** each run |
| Claude's list-price cost | `budget.ts` | the CLI's `total_cost_usd` per run | **measured** each run (recorded apart from the budgets) |
| Citation share refused | `piece-table.ts` | more than 0.30 of the file's non-blank lines | mechanical; tools.md says "about 30%" |
| "Two clauses cite the same lines" | `mutate.ts` | identical line sets | mechanical; see "Points that need the user's confirmation" |
| Canaries per checkpoint | `canaries.ts` | max(3, ceil(5% of the step's items)) | fixed by tools: Canary 2 |
| Rounds per step | `gate.ts` | 3, void rounds included | fixed by branch: step-fails.md |
| Clauses per reviewer | `gate.ts` | 40 | fixed by branch: step-agents.md |

---

## Tasks

Sizes: **S** up to about 150 lines of code and tests, **M** 150 to 400, **L** more than 400. Each task ends green: `cd verify-rules && npm test && npm run typecheck`.

### Task 1: Scaffold, the run folder and the state (M)

**Carries out:** tools: Run folder and state 1–3, 5–16 (16 with several writers at once, through the lock); SKILL: core 15; SKILL: step 0 (run folder first); branch: long-job-duties.md (saving as it goes).

**Files:**
- Create: `verify-rules/package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `run/state.ts`, `tests/helpers/tmp.ts`, `tests/run/state.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
// Every closed list is one `as const` array, and its type is derived from it.
export const STEP_IDS = ["0", "7", "tie", "8", "9", "14"] as const;          export type StepId = (typeof STEP_IDS)[number];
export const ITEM_STATES = ["not started", "in progress", "done", "passed", "failed", "reopened"] as const;
export type ItemStatus = (typeof ITEM_STATES)[number];
// in the same way: FINDING_LABELS, FINDING_KINDS, FINDING_GROUPS, SITUATIONS, STEP_RESULTS and REASON_CODES
export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T
export interface RunPaths { root: string; state: string; record: string; questions: string; status: string; lock: string;
  tables: string; jev: string; checkers: string; packs: string; evidence: string; worktree: string }
export interface Answer { check: string; by: string; verdict: string }
export interface ItemState { status: ItemStatus; answers: (Answer & { entry: string })[] }   // entry: the record entry's chain hash
export interface Finding { id: string; where: string; what: string; label: (typeof FINDING_LABELS)[number];
  kind: (typeof FINDING_KINDS)[number]; group: (typeof FINDING_GROUPS)[number] | null; source: string }
export interface RunState { repo: string; scope: string; startCommit: string; baseline: string; baselineHow: string;
  branch: string; doerModel: string; step: StepId | null; round: number; stepStartCommit: string | null;
  items: Record<string, ItemState>; testCommands: { name: string; command: string; exit: number; outputFile: string }[];
  knownFailures: string[]; budgets: { moneyUsd: number; claudeRuns: number; questionId: string } | null;
  spend: { jevCalls: number; jevInputTokens: number; jevOutputTokens: number; jevUsd: number; claudeRuns: number;
           claudeSeconds: number; claudeListUsd: number };
  open: OpenItem[]; declined: DeclinedItem[];
  agents: { id: string; folder: string; started: string; reported: boolean; note: string }[];
  mistakes: Record<string, number>; situation: { guess: (typeof SITUATIONS)[number]; counts: Record<string, number> } | null;
  steps: Partial<Record<StepId, { result: (typeof STEP_RESULTS)[number]; rounds: number }>> }
export interface RunView { paths: RunPaths; state: RunState; copyRoot: string; table<T>(name: string): T | null }
export type ReasonCode = (typeof REASON_CODES)[number];
export interface OpenItem { item: string; code: ReasonCode; evidence: string; needsPutOffQuestion: boolean }
export interface DeclinedItem { item: string; line: string; userWords: string; step: StepId; date: string }
export function createRun(repoName: string, startedAt: Date, base: string, repoRoot: string): RunPaths  // repoName: one folder name
export function openRun(root: string): RunPaths
export function utcSeconds(time: Date): string
export function within(folder: string, file: string): boolean
export function writeWhole(path: string, text: string): void
export function withLock<T>(p: RunPaths, work: () => T): T             // <root>/lock, made "wx", holding the pid; stale locks removed
export function readState(p: RunPaths): RunState                        // as written; the gate reads checkedState (Task 2)
export function updateState<T>(p: RunPaths, change: (s: RunState) => T): T   // read, change, write whole, under the lock
export function saveTable(p: RunPaths, name: string, value: unknown): void   // name: one file name
export function readTable<T>(p: RunPaths, name: string): T | null
```

- [ ] **Step 1: Write `package.json`** with `"type": "module"`, `"engines": {"node": ">=22.18"}`, scripts `"test": "node --test"`, `"typecheck": "tsc --noEmit"`; install with `npm install --save-exact ai@7.0.179 zod` and `npm install --save-exact --save-dev typescript @types/node@22`. `tsconfig.json`: `strict`, `noEmit`, `module`/`moduleResolution` `nodenext`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`. `.gitignore`: `node_modules/`. `tests/helpers/tmp.ts` exports `tmpDir(prefix): string` and `makeRepo(files: Record<string, string>): string` (git init, write, one commit).

- [ ] **Step 2: Write the failing tests** in `tests/run/state.test.ts`:
```ts
test("createRun names the folder after the repo and the start time, and makes every file", () => {
  const p = createRun("senior-thesis-research", new Date("2026-11-23T05:48:54Z"), tmpDir("runs"), makeRepo({ "a.py": "x = 1\n" }));
  assert.equal(path.basename(p.root), "senior-thesis-research-20261123T054854Z");
  for (const f of [p.state, p.record, p.questions, p.status]) assert.ok(fs.existsSync(f));
});
test("createRun refuses a run folder inside the repo", () => {
  const repo = makeRepo({ "a.py": "x\n" });
  assert.throws(() => createRun("r", new Date(), path.join(repo, "runs"), repo), /outside the repo/);
});
test("writeWhole puts a new file in place of the old one, never writing into the old one", () => {
  fs.writeFileSync(f, "old"); fs.linkSync(f, `${f}.before`); writeWhole(f, "new");
  assert.equal(fs.readFileSync(`${f}.before`, "utf8"), "old");
});
test("writers in four processes at once each put a whole file in place, and leave no partial file", async () => { … });
test("a lock whose process no longer runs is stale, and is removed", () => { … });
test("updateState then readState round-trips the state", () => { updateState(p, (old) => Object.assign(old, s)); assert.deepEqual(readState(p), s); });
test("four processes changing the state at once lose no change", async () => { … });
test("a table is saved whole under tables/ and read back; a missing table reads as null", () => {
  saveTable(p, "clauses-R1", { a: 1 }); assert.deepEqual(readTable(p, "clauses-R1"), { a: 1 });
  assert.equal(readTable(p, "nothing"), null);
});
```

- [ ] **Step 3: Run** `cd verify-rules && node --test tests/run/state.test.ts`. Expected: FAIL, `Cannot find module '../../run/state.ts'`.
- [ ] **Step 4: Implement `run/state.ts`.** `writeWhole` writes `<path>.<process id>.partial`, flushes it (`fs.fsyncSync`), then `fs.renameSync`. The repo check compares the final run folder's real path (`fs.realpathSync`). Tests with several writers at once start child processes through `tests/helpers/at-once.ts` and `tests/helpers/race.ts`.
- [ ] **Step 5: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `git add verify-rules/package.json verify-rules/package-lock.json verify-rules/tsconfig.json verify-rules/.gitignore verify-rules/run/state.ts verify-rules/tests/helpers/tmp.ts verify-rules/tests/run/state.test.ts` and `git commit -m "verify-rules: run folder and state, written whole"`.

### Task 2: The record as a chain of hashes (S)

**Carries out:** tools: Record 3.1–3.5 (3.3's check; failing the step on it is Tasks 24 and 32), 6–10 (the record's format and its checks; the gate writes the entries in Tasks 24–26 and 31); tools: Record 7 and Evidence 17 (answers and verdicts name their captured output by hash; finished in Tasks 25 and 26); SKILL: never "writes … the record"; branch: resume.md (chain against trailers).

**Files:** Create `run/record.ts`, `tests/run/record.test.ts`.

**Interfaces:**
- Consumes: `RunPaths`, `writeWhole` (Task 1).
- Produces:
```ts
export interface Captured { file: string; sha256: string }               // a file in the run folder, named from it
export type Entry = { kind: string; chain: string; [field: string]: unknown };
export function canonicalJson(v: unknown): string                       // keys sorted at every depth
export function capture(p: RunPaths, file: string): Captured
export function append(p: RunPaths, kind: string, fields: Record<string, unknown>, now?: Date): string
  // returns the new chain hash; holds the lock; refuses fields t, kind, chain; an "answer" or "verdict" must carry
  // output: Captured, still matching its file
export function addAnswer(p: RunPaths, item: string, a: Answer, outputFile: string, now?: Date): string
  // the answer entry and the state's answer naming it, under one lock
export function checkedState(p: RunPaths): RunState                     // refuses an answer no answer entry holds
export function entries(p: RunPaths): Entry[]                           // chain-checked; throws on a broken chain
export function chainHead(p: RunPaths): string                          // 64 zeros when empty
export type RecordCheck = { ok: true; head: string; entries: number } | { ok: false; problem: string };
export function verifyRecord(p: RunPaths, repoDir: string, branch: string): RecordCheck
  // the chain, then every captured output re-hashed, then this run's trailers on the branch
export function trailers(p: RunPaths, step: StepId, round: number): string[]
  // Verify-Rules-Run: <run folder name>, -Step, -Round, -Record: the head at that moment
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("each entry carries the SHA-256 of the previous hash and its own sorted JSON", () => {
  const h1 = append(p, "start", { a: 1 }, t0);
  const h2 = append(p, "verdict", { b: 2 }, t0);
  assert.equal(h2, sha256(h1 + canonicalJson({ t: "2026-11-23T05:48:54Z", kind: "verdict", b: 2 })));
});
test("verifyRecord names an edited entry by its line", () => { editLine(p.record, 2); assert.deepEqual(verifyRecord(p, repo, "main"), { ok: false, problem: "line 2 does not follow from the line before it" }); });
test("trailers name the run, the step, the round and the record's hash at that moment", () => { … });
test("verifyRecord passes when every trailer is a chain hash in order, and names a commit whose trailer is not", () => { … });
test("verifyRecord checks only this run's checkpoints, so an earlier run's in the branch's history does not fail it", () => { … });
test("verifyRecord fails a verdict whose captured file is changed or missing", () => { … });
test("checkedState refuses an answer typed into the state that no answer entry of the record holds", () => { … });
test("four processes appending at once lose no entry, and the chain verifies", async () => { … });
test("canonicalJson sorts keys at every depth", () => assert.equal(canonicalJson({ b: { d: 1, c: 2 }, a: 3 }), '{"a":3,"b":{"c":2,"d":1}}'));
```
- [ ] **Step 2: Run** `node --test tests/run/record.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `run/record.ts`.** The record is append-only JSON lines (`record.jsonl`), written whole; `verifyRecord` reads `git log --reverse <branch> --` and checks that each of this run's `Verify-Rules-Record:` values is a chain hash later than the previous one.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `run/record.ts` and its test: `"verify-rules: the record, a chain of hashes with checkpoint trailers"`.

### Task 3: The status file (S)

**Carries out:** tools: Status writer 1–3, 5, and 4's "Long jobs" section (the gate names its jobs from Task 24); tools: Budget 5; SKILL: core 15; branch: long-job-duties.md (live progress). The top lines also print the record's hash, so the user holds copies a rewrite cannot change (review N1: partial protection, as far as someone compares them).

**Files:** Create `run/status.ts`, `tests/run/status.test.ts`.

**Interfaces:**
- Consumes: `RunState`, `RunPaths` (Task 1); `checkedState`, `chainHead` (Task 2); `questions`, `LoggedQuestion` (Task 4); `WAITING_ON_USER` (Task 5).
- Produces:
```ts
export interface Job { name: string; progressFile: string }
export interface Moment { now: Date; doing: string; unpaid: { checks: number; usd: number }; jobs: readonly Job[]; events: readonly string[] }
export interface StatusView extends Moment { state: RunState; questions: readonly LoggedQuestion[]; head: string }
export function statusLines(v: StatusView): string[]
export function writeStatus(p: RunPaths, m: Moment): void   // reads checkedState, questions and chainHead from the run folder
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("the top lines, in order: step and round, now, items passed, spend, unpaid checks, open items by code, updated, waiting on you", () => {
  const l = statusLines(s, now, "mutation runner: clause 4 of 31", { checks: 120, usd: 0.01 }, []);
  assert.match(l[0], /^# verify-rules run status/);
  assert.deepEqual(l.slice(2, 10).map(x => x.split(":")[0]),
    ["- step and round", "- now", "- items passed", "- spend", "- checks still unpaid", "- open items", "- updated", "- waiting on you"]);
  assert.match(l[5], /\$0\.0042 of \$5\.00 on Jev; 3 of 20 Claude runs/);
});
test("then every item of the current step with its state, then one line per event", () => { … });
test("an item state outside the six allowed ones is refused", () => assert.throws(() => statusLines(bad, now, "", u, []), /item state/));
```
- [ ] **Step 2: Run** `node --test tests/run/status.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `run/status.ts`** (`writeStatus` calls `writeWhole`).
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `"verify-rules: the status file"`.

### Task 4: The question log (S)

**Carries out:** tools: Question log 1 (Question log 2 is Task 23's, and Question log 3 moved to Task 23); branch: asking-the-user.md (three kinds); branch: reading-approvals.md (logged at once, word for word).

**Files:** Create `run/question-log.ts`, `tests/run/question-log.test.ts`.

**Interfaces:**
- Produces:
```ts
export const MESSAGE_KINDS = ["a", "b", "c"] as const;  export type MessageKind = (typeof MESSAGE_KINDS)[number];
export interface LoggedQuestion { id: string; kind: MessageKind; topic: string; text: string; recommendation: string | null;
  items: string[]; askedAt: string; askedMessageId: string | null;
  answer: string | null; answerMessageId: string | null; answeredAt: string | null; idNote: string | null; report: string | null }
export function logQuestion(p: RunPaths, q: { kind: MessageKind; topic: string; text: string; recommendation: string | null;
  items: readonly string[] }, now?: Date): LoggedQuestion                 // items: the item ids the question covers
export function setAskedMessageId(p: RunPaths, id: string, messageId: string): LoggedQuestion   // set by the gate, once
export function recordAnswer(p: RunPaths, id: string, answer: string, messageId: string | null, at: Date): LoggedQuestion
export function recordReport(p: RunPaths, id: string, report: string): LoggedQuestion           // the chat report that followed
export function questions(p: RunPaths): LoggedQuestion[]
```
Every change is appended to the record as a `question` entry holding the question's new version, under the lock, and the log file is then written whole from the record. `questions` reads the record, and refuses a log file with a line the record never held.

- [ ] **Step 1: Write the failing tests:**
```ts
test("a question is written the moment it is logged, with its kind, exact text, recommendation and the items it covers", () => {
  const q = logQuestion(p, { kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: "$5", items: [] });
  assert.deepEqual(questions(p).map(x => x.text), ["What may this run spend?"]);
});
test("an answer is recorded word for word with its message id and time, once", () => {
  recordAnswer(p, q.id, "  $5 and 20 Claude runs ", "uuid-1", t);
  assert.equal(questions(p)[0].answer, "  $5 and 20 Claude runs ");
  assert.throws(() => recordAnswer(p, q.id, "again", "uuid-2", t), /already has its answer/);
});
test("with no readable message id, the time is kept and the entry says the id could not be read", () => {
  assert.equal(recordAnswer(p, q.id, "ok", null, t).idNote, "the message id could not be read");
});
test("a message of no kind is refused", () => assert.throws(() => logQuestion(p, { kind: "d" as never, topic: "", text: "", recommendation: null, items: [] })));
test("the gate sets the id of the message the question was sent in, once; the chat report that followed is kept, once", () => { … });
test("every change to a question is chained into the record as the question's new version", () => { … });
test("a question log edited by hand is refused, and nothing more is written over it", () => { … });
```
- [ ] **Step 2: Run** and see it fail. **Step 3: Implement** (each change chained into the record; the log file rewritten whole from it). **Step 4: Run** `npm test && npm run typecheck`: PASS. **Step 5: Commit**: `"verify-rules: the question log"`.

### Task 5: Open items, declined items and their trailers (S)

**Carries out:** tools: Open items 1 (the code table); tools: End-of-run report 1 (the counts); branch: open-items.md; SKILL: "How a run ends".

**Files:** Create `run/open-items.ts`, `tests/run/open-items.test.ts`.

**Interfaces:**
- Consumes: `ReasonCode`, `REASON_CODES`, `OpenItem`, `DeclinedItem`, `StepId`, `readState` (Task 1); `questions`, `LoggedQuestion` (Task 4).
- Produces:
```ts
export class Refused extends Error {}
export const WAITING_ON_USER: ReadonlySet<ReasonCode>;
export const CONTINUE_SENTENCE = "If you continue, this step stays unchecked.";
export type Checks = Readonly<Record<string, "shipped" | "later">>;          // every check, by the item-id prefix it checks
export type PutOff =
  | { code: "user-unanswered" | "user-deferred" | "needs-user-only-fact" | "budget-refused" | "continued-by-user"; question: string }
  | { code: "other-owner"; owner: string }                                  // a git ref, or a file inside the repo
  | { code: "later-version"; checks: Checks }
  | { code: "doer-deferred" };
export function checkOf(item: string): string                               // the id up to its first colon: "7.clause"
export function setOpen(p: RunPaths, item: string, putOff: PutOff): OpenItem  // reads the question log and the repo itself
export function declinedTrailer(d: DeclinedItem): string                      // "Verify-Rules-Declined: <line>", CR and LF folded
export function readDeclinedTrailers(repoDir: string, branch: string): string[]   // the trailers' values, oldest first
export function firstLineCounts(open: OpenItem[], declined: DeclinedItem[]): { open: number; waiting: number; doer: number; other: number; declined: number }
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("user-unanswered needs a question in the log that names the item, was seen sent, and has no answer", () => { … });
test("one question cannot put off items it does not name", () => { … });
test("budget-refused needs the user's answer to a question of kind b, never a list's approval", () => { … });
test("continued-by-user needs the user's answer to the script's continue question, of kind b", () => { … });
test("other-owner needs a git ref or a file in the repo that exists", () => { … });
test("later-version takes the check from the item's id, and needs it to be a check of a later version", () => { … });
test("a code outside the fixed list is refused", () => { … });
test("doer-deferred needs no evidence, and is marked for the put-off question", () =>
  assert.equal(setOpen(p, "8.finding:f2", { code: "doer-deferred" }).needsPutOffQuestion, true));
test("a declined item's trailer is one line, whatever its line ends", () =>
  assert.equal(declinedTrailer(d("C3. Keep the mark\r\nsecond\rthird\nfourth")), "Verify-Rules-Declined: C3. Keep the mark second third fourth"));
test("readDeclinedTrailers reads every declined item from the branch's commit messages", () => { … });
test("first-line counts: waiting = user-unanswered and needs-user-only-fact; doer = doer-deferred; other = the rest", () =>
  assert.deepEqual(firstLineCounts(mix, [d1]), { open: 5, waiting: 2, doer: 1, other: 2, declined: 1 }));
```
- [ ] **Step 2–5:** run (fail), implement, run `npm test && npm run typecheck` (pass), commit: `"verify-rules: open and declined items with checked reason codes"`.

### Task 6: The rule reader (M)

**Carries out:** tools: Rule reader 1–10; tools: Tie-check 17 ("reading CLAUDE.md files"); SKILL: target 6 (the reading part).

**Files:** Create `rules/rule-reader.ts`, `tests/rules/rule-reader.test.ts`.

**Interfaces:**
- Produces:
```ts
export type FileLine = { kind: "path"; path: string; line: number } | { kind: "whole-folder"; line: number } | { kind: "needed"; line: number };
export interface Rule { claude: string; key: string; bold: string | null; number: number | null; indent: number;
  startLine: number; endLine: number; text: string; fileLine: FileLine | null; category: string | null;
  subrules: { bold: string | null; line: number }[] }
export interface RuleRef { claude: string; bold: string | null; key: string }
export interface ReadResult { rules: Rule[]; skipped: { kind: "copied opening" | "system rules block"; start: number; end: number }[];
  stray: { line: number; text: string }[]; problems: { line: number; text: string; problem: string }[] }
export function copiedOpening(globalText: string): string[]          // the exact lines
export function readClaudeMd(path: string, text: string, globalText: string): ReadResult
export function readAll(files: ReadonlyMap<string, string>): Map<string, ReadResult>   // every CLAUDE.md, keyed by path
export function ruleKey(claude: string, bold: string | null, text: string): string    // `${claude}::${bold}` or `${claude}::unnamed::${sha256(text).slice(0,12)}`
```

- [ ] **Step 1: Write the failing tests** (fixtures are made-up CLAUDE.md texts shaped like the thesis repo's, never copies of it):
```ts
test("reads numbered rules and top-level bold bullets, with bold sentence, number, span, category and file line", () => {
  const r = readClaudeMd("x/CLAUDE.md", LOWER, GLOBAL).rules;
  assert.deepEqual(r.map(x => x.bold), ["A rule with sub-rules.", "Second rule.", null]);
  assert.deepEqual([r[0].startLine, r[0].endLine, r[0].fileLine], [14, 16, { kind: "path", path: "a.py", line: 17 }]);
  assert.ok(!r[0].text.includes("*File:*"));
});
test("an item with no bold sentence is read as unnamed, never skipped", () => assert.equal(rules.at(-1)!.bold, null));
test("the copied opening is skipped by its exact lines; a later section whose heading starts like the opening's is still read", () => { … });
test("a '## System Rules' section is one skipped unit", () => assert.deepEqual(res.skipped.map(s => s.kind), ["copied opening", "system rules block"]));
test("a rule's text keeps its indented lines, fenced blocks, tables and tags whole, and ends at the next rule, heading or file line", () => { … });
test("a sub-rule, with or without a bold sentence, is part of its parent's text and listed in subrules", () =>
  assert.deepEqual(r[0].subrules.map(s => s.bold), ["A sub-rule.", null]));
test("bold sentences keep every character exactly", () =>
  assert.equal(readClaudeMd("x/CLAUDE.md", "## A\n\n- **Size is 64 × 64 px, 4 %: it’s fixed —**\n", GLOBAL).rules[0].bold, "Size is 64 × 64 px, 4 %: it’s fixed —"));
test("a CRLF file reads the same rules as its LF copy", () => assert.deepEqual(read(LOWER.replace(/\n/g, "\r\n")), read(LOWER)));
test("non-blank lines outside a heading, the opening, the block, a rule and a file line are stray, with their lines", () =>
  assert.deepEqual(res.stray, [{ line: 10, text: "Stray scope line." }]));
test("a file line not directly under its rule, and a second file line, are problems", () => { … });
test("two rules with the same number in different files are both read: no rule is found by its number", () => { … });
```
- [ ] **Step 2: Run** `node --test tests/rules/rule-reader.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `rules/rule-reader.ts`.** Port `rules.py`'s line loop. Normalise `\r\n` to `\n` before reading. The copied opening is the global CLAUDE.md's "What the CLAUDE.md files are" section and its rule never to change a CLAUDE.md, matched by exact lines (`claude_ties.py`'s heading regex is not used: tools: Rule reader 7).
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `"verify-rules: the rule reader"`.

### Task 7: Clause tables (M)

**Carries out:** tools: Clause-table def, 1–3; tools: Rule reader 3; tools: Coverage tables 1 (table 1); SKILL: core 5; branch: clause-audit.md (first cut; reviewers cut further, never join).

**Files:** Create `rules/clauses.ts`, `tests/rules/clauses.test.ts`.

**Interfaces:**
- Consumes: `Rule` (Task 6).
- Produces:
```ts
export const KEYWORDS: readonly string[];  // never only always "at most" "at least" before after each every if unless when until
export interface Clause { id: string; rule: string; start: number; end: number; text: string }   // id `${ruleKey}#c${n}`
export interface ClauseCheck { ok: boolean; clauses: number; floor: number; problems: string[] }
export function sentences(text: string): [number, number][]
export function firstCut(text: string): [number, number][]
export function floor(text: string): number
export function checkClauses(text: string, spans: readonly [number, number][]): ClauseCheck
export function clauseTable(rule: Rule, furtherCuts?: readonly number[]): { clauses: Clause[]; check: ClauseCheck }
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("sentence boundaries skip 'e.g.', 'et al.' and the point in '0.96'", () =>
  assert.equal(sentences("Use a cut, e.g. 0.96 of it. Next one.").length, 2));
test("each number and each keyword gets its own clause", () => {
  const t = "It uses 5,000 steps, 8 copies of each crop per step, and a rate of 0.001.";
  assert.deepEqual(firstCut(t).map(([s, e]) => (t.slice(s, e).match(/\d[\d,.]*/g) ?? []).length), [1, 1, 1]);
});
test("a keyword phrase is one marker: 'only after' is never split", () => {
  const t = "LodeSTAR is trained first and then frozen; only after that is the readout trained.";
  assert.ok(firstCut(t).every(([s, e]) => !/only$/.test(t.slice(s, e).trim())));
});
test("the rule's own list number is stripped before the cut", () =>
  assert.ok(firstCut("8. **X.** It is one.").every(([s, e]) => "8. **X.** It is one.".slice(s, e).trim() !== "8.")));
test("the floor is, per sentence, the larger of 1, its numbers and its keywords", () => assert.equal(floor("It uses 5 steps and 8 copies. Never stop."), 3));
test("checkClauses fails two numbers in one clause, a list below the floor, a word in no clause and a span outside the text", () => {
  const t = "It uses 5 steps and 8 copies. Never stop.";
  assert.ok(!checkClauses(t, [[0, t.length]]).ok); assert.ok(!checkClauses(t, [[0, 13]]).ok); assert.ok(!checkClauses(t, [[0, 999]]).ok);
});
test("eight clauses merged into four fail the floor (the loophole hunt's list)", () => { … });
test("a further cut inside a clause is kept; the cut never joins two clauses", () => { … });
test("bold markers and the file line need no clause", () => assert.ok(clauseTable(ruleWithFileLine).check.ok));
```
- [ ] **Step 2–5:** run (fail), implement by porting `clauses.py` with the phrase and list-number fixes, run (pass), commit: `"verify-rules: clause tables with their floor"`.

### Task 8: The language interface, and Python's static facts (L)

**Carries out:** tools: Tie-check 5, 15 and 17 ("headings"); tools: Exempt-list 1, 4 (tests and empty-package content rules), 6–8 (what the import and call test reads); tools: Piece cutter 1; tools: Root 8 ("the heading reader and the piece cutter work per file type").

**Files:** Create `code/language.ts`, `code/python.ts`, `code/python_ast.py`, `tests/code/python-facts.test.ts`.

**Interfaces:**
- Produces:
```ts
export interface Piece { id: string; kind: "heading" | "import" | "function" | "class" | "method" | "statement" | "branch" | "block";
  name: string; start: number; end: number }
export interface Reference { kind: "import" | "dynamic import" | "module runner" | "exec" | "subprocess" | "import path"; target: string; line: number }
export interface FileFacts { parses: boolean; heading: string | null; pieces: Piece[] | null; references: Reference[];
  writes: Record<string, string[]>; names: Record<string, string[]>; definesTest: boolean; emptyPackage: boolean }
export interface Language { readonly name: string; readonly extensions: readonly string[];
  facts(files: { path: string; text: string }[]): Map<string, FileFacts> }      // Task 9 adds five methods
export function languageFor(path: string, languages: readonly Language[]): Language | null
export function blankLineBlocks(text: string): Piece[]          // the cut for a file no language parses
// code/python.ts
export function pythonLanguage(interpreter: string): Language
```
`code/python_ast.py` reads one JSON command on stdin and writes JSON: `facts`, `mutations`, `assertions`, `reads_source`, `junit`. Task 8 builds `facts`; Task 9 the rest.

- [ ] **Step 1: Write the failing tests** (`const py = pythonLanguage(process.env.VR_TEST_PYTHON ?? "python3")`):
```ts
test("the heading is the first text line of the module docstring, after a shebang and an encoding line", () =>
  assert.equal(facts('#!/usr/bin/env python\n# -*- coding: utf-8 -*-\n"""How LodeSTAR\'s outline is made.\n\nMore.\n"""\n').heading, "How LodeSTAR's outline is made."));
test("a docstring whose first line is empty gives its first text line", () => assert.equal(facts('"""\nThe heading.\n"""\n').heading, "The heading."));
test("no docstring gives no heading; a file that does not parse has parses false and pieces null", () => {
  assert.equal(facts("x = 1\n").heading, null); assert.deepEqual([facts("def (:\n").parses, facts("def (:\n").pieces], [false, null]);
});
test("pieces: heading, imports, functions, classes, methods, top-level statements and branches, with line spans", () => {
  const kinds = facts(SRC).pieces!.map(p => [p.kind, p.name, p.start, p.end]);
  for (const k of [["heading", "module docstring", 1, 1], ["import", "import os", 2, 2], ["function", "f", 6, 9],
                   ["branch", "f: if (body)", 7, 8], ["class", "C", 12, 14], ["method", "C.m", 13, 14]]) assert.deepContainEqual(kinds, k);
});
test("references: import, relative from-import read from the file's folder, importlib.import_module, __import__, '-m x' in a subprocess call, exec, sys.path", () =>
  assert.deepEqual(facts(REFS, "pkg/sub/a.py").references.map(r => [r.kind, r.target]), [["import", "os"], ["import", "pkg.sub.b.f"],
    ["dynamic import", "tests.helper"], ["dynamic import", "x.y"], ["module runner", "tools.run"], ["exec", "tests/helper.py"], ["import path", "tests"]]));
test("writes lists each piece's lines that write a file", () => assert.deepEqual(facts(W).writes["P3"], ["    torch.save(state, temporary)", "    os.replace(temporary, path)"]));
test("definesTest and emptyPackage follow the content rules", () => {
  assert.equal(facts("class TestB:\n    def test_b(self):\n        pass\n", "test_m.py").definesTest, true);
  assert.equal(facts('"""Doc."""\nfrom .a import b\n__all__ = ["b"]\n', "p/__init__.py").emptyPackage, true);
  assert.equal(facts('"""Doc."""\ndef f():\n    return 1\n"""Doc."""\n', "p/__init__.py").emptyPackage, false);
});
test("one helper call analyses many files", () => assert.equal(py.facts(hundredFiles).size, 100));
test("the helper runs isolated: a json.py planted in the working folder is not imported", () => { … });
test("languageFor picks Python for .py and nothing for .json", () => { … });
test("blankLineBlocks cuts a file into the blocks between blank lines", () => { … });
```
- [ ] **Step 2: Run** `node --test tests/code/python-facts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `python.ts` runs `spawnSync(interpreter, ["-I", helperPath, "facts"], { input })` once per batch, with `cwd` set to a temporary folder. In `python_ast.py`, port `pieces.py`'s `cut` (the docstring piece gets kind `heading`), `claude_ties.py`'s `defines_a_test`, `empty_package` (widened to names it passes on) and `imports`, and add the dynamic references and the write search of `builders.py` (`WRITES`).
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `"verify-rules: the language interface and Python's static facts"`.

### Task 9: Python mutations and test runs (L)

**Carries out:** tools: Mutation runner 1 (the five operators, assertion or exception inside the lines, the unbroken pass, reads no source), 4, 8; tools: Exempt-list 4 (tests group: collected tests); tools: Gate 8 (assertions per test, for the diff); LodeSTAR problem 6.

**Files:** Modify `code/language.ts`, `code/python.ts`, `code/python_ast.py`. Create `tests/code/python-tests.test.ts`, `tests/helpers/toy-python.ts` (a toy repo: `pkg/f.py`, `tests/test_f.py`, `pytest.ini`).

**Interfaces:**
- Consumes: `Language`, `Piece` (Task 8).
- Produces, in `code/language.ts`:
```ts
export type MutationOp = "flip comparison" | "move literal" | "delete statement" | "swap name" | "swap string";
export interface Mutation { op: MutationOp; line: number; what: string; element: string; source: string; diff: string; diffHash: string }
export type TestOutcome = { kind: "pass"; seconds: number } | { kind: "assertion"; message: string; seconds: number }
  | { kind: "exception-in-lines"; exception: string; file: string; line: number; seconds: number }
  | { kind: "error"; detail: string; seconds: number };
export interface RunTestOptions { timeoutMs: number; mutatedFile?: string; mutatedLines?: ReadonlySet<number> }
// Language gains:
  mutations(path: string, text: string, lines: ReadonlySet<number>): Mutation[];
  assertions(path: string, text: string): Map<string, string[]>;
  collectTests(root: string, paths: string[]): Promise<Map<string, string[]>>;
  runTest(root: string, testId: string, opts: RunTestOptions): Promise<TestOutcome>;
  testReadsSource(path: string, text: string, testName: string): boolean;
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("mutations come only from the five operators, inside the given lines, one change each", () => {
  const ms = py.mutations("f.py", "def f(a, b):\n    if a > 0.5:\n        return b\n    return 'x' + 'y'\n", new Set([2, 3, 4]));
  assert.deepEqual(new Set(ms.map(m => m.op)), new Set(["flip comparison", "move literal", "delete statement", "swap name", "swap string"]));
  assert.ok(ms.every(m => [2, 3, 4].includes(m.line)));
  assert.equal(ms.find(m => m.op === "flip comparison")!.source.split("\n")[1], "    if a >= 0.5:");
});
test("every mutation names the element it changes", () => assert.deepEqual(byOp(ms), { "flip comparison": ">", "move literal": "0.5", "swap string": "'x'" }));
test("a mutation that does not compile is never returned", () => assert.ok(ms.every(m => compiles(m.source))));
test("diffHash is the SHA-256 of the unified diff", () => assert.equal(ms[0].diffHash, sha256(ms[0].diff)));
test("runTest: pass, assertion, exception inside the mutated lines, and error for an import error or an exception elsewhere", async () => {
  assert.equal((await py.runTest(toy, "tests/test_f.py::test_ok", { timeoutMs: 60_000 })).kind, "pass");
  assert.equal((await py.runTest(mutantAssert, id, o)).kind, "assertion");
  assert.deepEqual(pick(await py.runTest(mutantIndexError, id, { ...o, mutatedFile: "pkg/f.py", mutatedLines: new Set([4]) })), { kind: "exception-in-lines", exception: "IndexError", line: 4 });
  assert.equal((await py.runTest(mutantImportError, id, o)).kind, "error");
});
test("runTest stops a test that runs past its timeout", async () => assert.match((await py.runTest(loops, id, { timeoutMs: 2_000 }) as any).detail, /timeout/));
test("collectTests lists collected test ids, and none from a test_ file with no test", async () => { … });
test("testReadsSource is true when the test's own body opens or reads a file, or uses getsource or __file__", () => { … });
test("assertions lists each test's assert statements by test name", () => assert.deepEqual([...py.assertions("t.py", T)], [["test_a", ["assert f(1) == 2"]]]));
```
- [ ] **Step 2: Run** and see it fail.
- [ ] **Step 3: Implement.** Port `mutate.py`'s `generate` and `_scopes`; add "swap string" (each string literal swapped for another string literal of the same file); compile each mutant with `compile()` and drop failures. `runTest` runs `<interpreter> -m pytest <id> -q -x -p no:cacheprovider --tb=native --junitxml=<tmp>` in `root` (not `-I`: the repo's own tests run as the repo runs them), kills it at `timeoutMs`, and sends the XML to `python_ast.py junit`, which reads the innermost traceback frame.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `"verify-rules: Python mutations and test runs"`.

### Task 10: The tie check, both ways (L)

**Carries out:** tools: Tie-check 1–14, 15 (heading table, Python and Markdown), 17 (every bullet except the exempt list and the import and call test, which are Task 11); tools: Rule reader 4 (bold sentences unique in the whole repo); SKILL: core 4; SKILL: target 2 and 6; branch: untied-file-or-rule.md (detection).

**Files:** Create `rules/tie-check.ts`, `tests/rules/tie-check.test.ts`, `tests/rules/tie-check-ported.test.ts`.

**Interfaces:**
- Consumes: `readAll`, `Rule`, `RuleRef` (Task 6); `Language`, `FileFacts` (Task 8).
- Produces:
```ts
export type ExemptGroup = "tests" | "docs" | "tool settings" | "CLAUDE.md files" | "copied into .claude" | "empty package file";
export interface ExemptPattern { pattern: string; group: ExemptGroup; reason: string }
export interface ExemptConfig { patterns: ExemptPattern[]; ownSkills: string[] }
export interface RepoView { root: string; files: string[]; read(path: string): string; ignoredOnDisk: ReadonlySet<string>;
  collected: ReadonlySet<string>; runnerConfig: ReadonlySet<string> }
export interface Broken { file: string; problem: string; claude?: string; rule?: string }
export interface TieReport { lowest: string[]; specific: RuleRef[]; general: { rule: RuleRef; mark: "whole-folder" | null }[];
  unnamed: RuleRef[]; counted: string[]; exempt: { file: string; group: ExemptGroup; pattern: string; reason: string }[];
  refusedExempt: { file: string; group: ExemptGroup; why: string }[]; ties: { rule: RuleRef; file: string }[];
  broken: Broken[]; notYetTied: { rules: RuleRef[]; files: string[] }; cannotCarryHeading: string[] }
export function gitRepoView(root: string, languages: readonly Language[]): Promise<RepoView>
export function tieCheck(repo: RepoView, config: ExemptConfig, languages: readonly Language[]): TieReport
export function brokenLines(r: TieReport): string[]
```
Task 10 places only the CLAUDE.md files and the thesis check's groups; Task 11 completes the exempt list.

- [ ] **Step 1: Port the 35 tests** of `/home/user/senior-thesis-research/tests/test_claude_ties.py` into `tests/rules/tie-check-ported.test.ts`, same names and same fixtures, as in-memory `RepoView`s: `a rule names its file and the file states the rule`, `a rule naming a missing file is broken`, `a file whose heading is not its rule is broken`, `a file named by two rules is broken`, `a folder of data needs a note stating its rule`, `a rule can tie its own folder as data`, `a folder of data holding code is broken`, `the report names the rule only when a rule is involved`, `untied rules and files are listed, not broken`, `a rule with no bold sentence is broken`, `a rule with two file lines is broken`, `a file line not directly under its rule is broken` (3 gaps), `two rules with the same bold sentence are broken`, `the copied opening rules are not tied`, `a later section with a copied heading is read as its own`, `tests, setup files and empty package files are not counted`, `only a folder named exactly tests holds tests`, `a test file outside a tests folder must define a test` (3 files), `a conftest is a test helper only inside a tests folder`, `code that imports from a tests folder is broken` (cases), `code that imports a file git ignores is broken` (cases), `a package file holding more than a docstring is counted`, `the docs are not counted`, `code in the docs is counted`, `a higher CLAUDE.md is not read for ties`, `git lists names with spaces and accents whole`. (The thesis suite's last test, which checks the thesis repo itself, is not ported.)
- [ ] **Step 2: Write the new failing tests** in `tests/rules/tie-check.test.ts`:
```ts
test("a heading that states a rule of any CLAUDE.md that does not name that file is broken, not only one of the nearest", () =>
  assert.deepContainEqual(problems(r), ["b/x.py", "its heading states a rule that does not name it"]));
test("a heading that differs from its rule's bold sentence by one character is broken", () => { … });
test("a counted file whose nearest CLAUDE.md is not lowest-level is broken", () => { … });
test("a rule naming a file outside its CLAUDE.md's folder is broken", () => { … });   // `*File:* `../x.py``
test("an unmarked specific rule and a 'needed' one are not yet tied; a 'whole folder' rule is general", () => { … });
test("a folder of data named outside its CLAUDE.md's folder is broken; a migrations folder ties as one folder of data", () => { … });
test("a bold sentence shared with any CLAUDE.md, a sub-rule or the global tree's labels is broken, and says whether the texts agree", () =>
  assert.deepContainEqual(problems(lodestarLike), ["models/lodestar/CLAUDE.md", "the bold sentence 'LodeSTAR' is also the bold sentence of a sub-rule in CLAUDE.md (texts differ)"]));
test("an unnamed rule is listed as unnamed, and in a lowest-level CLAUDE.md it is also broken", () => { … });
test("a stray non-blank line in a lowest-level CLAUDE.md is broken (the LodeSTAR scope line)", () =>
  assert.deepContainEqual(problems(lodestarLike), ["models/lodestar/CLAUDE.md", "line 14 is not a heading, the copied opening, a rule's text or a file line"]));
test("a file whose type cannot carry a heading, outside a folder of data and not exempt, cannot be tied", () =>
  assert.deepEqual(r.cannotCarryHeading, ["part/table.json"]));
test("brokenLines prints one item per line in a stable order", () => assert.deepEqual(brokenLines(r), brokenLines(shuffled(r))));
```
- [ ] **Step 3: Run** both files. Expected: FAIL, module not found.
- [ ] **Step 4: Implement `rules/tie-check.ts`** by porting `claude_ties.py`'s `check`, reading rules through `readAll` and headings through `Language.facts` (Markdown's title is read here: the first `# ` line). Bold sentences are compared across every CLAUDE.md, sub-rules included.
- [ ] **Step 5: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit**: `"verify-rules: the two-way tie check, ported from the thesis repo and completed"`.

### Task 11: The exempt list, by pattern and by content (M)

**Carries out:** tools: Exempt-list 1–13 (the generated-files group is milestone L5: until then a generated file is counted, the safe default of Exempt-list 2); tools: Tie-check 17 ("the exempt list", "the import and call test"); tools: Root 7; branch: exempt-list.md (a refused file is counted).

**Files:** Modify `rules/tie-check.ts`. Create `tests/rules/exempt.test.ts`.

**Interfaces:**
- Consumes: `FileFacts.references` (Task 8); `collectTests` (Task 9) through `gitRepoView`.
- Produces: `export const DEFAULT_EXEMPT: ExemptConfig` and `export function matchesPattern(path: string, pattern: string): boolean` (whole path parts only).

- [ ] **Step 1: Write the failing tests:**
```ts
test("a group's pattern places a file only when its content rule holds", () => { … });
test("a file no pattern places is counted; a test_ file from which pytest collects nothing is counted", () => { … });
test("conftest.py that pytest loads as configuration is in the tests group (LodeSTAR problem 13)", () => { … });
test("a test helper that product code imports is broken", () => { … });
test("a docs folder holding a code file is broken; a README below a folder's top is counted; a top README that a counted file reads is broken", () => { … });
test("patterns match whole path parts: contests/ and latests/ are not tests", () => assert.equal(matchesPattern("contests/a.py", "tests/**"), false));
test("CLAUDE.md files and .gitignore are placed in their groups; .claude/ copies are exempt, a skill listed as this repo's own is counted", () => { … });
test("an exempt file that a counted file imports, names in a dynamic import, runs with -m, execs, calls by subprocess or adds to sys.path is broken", () => { … });
test("tool settings that code reads as settings are the one exception", () => { … });
test("a git-ignored file on disk that a counted file imports is broken", () => { … });
test("the loophole hunt's eight hiding places each end counted or broken", () => {
  for (const place of ["test_ prefix", "conftest.py outside tests", "under docs/", "under contests/", "in a data folder",
                       "in an empty-package file", "saved as README.md", "git-ignored"]) assert.ok(caught(place), place);
});
test("the report counts exempt files per group", () => { … });
```
- [ ] **Step 2–5:** run (fail), implement, run `npm test && npm run typecheck` (pass), commit: `"verify-rules: the exempt list by pattern, content, imports and calls"`.

### Task 12: The situation detector (S)

**Carries out:** tools: Situation detector 1–8 (B's "none of the system rules" needs step 1's matching, milestone L2: version 1 calls B "code and no CLAUDE.md"); SKILL: "Situations"; branch: situation-a.md and interview.md (their triggers).

**Files:** Create `run/situation.ts`, `tests/run/situation.test.ts`.

**Interfaces:**
- Consumes: `TieReport` (Task 10).
- Produces: `export function detectSituation(scope: string, report: TieReport, claudeMds: string[], hasCommit: boolean): { guess: "A" | "B" | "C" | "D"; counts: Record<string, number>; steps: StepId[]; stop: string | null }`.

- [ ] **Step 1: Write the failing tests:**
```ts
test("A: no counted file and no CLAUDE.md, or no commit at all", () => assert.equal(detectSituation(".", empty, [], false).guess, "A"));
test("B: counted files and no CLAUDE.md", () => …);
test("C: a broken or not-yet-tied item inside the scope", () => …);
test("D: nothing broken and nothing not yet tied inside the scope, whatever is outside it (LodeSTAR problem 12)", () =>
  assert.equal(detectSituation("models/lodestar", neededRuleInExperiments, claudes, true).guess, "D"));
test("version 1 stops in A and B with a plain message", () =>
  assert.equal(detectSituation(".", empty, [], false).stop, "Version 1 of the skill runs only on a repo that already has CLAUDE.md files (situations C and D)."));
test("the steps that will run are version 1's for C and D", () => assert.deepEqual(r.steps, ["0", "7", "tie", "8", "9", "14"]));
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the situation detector"`.

### Task 13: The piece cutter and the function-to-clause table (M)

**Carries out:** tools: Piece cutter 1; tools: Function-to-clause 1–7; tools: Tie-stage p3b.1, p4.9–11, p4.14 (the same output path written by two files); tools: Coverage tables 1 (table 3); branch: file-does-more.md (detection only; endings are milestone L3).

**Files:** Create `code/pieces.ts`, `code/piece-table.ts`, `tests/code/piece-table.test.ts`.

**Interfaces:**
- Consumes: `Language`, `FileFacts`, `Piece`, `blankLineBlocks` (Task 8); `Clause` (Task 7); `Rule`, `RuleRef` (Task 6); `RepoView` (Task 10).
- Produces:
```ts
// code/pieces.ts
export interface GatheredPiece { file: string; piece: Piece; code: string; writes: string[]; callers: string[]; names: string[] }
export function cutPieces(file: string, text: string, facts: FileFacts | null): Piece[]
export function gather(file: string, piece: Piece, text: string, facts: FileFacts | null, repo: RepoView): GatheredPiece
// code/piece-table.ts
export interface Citation { clause: string; file: string; lines: [number, number][]; test: string | null; callSites: string[];
  carried: boolean; source: "reviewer" | "doer" }
export interface PieceRow { file: string; piece: Piece; clauses: string[]; extra: boolean }
export function citationProblems(c: Citation, fileText: string, clause: Clause, searchTest: boolean): string[]
export function functionToClause(file: string, pieces: GatheredPiece[], citations: Citation[]): { rows: PieceRow[]; floorOk: boolean }
export function keyWords(text: string): Set<string>
export function candidateRules(p: GatheredPiece, own: RuleRef, all: Rule[], generalOverFolder: ReadonlySet<string>): RuleRef[]
export function sharedOutputs(pieces: GatheredPiece[]): { path: string; files: string[] }[]
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("a piece holds the clauses whose cited lines lie inside it; a piece holding none is extra, automatically", () => {
  const { rows } = functionToClause("dots.py", gathered, [cite("R1#c1", [[16, 16]])]);
  assert.deepEqual(rows.filter(r => r.extra).map(r => r.piece.name), ["network_output"]);
});
test("the heading piece maps to the rule's bold-sentence clause, and an import maps to the clauses of the pieces that use its names", () => { … });
test("a citation of more than 30% of the file's non-blank lines is refused, unless the clause is a never or only clause checked by a search", () => {
  assert.deepEqual(citationProblems(cite("R1#c2", [[1, 84]]), train84, clause("It saves whole."), false), ["cites 84 of 84 non-blank lines, more than 30% of the file"]);
  assert.deepEqual(citationProblems(cite("R2#c1", [[1, 84]]), train84, clause("Never import cellpose."), true), []);
});
test("the floor: every piece of the file is in the table", () => assert.ok(functionToClause("f.py", gathered, cites).floorOk));
test("a file that does not parse is cut into blank-line blocks", () => { … });
test("each gathered piece lists what it writes and who calls it, outside tests", () => { … });
test("candidate rules: every other rule of the same CLAUDE.md and any rule sharing two key words, never a general rule over the folder", () => {
  const c = candidateRules(trainPiece, own, rules, new Set(["CLAUDE.md::Long jobs save as they go."]));
  assert.ok(!c.some(r => r.bold === "Long jobs save as they go."));   // LodeSTAR problem 8
});
test("two files that write the same output path are reported", () => assert.deepEqual(sharedOutputs(ps), [{ path: "results.json", files: ["a.py", "b.py"] }]));
```
- [ ] **Step 2–5:** run (fail), implement (port `pieces.table`, `lister.key_words` with its stop list, `builders.calls_to`), run (pass), commit: `"verify-rules: pieces and the function-to-clause table"`.

### Task 14: The mutation runner (L)

**Carries out:** tools: Mutation runner 1–9; tools: Coverage tables 1 (table 2); branch: untestable-clause.md (the "not testable here" causes, the kinds); SKILL: never "writes a mutation"; SKILL: core 5.

**Files:** Create `code/mutate.ts`, `tests/code/mutate.test.ts`.

**Interfaces:**
- Consumes: `Language` (Tasks 8–9); `Citation` (Task 13); `Clause` (Task 7); `writeWhole`, `saveTable` (Task 1).
- Produces:
```ts
export interface Elements { numbers: number[]; comparisons: string[]; words: string[] }
export type RowResult = "tested" | "not tested" | "not testable here" | "gap to implement" | "gap to check" | "not a requirement";
export interface MutationRow { clause: string; file: string; lines: [number, number][]; result: RowResult; cause: string | null;
  mutation: Mutation | null; test: string | null; failure: TestOutcome | null; cleanPass: boolean | null; readsSource: boolean | null; tried: string[] }
export function elementsOf(clauseText: string): Elements
export function targets(m: Mutation, e: Elements): boolean
export function orderMutations(ms: Mutation[], e: Elements): Mutation[]
export async function runTable(clauses: { clause: Clause; kind: string; citation: Citation | null }[], ctx: {
  worktree: string; languages: readonly Language[]; cap: number; tableName: string; paths: RunPaths;
  searchTests: ReadonlySet<string>; progress: (line: string) => void }): Promise<MutationRow[]>
```
The comparison words are fixed: "above", "over", "more than" → `>`; "at least" → `>=`; "below", "under", "less than" → `<`; "at most" → `<=`; "equal" → `==`.

- [ ] **Step 1: Write the failing tests** on the toy repo of Task 9:
```ts
test("elementsOf reads numbers, comparison words and names", () =>
  assert.deepEqual(elementsOf("It uses 5,000 steps above a cut-off, with the Adam optimizer at 0.001."), { numbers: [5000, 0.001], comparisons: [">"], words: ["uses", "steps", "above", "with", "adam", "optimizer"] }));
test("mutations that change an element the clause names come first, then by operator order", () => { … });
test("at most `cap` mutations are tried for a clause", async () => assert.equal((await one(clause, { cap: 2 })).tried.length, 2));
test("a clause is tested only when all six conditions hold, and each broken condition gives its own reason", async () => {
  for (const [name, setup, want] of [
    ["outside the cited lines", citeOtherLines, "not tested: no mutation inside its cited lines changes an element it names"],
    ["hash backs another clause", sameMutationTwice, "not tested: its only killing mutation backs another clause"],
    ["identical citations", twoClausesSameLines, "not tested: another clause cites the same lines"],
    ["fails on an import error", brokenImport, "not tested: no named test fails on an assertion or inside the mutated lines"],
    ["fails unbroken", redTest, "not tested: the named test fails on the unbroken code"],
    ["reads the source", sourceReadingTest, "not tested: the named test reads a counted source file"],
  ] as const) assert.equal(cause(await one(setup)), want, name);
});
test("the loophole hunt's case: one test checking one of three counts leaves two clauses not tested", async () => …);
test("a clause whose lines lie in another file is 'not testable here: code lives in another file'; no reachable operator gives its own cause", async () => …);
test("kinds: a reason is 'not a requirement (reason)'; not carried is 'gap to implement'; carried with no test is 'gap to check'", async () => …);
test("every mutant is made in a temporary copy outside the repo and deleted after", async () => …);
test("the table is saved after every clause, a rerun resumes at the first clause without a row, and each try prints a progress line", async () => …);
```
- [ ] **Step 2: Run** and see it fail.
- [ ] **Step 3: Implement `code/mutate.ts`** from `audit_mutations.py`: copy the worktree to `fs.mkdtempSync(os.tmpdir())` (never under the repo), run each named test once unbroken and keep the result, then try mutations in `orderMutations` order up to `cap`, crediting the first that meets every condition. `searchTests` names the tests the doer declared as search tests of never and only clauses.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `"verify-rules: the mutation runner"`.

### Task 15: The secret stripper (S)

**Carries out:** tools: Secret stripper 1; branch: secret-found.md; SKILL: never "sends secrets…".

**Files:** Create `checks/secrets.ts`, `tests/checks/secrets.test.ts`.

**Interfaces:** Produces `export function strip(state: string, accountNames: readonly string[]): { state: string; removed: { kind: string; at: number }[]; refused: boolean }`. `accountNames` come by script from the repo (names the CLAUDE.md files and job-runner settings mention as accounts) and are kept in the run folder; they are never sent.

- [ ] **Step 1: Write the failing tests** (fixtures use made-up values only):
```ts
test("keys, tokens, emails, env and credential file contents, and account names are replaced by their kind", () => {
  const r = strip("key sk-ant-abc123XYZ, token=Q1w2, a@b.example, account acct-one", ["acct-one"]);
  assert.equal(r.state, "key <key>, <secret>, <email>, account <account>");
  assert.deepEqual(r.removed.map(x => x.kind), ["<key>", "<secret>", "<email>", "<account>"]);
});
test("the removed list holds kinds and places, never values", () => assert.ok(!JSON.stringify(r.removed).includes("abc123")));
test("a state that still matches a secret pattern after stripping is refused", () => assert.equal(strip(OBFUSCATED, []).refused, true));
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the secret stripper"`.

### Task 16: Thresholds and calibration, from the existing data (M) — the calibration task, part 1

**Carries out:** tools: Thresholds and calibration 1–11 (the table, the threshold rule, the inversions fixed, choice answers); branch: jev-unsure.md (how an answer is read); SKILL: "The checkpoint" (unsure is never a pass).

**Files:**
- Create: `checks/thresholds.ts`, `checks/calibration/items.jsonl`, `checks/calibration/thresholds.json`, `checks/calibration/stress-ties-calibration.json` (a copy of the measured file), `tests/checks/thresholds.test.ts`
- Modify: `docs/tools.md` (the thresholds table and every bracketed threshold that differs; see Step 6)

**Interfaces:**
- Produces:
```ts
export type Role = "decide" | "may only fail" | "weak signal" | "class" | "chain";
export interface CalItem { id: string; type: string; state: "main" | "second"; label: "right" | "wrong"; p: number; source: string; measured: boolean }
export interface TypeThresholds { type: string; role: Role; pass: number | null; fail: number; calibrated: boolean; nRight: number; nWrong: number; falseFails: number }
export function computeThresholds(items: CalItem[], role: Role): Omit<TypeThresholds, "type" | "role">
export function computeAll(items: CalItem[], roles: Record<string, Role>): Record<string, TypeThresholds>
export function loadThresholds(): Record<string, TypeThresholds>
export type Reading = "PASS" | "FAIL" | "UNSURE" | "RECORDED" | "SPECIFIC" | "GENERAL" | "YES" | "NO" | "NO ANSWER";
export function readAnswer(t: TypeThresholds, p: number | null): Reading
```
The threshold rule (tools: Thresholds 7 and 10, made exact): W is the highest p of a known-wrong item and R the lowest p of a known-right item. If W ≥ R (overlap): pass = W + 0.01, fail = R − 0.01. If W < R (no overlap): pass = R, fail = W + 0.01, so both lie inside the gap and pass ≥ fail. With no known-right or no known-wrong item, the type is not calibrated: pass = max(0.80, W + 0.01), fail = min(0.50, R − 0.01). For "may only fail", pass is null. Values are rounded to 2 decimals.

- [ ] **Step 1: Build `items.jsonl`.** One line per answered item of `…/stress-ties/jev-log.jsonl` (287: id, qtype mapped as below, label, p, `source: "live test"`, `measured: true`); the 14 canaries of the LodeSTAR run folder's `jev/jev-log.jsonl` (`label: "wrong"`, `source: "LodeSTAR test"`); and the loophole hunt's J1 whole-folder mark (`p: 0.90`, `label: "wrong"`, `measured: false`, source "loophole hunt, tools.md; state in stress-loopholes/reqs.json"). Labels: the live test's `class` items are labelled `specific` (right, since p is the probability of "specific") or `general` (wrong), and its `q1_piece` items `yes` (right) or `no` (wrong); unlabelled items are left out. Type map: `class`→`class`; `clause_code_only`→`clause_carried`; `exempt` (main) and `exempt_imports` (second)→`exempt`; `q1_piece`, `q1_own`→`q1`; `same_md`→`same_md`; `serves`→`serves`; `whole`→`whole`; LodeSTAR `complete`, `correct`, `clause_carried`, `whole`, `system_rule` keep their names. Retired types (`clause`, `free`, `free2`, `rule`, `serves2`) are kept with `type` prefixed `retired:`. Do this once with `node -e` in the shell; no script is kept. Copy `calibration.json` beside it.
- [ ] **Step 2: Write the failing tests:**
```ts
test("the live test's items reproduce calibration.json's lists per type", () => {
  for (const t of reference.types) assert.deepEqual(sorted(items, "live test", t.type, "right"), t.right_p);
});
test("the rule on the measured data gives these thresholds, the inversions fixed", () => {
  const all = loadThresholds();
  assert.deepEqual(pf(all.class), [0.71, 0.27]);        // overlap: W 0.70, R 0.28
  assert.deepEqual(pf(all.clause_carried), [null, 0.32]); // may only fail: R 0.33
  assert.deepEqual(pf(all.exempt), [null, 0.92]);         // may only fail: R 0.93, both states
  assert.deepEqual(pf(all.q1), [0.79, 0.40]);             // was inverted 0.40 / 0.78
  assert.deepEqual(pf(all.same_md), [0.68, 0.61]);        // was inverted 0.61 / 0.67
  assert.deepEqual(pf(all.serves), [0.73, 0.19]);
  assert.deepEqual(pf(all.whole), [0.91, 0.87]);          // was inverted 0.83 / 0.87; J1 at 0.90 is above every right item
  assert.deepEqual(pf(all.complete), [0.80, 0.50]);       // not calibrated: no known-right item yet
});
test("for every type, pass is at or above fail, and no known-wrong item reaches pass", () => {
  for (const t of Object.values(loadThresholds())) { if (t.pass !== null) assert.ok(t.pass >= t.fail); assert.ok(noWrongAtOrAbove(t)); }
});
test("thresholds.json is what computeAll makes from items.jsonl", () => assert.deepEqual(loadThresholds(), computeAll(readItems(), ROLES)));
test("readAnswer: at or above pass is PASS, below fail is FAIL, between is UNSURE; may only fail gives FAIL or RECORDED; class gives SPECIFIC or GENERAL; null is NO ANSWER", () => { … });
```
- [ ] **Step 3: Run** `node --test tests/checks/thresholds.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement `checks/thresholds.ts`**, then write `thresholds.json` by calling `computeAll` once.
- [ ] **Step 5: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Make the docs agree** (tools: Thresholds 10). In `docs/tools.md`, set the thresholds table and the bracketed values of the checker map and of Tie-stage to the computed ones: class 0.72→0.71; clause carried out 0.35→0.32; question 1 0.75 / 0.45→0.79 / 0.40; same meaning 0.65 / 0.40→0.68 / 0.61; whole-folder mark 0.88 / 0.60→0.91 / 0.87. Then `grep -rn "0\.75 and 0\.45\|0\.72\|0\.88\|0\.65\|0\.35" verify-rules/branches docs/tools.md` and update question-chain.md, general-or-specific.md and the rest that quote them. List every change in the commit message.
- [ ] **Step 7: Commit** `checks/thresholds.ts`, `checks/calibration/*`, the test, `docs/tools.md` and the changed branch files: `"verify-rules: thresholds computed from the calibration set; inversions fixed"`.

### Task 17: The Jev client (M)

**Carries out:** tools: Jev client 1–7; tools: State-builder 2, 3, 8, 11; tools: Thresholds 11; tools: Budget 4; branch: checker-unusable.md (Jev's cases); SKILL: never "words a Jev question".

**Files:** Create `checks/jev.ts`, `tests/checks/jev.test.ts`, `tests/helpers/fake-jev.ts`.

**Interfaces:**
- Consumes: `strip` (Task 15); `RunPaths`, `writeWhole` (Task 1); `append` (Task 2); `BudgetKeeper` (Task 19: tests use a stub with the same type until then; define the type here and let Task 19 implement it).
- Produces:
```ts
export const JEV_MODEL: string;   // "typesafe-ai/jev-1.14.0" until Task 34
export interface BuiltState { builder: string; builderHash: string; text: string }
export interface JevRequest { item: string; question: string; form: "boolean" | { choices: Record<string, string> };
  expectedChoice: string | null; states: BuiltState[]; canary: boolean }
export interface JevAnswer { item: string; n: number; p: number | null; choice: string | null; probabilities: Record<string, number> | null;
  provider: string | null; model: string; requestId: string | null; inputTokens: number; outputTokens: number; seconds: number;
  builder: string; builderHash: string; stateSha: string; rawFile: string; unusable: string | null }
export type Decide = (a: { model: string; state: string; questions: Record<string, unknown> }) => Promise<unknown>;
export interface BudgetKeeper { canSpend(kind: "jev" | "claude", usd: number): boolean; spent(kind: "jev" | "claude", usd: number, detail: string): void }
export async function askJev(requests: JevRequest[], ctx: { paths: RunPaths; budget: BudgetKeeper; accountNames: string[];
  decide?: Decide; workers?: number; registered: ReadonlySet<string> }): Promise<JevAnswer[]>
```
The default `decide` is the AI SDK's `experimental_decide`, run in a child Node process with `NODE_USE_ENV_PROXY=1` and the session's CA bundle (`NODE_EXTRA_CA_CERTS`) when they exist, as the LodeSTAR client was run; the gateway key comes from the session's credential flow, or a placeholder where the proxy adds it.

- [ ] **Step 1: Write the failing tests** (with `fakeDecide`, which records calls and returns canned results):
```ts
test("a state no registered builder made is refused and not sent", async () => {
  await assert.rejects(askJev([req({ states: [{ builder: "mine", builderHash: "x", text: "s" }] })], ctx), /no registered builder/);
  assert.equal(fakeDecide.calls.length, 0);
});
test("the pinned version is called, never the alias", async () => { await askJev([req()], ctx); assert.equal(fakeDecide.calls[0].model, JEV_MODEL); assert.notEqual(JEV_MODEL, "typesafe-ai/jev"); });
test("a choice question's p is the probability of the expected choice, not the top choice", async () => {
  fakeDecide.next({ answers: { q: { type: "choice", choice: "D", probabilities: { C: 0.40, D: 0.45 } } } });
  assert.equal((await askJev([req({ form: { choices: SITUATIONS }, expectedChoice: "C" })], ctx))[0].p, 0.40);
});
test("every answer records request id, model, final provider, tokens, builder, state hash, and its raw response file first", async () => { … });
test("an answer from another provider is unusable; 3 retries, then the checker cannot be used", async () => {
  fakeDecide.always({ provider: "digitalocean" }); await assert.rejects(askJev([req()], ctx), /cannot be used/); assert.equal(fakeDecide.calls.length, 4);
});
test("a request the money cap cannot pay for is not sent", async () => { … });
test("with two registered states, both are sent and the lower p is recorded", async () => { … });
test("every state passes through the secret stripper; a refused state is not sent", async () => { … });
test("asking the same item twice sends two requests: saved answers are never replayed", async () => { … });
test("the pinned ai package exports experimental_decide", async () => assert.equal(typeof (await import("ai")).experimental_decide, "function"));
```
- [ ] **Step 2–5:** run (fail), implement (the request shape of `jev_client.mjs`; routing's `finalProvider`; `x-vercel-id` header), run `npm test && npm run typecheck` (pass), commit: `"verify-rules: the Jev client, pinned and checked per call"`.

### Task 18: The Claude-checker launcher (M)

**Carries out:** tools: Claude-checker launcher 1–10; tools: Gate job1.1–1.5, 15 (probe runs go through here); branch: jev-unsure.md (the second checker); branch: step-agents.md (reviewers' fixed prompt and form); branch: checker-unusable.md (Claude's cases); SKILL: never "names a checker's model by an alias…".

**Files:** Create `checks/claude-checker.ts`, `tests/checks/claude-checker.test.ts`, `tests/helpers/fake-claude.ts` (writes an executable `claude` into a temporary `PATH` folder that prints a canned JSON with `result`, `modelUsage` and `total_cost_usd`, and saves the prompt it read).

**Interfaces:**
- Consumes: `Citation` (Task 13); `BudgetKeeper` (Task 17); `append` (Task 2).
- Produces:
```ts
export const RANKING: readonly { id: string; rank: number }[];
export const PROMPTS: { checker: string; form: string; second: string; reviewer: string; shortcutAudit: string };
export interface ClaudeRun { name: string; kind: "checker" | "second" | "reviewer" | "shortcut audit" | "probe"; asked: string;
  reported: string[]; void: string | null; seconds: number; costUsd: number | null; promptSha: string; answer: string; answerSha: string }
export interface ItemLine { verdict: "PASS" | "FAIL"; item: string; evidence: string }
export function chooseCheckers(doer: string, runnable: readonly string[]): { checker1: string; second: string; belowDoer: boolean }
export function commandLine(model: string, allow: readonly string[], deny: readonly string[]): string[]
export async function runClaude(kind: ClaudeRun["kind"], name: string, model: string, body: string, ctx: { paths: RunPaths; cwd: string;
  doer: string; allow: string[]; timeoutMs: number; budget: BudgetKeeper }): Promise<ClaudeRun>
export function parseAnswer(answer: string, required: readonly string[], canaries: ReadonlySet<string>): { lines: ItemLine[];
  perItem: Map<string, "PASS" | "FAIL" | "no answer">; checks: Partial<Record<"CORRECT" | "SAME" | "COMPLETE", "PASS" | "FAIL">>;
  stepLine: "PASS" | "FAIL" | null; verdict: "PASS" | "FAIL"; notes: string[] }
export function parseReviewerAnswer(answer: string, clauseIds: readonly string[]): Citation[]
```
`PROMPTS.checker` and `PROMPTS.form` are tools: Launcher 4 and 5, word for word.

- [ ] **Step 1: Write the failing tests:**
```ts
test("the command line is the documented one, with no --bare", () =>
  assert.deepEqual(commandLine("claude-fable-5-2", ["Read"], ["Edit"]).slice(0, 10),
    ["claude", "-p", "--model", "claude-fable-5-2", "--disable-slash-commands", "--strict-mcp-config", "--no-session-persistence", "--output-format", "json", "--allowedTools"]));
test("aliases and the doer's own id are refused", async () => {
  for (const m of ["opus", "sonnet", "haiku", "fable", "mythos", "claude-opus-5-5"]) await assert.rejects(runClaude("checker", "x", m, "b", ctx), /explicit model id/);
});
test("the reported model comes from modelUsage; the doer's id or another id than asked voids the run", async () => {
  fake.reports("claude-opus-5-5"); assert.match((await runClaude("checker", "x", "claude-fable-5-2", "b", ctx)).void!, /doer's model/);
});
test("checker 1 is the best-ranked model other than the doer's; the second checker differs from both where one can run", () =>
  assert.deepEqual(chooseCheckers("claude-opus-5-5", ["claude-fable-5-2", "claude-fable-5-1", "claude-opus-4-7"]), { checker1: "claude-fable-5-2", second: "claude-fable-5-1", belowDoer: false }));
test("the prompt is the fixed prompt, the fixed form and the body; its hash is recorded", async () => { … });
test("parser: a FAIL naming a known item with evidence is a FAIL; other remarks are notes; a required item with no line is 'no answer'; canary lines never count", () => {
  const r = parseAnswer("PASS — a — x\nFAIL — k9 — planted\nFAIL — zzz — new demand\nSTEP FAIL", ["a", "b", "k9"], new Set(["k9"]));
  assert.deepEqual([r.perItem.get("a"), r.perItem.get("b"), r.verdict, r.notes.length, r.stepLine], ["PASS", "no answer", "FAIL", 1, "FAIL"]);
});
test("the second checker's body never holds Jev's number or checker 1's verdict", () => { … });
test("the reviewer form is parsed into citations", () =>
  assert.deepEqual(parseReviewerAnswer("R1#c2 | CARRIED models/x.py:16-18 | TEST tests/test_x.py::test_a | CALL SITES models/y.py:31", ["R1#c2"])[0].lines, [[16, 18]]));
test("each run's seconds and total_cost_usd are recorded apart from the budgets", async () => { … });
```
- [ ] **Step 2–5:** run (fail), implement (port `checker.py`; `RANKING` from the claude-api model list), run (pass), commit: `"verify-rules: the Claude-checker launcher"`.

### Task 19: The budget keeper, with simple caps (S)

**Carries out:** tools: Budget keeper 1–7 (money and a Claude-run cap; compute budgets are milestone L9); branch: budget.md (asked first; going over stops and asks); SKILL: core 14.

**Files:** Create `run/budget.ts`, `tests/run/budget.test.ts`.

**Interfaces:**
- Consumes: `BudgetKeeper` type (Task 17); `RunState`, `updateState` (Task 1); `logQuestion` (Task 4). The budget questions are kind (b); a question to raise a budget names the items it holds up in `items`, so `budget-refused` (Task 5) can cite it.
- Produces:
```ts
export interface ItemCounts { byStep: Partial<Record<StepId, { items: number; checksPerItem: number }>>; claudeRunsPerRound: number }
export interface Estimate { jevCalls: number; jevUsd: number | null; claudeRuns: number; priceSource: string; lines: string[] }
export function estimate(c: ItemCounts, price: { jevInputUsdPerToken: number | null; source: string }, tokensPerCall?: number): Estimate
export function parseBudgets(answer: string): { moneyUsd: number; claudeRuns: number } | null
export function budgetKeeper(paths: RunPaths, onOver: (what: string) => void): BudgetKeeper & { unpaid(): { checks: number; usd: number } }
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("the estimate is items × checks, plus canaries, times 3 rounds, priced at the moment", () => {
  const e = estimate({ byStep: { "7": { items: 100, checksPerItem: 3 } }, claudeRunsPerRound: 2 }, { jevInputUsdPerToken: 4.2e-8, source: "gateway model list" }, 1439);
  assert.equal(e.jevCalls, (300 + 15) * 3); assert.equal(e.claudeRuns, 6);
});
test("a price that cannot be found is stated as unknown", () => assert.equal(estimate(c, { jevInputUsdPerToken: null, source: "" }).jevUsd, null));
test("budgets are read from the user's words: dollars and Claude runs", () => assert.deepEqual(parseBudgets("$5, and at most 20 Claude runs"), { moneyUsd: 5, claudeRuns: 20 }));
test("a spend that would go over refuses and asks to raise the budget", () => { assert.equal(k.canSpend("jev", 6), false); assert.equal(asked, "money budget"); });
test("unpaid checks are reported with their estimated cost", () => assert.deepEqual(k.unpaid(), { checks: 42, usd: 0.0025 }));
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the budget keeper with simple caps"`.

### Task 20: The state-builder registry (L)

**Carries out:** tools: State-builder registry 1–13; tools: Gate 10–14 (the checker map, as who must pass per question type); tools: Per-step checklists (copied into packs); tools: Evidence 2; tools: Conversation 4 and 5 (message-kind and approval questions); branch: general-or-specific.md, clause-audit.md (clause kinds), open-items.md (put-off question), fix-groups.md (group question); SKILL: core 2 and 8.

**Files:** Create `checks/questions.ts`, `checks/instructions.json` (generated), `tests/checks/questions.test.ts`.

**Interfaces:**
- Consumes: `BuiltState`, `JevRequest` (Task 17); `RunView`, `Finding` (Task 1); `Rule` (Task 6); `Clause` (Task 7); `GatheredPiece`, `PieceRow` (Task 13); `MutationRow` (Task 14); `TieReport` (Task 10).
- Produces:
```ts
export type QuestionType = "correct" | "same_code" | "same_md" | "complete" | "situation" | "clause_carried" | "clause_list" | "q1_own"
  | "q1_other" | "serves" | "class" | "whole" | "exempt" | "clause_kind" | "script_output" | "put_off" | "group" | "conceptual_item"
  | "message_kind" | "approval" | "whole_process";
export type MustPass = "all three" | "script and Claude; Jev may fail" | "script; Jev may fail" | "Jev and Claude" | "Jev or both Claude" | "Claude";
export interface Question { type: QuestionType; text: string; form: "boolean" | { choices: Record<string, string> };
  calibration: string; role: import("./thresholds.ts").Role; mustPass: MustPass }
export const QUESTIONS: Record<QuestionType, Question>;
export type Builder = (subject: Record<string, string>, run: RunView) => string;
export const BUILDERS: Record<string, Builder>;
export type FactBuilder = (run: RunView) => { fact: string; present: boolean; evidence: string }[];
export const FACTS: Record<string, FactBuilder>;            // "<step>.dw<n>"; filled by Task 32
export function builderHash(name: string): string           // sha256 of the builder's source text
export function buildStates(question: QuestionType, builder: string, subject: Record<string, string>, run: RunView): BuiltState[] | null
export function instructions(ref: string): string           // e.g. "tools:Tie-stage check", "SKILL:Step 7", "branch:jev-unsure.md"
export function buildInstructions(skillDir: string, toolsMd: string): Record<string, string>   // writes checks/instructions.json
```
Builders, one per question type, keep the calibrated layouts of `builders.py` (`clause_state` without test output, `clause_list_state`, `piece_sentence_state` with every mapped sentence, `serves_state`, `class_state` without the doer's label, `whole_state`, `kind_state`, `message_state`, `spec_item` with the per-fact checklist), plus `exempt_state` (definition, content rule, whole file, importers) and `script_output_state` ("Does this output show a pass?").

- [ ] **Step 1: Write the failing tests:**
```ts
test("the three questions are the user's words, copied from the instructions", () => {
  assert.equal(QUESTIONS.correct.text, "Was it done correctly, based on these instructions?");
  assert.equal(QUESTIONS.same_code.text, "If it's code, does it pass all of the same checks it did before?");
  assert.equal(QUESTIONS.same_md.text, "If it's CLAUDE.md, does it have the exact same meaning as before?");
  assert.deepEqual(QUESTIONS.complete.form, { choices: { completely: "Every part the item requires was done.", "only part of it": "Some part the item requires was not done." } });
});
test("every pass-or-fail question is in positive form: its right answer is yes or a named choice", () => { … });
test("a state holds the item, instructions copied from the snapshot and raw evidence: never an absolute path, never test output for clause_carried", () => {
  const s = BUILDERS.clause_state(subject, run);
  assert.ok(!s.includes(run.copyRoot)); assert.ok(!/passed|failed|assert/.test(s.split("FILE")[0]));
});
test("q1_own's state holds every sentence the piece maps to, of its own rule and the general rules together (LodeSTAR problem 3)", () => { … });
test("complete's state is the per-fact checklist, each fact present or MISSING with its evidence", () => { … });
test("the class question never shows the doer's label", () => assert.ok(!BUILDERS.class_state(s, run).includes("general")));
test("builder hashes are stable and change when a builder's source changes", () => { … });
test("who must pass follows the checker map for every question type", () => {
  assert.equal(QUESTIONS.clause_carried.mustPass, "script and Claude; Jev may fail");
  assert.equal(QUESTIONS.whole_process.mustPass, "Jev or both Claude");
});
test("instructions.json is current: rebuilding it from SKILL.md, the branches and docs/tools.md gives the same text", () => { … });
```
- [ ] **Step 2: Run** and see it fail.
- [ ] **Step 3: Implement.** `buildInstructions` cuts SKILL.md, each branch file and each `## ` section of `docs/tools.md` into named pieces; the npm script `"instructions": "node checks/questions.ts --build"` writes `checks/instructions.json`. Packs and states read only the snapshot, so an installed copy, which has no `docs/`, still works.
- [ ] **Step 4: Run** `npm run instructions && npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `"verify-rules: the state-builder registry with the fixed questions"`.

### Task 21: The item lister (M)

**Carries out:** tools: Item lister 2, 3 (1, the conflict pairs, is milestone L2); tools: State-builder 8 (a script knows each check's item count); SKILL: "The checkpoint" (every item list built by script from the whole repo); branch: open-items.md (declined items left out and listed).

**Files:** Create `run/items.ts`, `tests/run/items.test.ts`.

**Interfaces:**
- Consumes: `RunView`, `StepId`, `STEP_IDS` (Task 1); `readDeclinedTrailers`, `setOpen`, `checkOf`, `Checks` (Task 5); `QuestionType`, `BUILDERS` (Task 20); `TieReport` (Task 10); `clauseTable` (Task 7).
- Produces:
```ts
export interface Item { id: string; step: StepId; check: "correct" | "same" | "complete"; question: QuestionType;
  subject: Record<string, string>; builder: string | null }
export const CHECKS = { "0.test": "shipped", "7.clause": "shipped", …, "14.duplicates": "later", … } as const satisfies Checks;
  // the one owner of every check the skill has, by the item-id prefix it checks (checkOf), shipped in version 1 or later;
  // a left-out item is put off with setOpen(p, id, { code: "later-version", checks: CHECKS })
export function listItems(step: StepId, run: RunView): { items: Item[]; leftOut: { id: string; why: "declined" | "later-version"; detail: string }[]; empty: boolean }
export function repoRuleKinds(rules: Rule[]): { rule: RuleRef; kinds: string[] }[]
```
Item ids are stable for the same commit and inputs: `<step>.<kind>:<subject>`, for example `7.clause:R12#c3@models/lodestar`. The part before the colon is the item's check (`checkOf`, Task 5; not `Item.check`, which is one of the three checks) and a key of `CHECKS`, so a check that is only partly in version 1 is two keys (for example `14.final` and `14.duplicates`). The steps are `STEP_IDS` (Task 1). This task lists steps 0, 7, 8, 9 and 14; Task 28 adds the tie stage's items, because they come from its scripts.

- [ ] **Step 1: Write the failing tests:**
```ts
test("step 7 lists every clause of every rule in scope, once per folder it covers, and every planned file's table", () => { … });
test("a general rule's clauses get one item per folder they cover inside the scope", () => { … });
test("a list the script counts as empty is 'none: 0 items' and sends nothing", () => assert.equal(listItems("9", runWithNoChanges).empty, true));
test("declined items are left out and each one is listed", () => assert.deepEqual(r.leftOut, [{ id: "8.change:C3", why: "declined", detail: "C3. …" }]));
test("an item whose check is not in version 1 is left out as later-version", () => assert.ok(listItems("14", run).leftOut.some(x => x.why === "later-version" && x.id === "14.duplicates:repo")));
test("every item id's check is a key of CHECKS", () => { … });
test("step 0 lists every rule whose text names a repo-rule kind", () =>
  assert.deepEqual(repoRuleKinds(rules).map(x => x.kinds), [["branch", "pull request", "merge"], ["long job"], ["account"]]));
test("ids are stable: listing twice gives the same ids", () => assert.deepEqual(ids(listItems("7", run)), ids(listItems("7", run))));
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the item lister"`.

### Task 22: The canary builder (M)

**Carries out:** tools: Canary builder 1–6; branch: canaries.md; tools: Thresholds 6 (passed canaries become calibration items); SKILL: never "reads the canary key".

**Files:** Create `checks/canaries.ts`, `tests/checks/canaries.test.ts`.

**Interfaces:**
- Consumes: `Item`, `listItems` (Task 21); `Language.mutations` (Task 9); `GatheredPiece` (Task 13); `QUESTIONS` (Task 20).
- Produces:
```ts
export interface Canary { item: Item; kind: string; copyRoot: string }
export interface CanaryRound { all: Item[]; isCanary(id: string): boolean; jevCounts(id: string): boolean; reveal(): Record<string, string> }
export function canaryCount(realItems: number): number
export function buildCanaries(step: StepId, items: Item[], run: RunView, rng: () => number): CanaryRound
```
Kinds, drawn from the step's own items: `clause_carried`, a single break from the mutation runner's operators inside a clause's cited lines; `q1_own` and `q1_other`, a piece asked against a sentence of its own CLAUDE.md that shares fewest key words with it; `serves`, the file with a neighbour's function pasted in; `whole`, the mark put on a rule tied to one file; `exempt`, a counted file moved under `tests/`; `message_kind`, a mechanical question logged as kind (b); `put_off`, a doer-deferred item whose fix is a test the run could write; `conceptual_item`, a C item whose description says the opposite of its diff; `correct` at step 0, a narrowed test command shown as the fixed one.

- [ ] **Step 1: Write the failing tests:**
```ts
test("at least 3 canaries per checkpoint, or 5% of the items, whichever is more", () => { assert.equal(canaryCount(10), 3); assert.equal(canaryCount(161), 9); });
test("canaries are drawn from the step's own question types, and never from a script-decided fact", () => { … });
test("each canary is built in a temporary copy outside the repo, with real-looking ids, shuffled among the real items", () => { … });
test("on a may-only-fail type, a canary is judged by the Claude checkers; Jev's answer on it is calibration data only", () =>
  assert.equal(round.jevCounts(canaryOf("clause_carried")), false));
test("nothing on disk marks a canary until reveal is called", () => {
  const round = buildCanaries("tie", items, run, rng(7));
  assert.ok(!grepRunFolder(run.paths.root, round.all.filter(i => round.isCanary(i.id)).map(i => i.id).join("|"), /canary/));
});
test("reveal returns the key once, after which canaries are added to the calibration set as known wrong when a checker passed them", () => { … });
```
- [ ] **Step 2–5:** run (fail), implement (the key is a closure inside the checkpoint process), run (pass), commit: `"verify-rules: the canary builder"`.

### Task 23: The conversation check (M)

**Carries out:** tools: Gate job4.1–4.3; tools: Conversation check 1–5; tools: Question log 2, 3 (moved here from Task 4: a change merged from main through someone else's reviewed pull request is logged with that pull request's link as its approval); branch: reading-approvals.md (approvals in the live transcript); branch: resume.md (never act on a remembered approval).

**Files:** Create `run/conversation.ts`, `tests/run/conversation.test.ts`, `tests/fixtures/transcript.jsonl` (made-up lines in the measured shape). Modify `run/question-log.ts` (`logPullRequestApproval`) and `tests/run/question-log.test.ts`.

**Interfaces:**
- Consumes: `LoggedQuestion`, `questions`, `recordAnswer` (its `at` is the typed message's timestamp, as a Date), `setAskedMessageId` (Task 4).
- Produces:
```ts
export interface UserMessage { uuid: string; timestamp: string; text: string }
export function transcriptPath(sessionId: string, home: string): string | null    // ~/.claude/projects/*/<id>.jsonl
export function userMessages(jsonl: string): UserMessage[]
export function doerModel(jsonl: string): string | null
export function heard(jsonl: string, questionText: string): UserMessage | null
export function confirmApproval(jsonl: string, quote: string): UserMessage | null
export function unloggedQuestions(jsonl: string, logged: LoggedQuestion[]): string[]
export function sentIn(jsonl: string, questionText: string): UserMessage | null   // the assistant message that holds the exact text
// in run/question-log.ts, chained into the record like every question:
export function logPullRequestApproval(p: RunPaths, a: { items: readonly string[]; link: string; text: string }): LoggedQuestion
```
Measured in this session's transcript: a message the user typed has `type: "user"` and `origin.kind: "human"`, and is not `isMeta`, `isCompactSummary` or `isSidechain`; tool results, task notifications and peer messages have other shapes. The doer's model is `message.model` of the session's assistant entries. The session id is `CLAUDE_CODE_SESSION_ID`.

- [ ] **Step 1: Write the failing tests:**
```ts
test("only messages a person typed count", () => assert.deepEqual(userMessages(FIXTURE).map(m => m.text), ["/verify-rules", "$5 and 20 Claude runs", "approve M1 and C2"]));
test("tool results, task notifications, peer messages, meta entries and context summaries never count, even when marked as the user's", () => { … });
test("heard finds the first typed message after the assistant message that holds the question's exact text", () =>
  assert.equal(heard(FIXTURE, "What may this run spend? …")!.text, "$5 and 20 Claude runs"));
test("an approval counts only when its exact text is a typed message", () => { assert.ok(confirmApproval(FIXTURE, "approve M1 and C2")); assert.equal(confirmApproval(FIXTURE, "approve all"), null); });
test("the doer's model is read from the assistant entries", () => assert.equal(doerModel(FIXTURE), "claude-opus-5-5"));
test("an unreadable transcript confirms nothing", () => assert.equal(confirmApproval("not json", "x"), null));
test("assistant paragraphs ending in a question mark that are not in the log are listed", () => assert.deepEqual(unloggedQuestions(FIXTURE, logged), ["Should I also fix the tests?"]));
test("sentIn finds the assistant message that holds the question's exact text, whose uuid becomes the question's askedMessageId", () => { … });
test("a change merged from main is logged with its pull request's link as its approval, and counts as approved without a typed message", () => { … });
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the conversation check reads the live transcript"`.

### Task 24: The gate, part A: the start of a run (L)

**Carries out:** tools: Gate 1, job1.1–1.5, job5.1–5.4, 9, 15; tools: Record 6; tools: Record 3.3 (step 0: `verifyRecord`'s problem fails the step and is shown to the user); tools: Status writer 4 (each test command is a long job whose progress file the status file names); tools: Situation detector 7; tools: Run folder 2; SKILL: step 0 (v1 parts: run folder before any question, budgets, worktree, baseline, test commands, both checkers, situation); branch: test-commands.md, budget.md, other-people.md (worktree and uncommitted work only; the rest is milestone L11), resume.md, checker-unusable.md.

**Files:** Create `checks/gate.ts`, `tests/checks/gate-start.test.ts`.

**Interfaces:**
- Consumes: everything from Tasks 1–23. In particular: the start facts are `append`ed (Task 2); every state read is `checkedState` and every write `updateState` (Tasks 1–2); a resume runs `verifyRecord(p, repo, branch)` (Task 2) before anything else; the status file is written with `writeStatus(p, { now, doing, unpaid, jobs, events })` (Task 3); `heardCommand` sets the question's `askedMessageId` from `sentIn` (Task 23) and then its answer with `recordAnswer` (Task 4); each checkpoint commit carries `trailers(p, step, round)` (Task 2).
- Produces: the CLI `node checks/gate.ts <command>` and these functions:
```ts
export interface StartArgs { repo: string; scope: string; python: string; tests: { name: string; command: string }[]; runsBase: string; now?: Date }
export async function start(a: StartArgs): Promise<RunPaths>          // command: start
export async function heardCommand(p: RunPaths, questionId: string): Promise<LoggedQuestion>   // command: heard <id>
export async function probe(p: RunPaths, model: string): Promise<ClaudeRun>                    // command: probe --model <id>
export function chooseBaseline(repo: string, branch: string): { baseline: string; how: string }
```

- [ ] **Step 1: Write the failing tests** (toy repo; fake Jev; fake claude):
```ts
test("a dirty working tree is refused, with the uncommitted paths listed and never included", async () => { … });
test("the run folder exists before the first question, outside the repo", async () => { … });
test("the worktree and branch come from the named clean commit, and the first commit names the start commit and the baseline", async () =>
  assert.match(firstCommitMessage(p), /^verify-rules: start of run\n\nStart commit: [0-9a-f]{40}\nBaseline: [0-9a-f]{40} \(start commit\)/));
test("the baseline is the start commit, or the merge-base with the default branch when the branch has earlier commits, or the start commit without a default branch", () => { … });
test("each test command runs in full in the worktree; its output is saved and a failure is a known failure", async () => { … });
test("the budget question, with its estimate, is logged before any Jev request, and no request is sent before the answer is heard", async () => { … });
test("both checkers are tested through the gate: a Claude probe reporting its own id, and one Jev request served by typesafe-ai", async () => { … });
test("situations A and B stop the run with the plain message", async () => { … });
test("the start facts are in the record", async () =>
  assert.deepEqual(keys(startFacts(p)), ["baseline", "budgets", "checkers", "doerModel", "jev", "knownFailures", "repo", "situation", "startCommit", "testCommands"]));
test("start on an existing run folder runs verifyRecord (the chain, every captured output, this run's trailers) and resumes at the first item not passed", async () => { … });
test("a record problem at step 0 fails the step and names the problem, word for word", async () => { … });
test("while a test command runs, the status file names its progress file under Long jobs", async () => { … });
test("heard sets the question's sent message id from the transcript before its answer; a question never seen sent stays unanswered", async () => { … });
test("a probe is recorded like any checker run", async () => { … });
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the gate starts a run"`.

### Task 25: The gate, part B: each item's three checks (L)

**Carries out:** SKILL: "The checkpoint" (correct per thing done, same per item on a script's proof, complete per thing required; an item finishes only when all three pass); tools: State-builder 3, 8, 9; tools: Gate 10–14; tools: Record 7 (every item answer is written by the gate with `addAnswer`, from the captured Jev response or checker output; the doer never types one); branch: jev-unsure.md, checker-unusable.md; SKILL: never "marks its own item or step as passed".

**Files:** Modify `checks/gate.ts`. Create `tests/checks/gate-items.test.ts`.

**Interfaces:**
- Consumes: `addAnswer`, `capture`, `checkedState` (Task 2); `logQuestion` (Task 4); `CONTINUE_SENTENCE`, `setOpen` (Task 5).
- Produces: `export async function runStep(p: RunPaths, step: StepId): Promise<{ done: number; total: number; queuedForSecond: string[] }>` (command: `run <step>`) and `export function decideItem(item: Item, script: boolean | null, jev: Reading | null, claude: "PASS" | "FAIL" | "no answer" | null, second: "PASS" | "FAIL" | null): "passed" | "failed" | "waiting"`.
- Each answer is saved the moment it arrives with `addAnswer(p, item, answer, outputFile)`, whose output file is the saved Jev response under `jev/` or the checker's captured output under `checkers/`. The gate reads the state only with `checkedState`, and sets an item's status only from `decideItem` over its checked answers; a state whose item status does not follow from its answers is refused. The "continue?" question after a checker cannot be used is kind (b), names the step's open items in `items`, and ends with `CONTINUE_SENTENCE`, so `continued-by-user` can cite it.

- [ ] **Step 1: Write the failing tests:**
```ts
test("an item's three checks are sent as soon as the item is done, one request per question", async () => { … });
test("an unsure Jev answer waits for the second Claude checker and is never a pass", () => assert.equal(decideItem(it, true, "UNSURE", "PASS", null), "waiting"));
test("an item with no registered builder goes to both Claude checkers", () => { … });
test("a script failure is never overruled by a checker's yes", () => assert.equal(decideItem(it, false, "PASS", "PASS", "PASS"), "failed"));
test("may only fail: Jev below the fail line fails the item; above it, the script and Claude decide", () => { … });
test("the step cannot pass until every item has a recorded answer for each check", async () => { … });
test("each answer is saved the moment it arrives, and a rerun resumes at the first item without all its answers", async () => { … });
test("an answer typed into state.json is refused: no answer entry of the record holds it", async () => { … });
test("an item set to passed in state.json without the answers that pass it is refused", async () => { … });
test("a checker that cannot be used stops the step after 3 retries and asks whether to continue", async () => { … });
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the gate checks each item three ways"`.

### Task 26: The gate, part C: the checkpoint round (L)

**Carries out:** tools: Evidence 1–7, 9–16, 21 (8, the golden coverage tables, is milestone L7); tools: Evidence 17 (the pack's evidence is only what counts: command outputs, file excerpts, diffs, script tables, quoted messages with ids, saved Jev responses and captured verdicts, each captured output named by hash); tools: Gate job1.4–1.5, 5 (stray executables); tools: Record 3.2, 3.5; tools: Record 7 (each checker's step verdict is appended as a `verdict` with its captured output); tools: Launcher 6; branch: step-fails.md, canaries.md; SKILL: "The checkpoint" (both checkers pass the step in the same round, every canary caught).

**Files:** Modify `checks/gate.ts`. Create `tests/checks/gate-checkpoint.test.ts`.

**Interfaces:**
- Consumes: `append`, `capture`, `checkedState`, `trailers`, `verifyRecord` (Task 2); `withLock`, `updateState` (Task 1); `logQuestion` (Task 4); `CONTINUE_SENTENCE` (Task 5).
- Produces: `export async function checkpoint(p: RunPaths, step: StepId): Promise<{ round: number; result: "passed" | "failed" | "void"; failing: string[]; commit: string }>` (command: `checkpoint <step>`) and `export function buildPack(view: RunView, step: StepId, round: CanaryRound): string`.
- Each Claude checker's step verdict is `append`ed as `verdict` with `output: capture(p, "checkers/<run>.json")`, before the canary key is revealed; the checkpoint commit's message ends with `trailers(p, step, round)`. The "continue?" question after 3 rounds is kind (b), names the failing items in `items`, and ends with `CONTINUE_SENTENCE`.

- [ ] **Step 1: Write the failing tests:**
```ts
test("the pack is built by script only: step text and checklist from the snapshot, every item with state, answers and evidence, counts, test outputs in full or 'not run', the tie check's full output and broken list against the baseline, git status and diff stat, question-log extracts, open and declined items, stray executables, spend", () => { … });
test("canaries appear in the pack laid out like real items, unmarked", () => { … });
test("the verdict is the parser's, with canaries left out; the step passes only if every item passed, both checkers passed the step in this round, and every canary was caught", async () => { … });
test("a passed canary voids the round; void rounds count; after 3 rounds the run asks whether to continue, with the script-written message", async () =>
  assert.match(lastQuestion(p).text, /If you continue, this step stays unchecked\.$/));
test("every verdict is chained with its captured output before the key is revealed, and the checkpoint commit carries the trailers, its run's name first", async () => { … });
test("a captured verdict file changed after it was chained fails the checkpoint, naming the file", async () => { … });
test("every evidence line in the pack is one of Evidence 17's kinds; a typed claim such as 'tests pass' never is", () => { … });
test("a step that changed no file makes an empty commit with only the trailers", async () => { … });
test("a kill during the round leaves the state valid and the round void; the next checkpoint is the next round with new canaries", async () => {
  const child = spawnCheckpoint(p, "7"); await waitForChecker(); child.kill("SIGKILL");
  assert.doesNotThrow(() => checkedState(p)); const r = await checkpoint(p, "7"); assert.equal(r.round, 2); assert.notDeepEqual(canaryIds(1), canaryIds(2));
});
test("a pack over 600,000 characters is refused, with its size", async () => { … });
test("an executable file in the run folder that is not a shipped tool is listed by hash, as an item for checker 1", async () => { … });
```
- [ ] **Step 2–5:** run (fail), implement (port `pack.py`; the whole round runs in one process so the canary key never leaves memory), run (pass), commit: `"verify-rules: the gate runs a checkpoint round"`.

### Task 27: The gate, part D: the proofs of "same" (M)

**Carries out:** tools: Gate 6, 7, 8 (the import adapter is milestone L7); tools: Evidence 5, 7, 9; tools: Exempt-list 11; branch: general-or-specific.md (the specific-rule count against the baseline).

**Files:** Modify `checks/gate.ts`. Create `tests/checks/gate-same.test.ts`.

**Interfaces:**
- Produces: `export async function sameProofs(p: RunPaths, step: StepId): Promise<{ id: string; ok: boolean; detail: string }[]>`.

- [ ] **Step 1: Write the failing tests:**
```ts
test("the test list is compared by name with the baseline's, and a missing test fails", async () => { … });
test("every baseline test's assertions are diffed; a changed or removed assertion is an item for checker 1 (all 8 replaced by 'assert True')", async () => { … });
test("a new broken item fails even when the suite already read '1 failed, 11 passed' at the baseline", async () => { … });
test("the skill's tie check and the repo's own check are compared; a difference is a finding and an item for checker 1", async () => { … });
test("the count of specific rules and of exempt files per group may not change without a numbered approved item", async () => { … });
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the gate's proofs of same"`.

### Task 28: The tie-stage check, the user's four parts (L)

**Carries out:** tools: Tie-stage check 1–21, p3b.1–5, p4.6–16 (p4.14's "the same code in two files" is milestone L4), conditions 17–20; tools: Gate 10–14 (the tie-stage rows); SKILL: core 4; SKILL: step 12 (the check, without the tie writer: milestone L1); SKILL: target 2, 3, 4; branch: general-or-specific.md, file-does-more.md (detection), untestable-clause.md.

**Files:** Create `checks/tie-stage.ts`, `tests/checks/tie-stage.test.ts`, `tests/helpers/toy-tied-repo.ts` (a toy Python repo with four tied files, one whole-folder rule and planted faults). Modify `run/items.ts` (`listItems("tie")` returns `tieStageItems`).

**Interfaces:**
- Consumes: `tieCheck` (Tasks 10–11); `clauseTable` (Task 7); `functionToClause`, `candidateRules`, `sharedOutputs` (Task 13); `runTable` (Task 14); `Item` (Task 21); the gate's `decideItem` (Task 25).
- Produces:
```ts
export interface TieStageScripts { part1: { rule: RuleRef; file: string | null; ok: boolean; why: string }[];
  headings: { file: string; ok: boolean }[]; clauses: Map<string, { table: ReturnType<typeof clauseTable>; rows: MutationRow[] }>;
  tables: Map<string, PieceRow[]>; candidates: Map<string, RuleRef[]>; part4Script: Broken[]; findings: Finding[] }
export async function tieStageScripts(run: RunView, ctx: { languages: readonly Language[]; cap: number }): Promise<TieStageScripts>
export function tieStageItems(s: TieStageScripts, run: RunView): Item[]        // used by listItems("tie")
export function tieStageVerdict(s: TieStageScripts, answers: ReadonlyMap<string, "passed" | "failed" | "waiting">): {
  parts: Record<"1" | "2" | "3" | "4" | "conditions", "passed" | "failed" | "waiting">; perRule: Map<string, string>; perFile: Map<string, string> }
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("part 1: a specific rule with no file, or naming a missing file, fails at once; Jev is asked only on the script's output", async () => { … });
test("part 2, per clause: a clause passes only with the mutation runner's 'tested' and checker 1's PASS; Jev's state holds no test output", async () => { … });
test("part 2, per rule: every clause passes first, then the clause-list question and checker 1", async () => { … });
test("part 3: a counted file with no rule fails at once; every extra piece is a finding whose ending is later-version", async () =>
  assert.deepEqual(extra(s), ["dots.py: network_output"]));
test("part 3: question 1 per mapped piece against all its mapped sentences, the weak per-file question, and checker 1 per file", async () => { … });
test("part 4: two rules naming one file, a shared bold sentence and one output written by two files fail by script", async () => { … });
test("part 4: question 1 per piece and candidate rule, then per sentence only for rules above the fail line", async () => {
  assert.ok(items.filter(i => i.question === "q1_other").length < perSentenceCount);   // LodeSTAR problem 1
});
test("conditions: headings word for word; every general rule classified blind with specific as default; whole-folder marks agree with the class; exempt files placed", async () => { … });
test("a rule is general only when Jev's p is below the fail line, the Claude checker says general, and the key-noun fact agrees", () => { … });
test("the four parts run in the user's order: no item of a part is sent before the part before it has every answer", async () => { … });
test("the toy repo's planted faults are each caught by the part the user meant for it", async () => {
  assert.equal(caughtBy("hole filling removed"), "2"); assert.equal(caughtBy("a neighbour's function pasted in"), "3");
  assert.equal(caughtBy("hit counting moved into the graph file"), "4"); assert.equal(caughtBy("whole-folder mark on a one-file rule"), "conditions");
});
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the tie-stage check, in the user's order"`.

### Task 29: The effect script (M)

**Carries out:** tools: Effect script 1–5; branch: is-it-mechanical.md; tools: List builder 1 (the M header); SKILL: core 7.

**Files:** Create `rules/effect.ts`, `tests/rules/effect.test.ts`.

**Interfaces:**
- Consumes: `readAll` (Task 6); `clauseTable` (Task 7); `tieCheck` (Task 10).
- Produces:
```ts
export interface Effect { mechanical: boolean; sameClauses: boolean; sameCoveredFiles: boolean; sameSpecificRules: boolean;
  stopsApplyingTo: string[]; startsApplyingTo: string[]; diff: string }
export function effectOf(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>, repo: RepoView, cfg: ExemptConfig, languages: readonly Language[]): Effect
export function mechanicalHeader(items: { effect: Effect | null; byUserDecision: string | null }[]): string
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("a word-for-word move that covers the same files is mechanical", () => assert.equal(effectOf(b, movedSameScope, repo, cfg, langs).mechanical, true));
test("'No Cellpose' moved from the global CLAUDE.md into the models CLAUDE.md shows 0 word changes and is conceptual", () => {
  const e = effectOf(b, cellposeToModels, repo, cfg, langs);
  assert.deepEqual([e.sameClauses, e.mechanical, e.stopsApplyingTo], [true, false, ["dataset/", "experiments/"]]);
});
test("a number reference replaced by the rule's bold sentence keeps the same clauses", () => { … });
test("a rule that stops being specific is conceptual", () => { … });
test("a C item's diff opens 'Removes from the rule: '…'. Adds: '…'. Stops applying to: …. Code changes: none'", () => { … });
test("the M header counts what the script checked, and a non-zero count is reported", () =>
  assert.equal(mechanicalHeader(ms), "3 items. Of the 1 items the effect script checks, 0 change a clause, 0 change which code a rule applies to, and 0 remove a rule's need for a file. 2 items are mechanical by the user's decision: standing item: 1, missing exempt groups: 1."));
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the effect script"`.

### Task 30: The list builder and the reading of the answer (M)

**Carries out:** tools: List builder 1–9; branch: asking-the-user.md (kind a; batched; with recommendations); branch: reading-approvals.md (strict reading; bulk confirmation); branch: tie-gap.md (the standing item); SKILL: core 7; SKILL: steps 8 and 9 (version 1 parts).

**Files:** Create `rules/lists.ts`, `tests/rules/lists.test.ts`.

**Interfaces:**
- Consumes: `Effect`, `effectOf`, `mechanicalHeader` (Task 29); `logQuestion` (Task 4). The lists message is logged as kind (a) with every item of both lists in `items`, so `user-unanswered` and `user-deferred` (Task 5) can cite it.
- Produces:
```ts
export interface PlannedChange { id: string; findings: string[]; kind: string; claude: string; before: string;
  options: { label: string; after: string }[]; recommended: number; what: string; why: string; dependsOn: string[];
  byUserDecision: string | null; weakens: boolean }
export interface Lists { mechanical: { number: string; change: PlannedChange }[]; conceptual: { number: string; change: PlannedChange; effects: Effect[] }[];
  header: string; message: string; detailFile: string }
export function buildLists(changes: PlannedChange[], effects: ReadonlyMap<string, Effect[]>, detailDir: string): Lists
export type Decision = { item: string; decision: "approved" | "declined" | "unanswered"; option: number | null; quote: string };
export function readAnswerScript(answer: string, lists: Lists): { decisions: Decision[]; needsConfirmation: string | null }
```

- [ ] **Step 1: Write the failing tests:**
```ts
test("the M list: one line per item, grouped by kind with a count, numbered M1…, opened by the script's header, with full detail saved", () => { … });
test("the standing item about a tie with an open gap is always on the M list", () => assert.match(l.mechanical.map(m => m.change.what).join("\n"), /remove both halves of its two-way tie in the same commit/));
test("the C list puts the items that weaken a rule, remove a file a rule needs or put work off first, under their heading, with their count", () =>
  assert.match(l.message, /These make a rule weaker, remove a file a rule needs, or put work off: 2/));
test("each C item opens with its recommended option's diff; every option shows its own diff and exact text", () => { … });
test("the default recommendation is 'fix the code' where code and rule disagree; any other is flagged for checker 1", () => { … });
test("dependencies are stated: 'goes with C4'", () => { … });
test("reading: numbers, 'approve all of M', 'approve all', a bare 'ok' asks for one confirmation with the counts and the first group by number, 'you decide' takes the recommendation, 'no' declines", () => {
  assert.equal(readAnswerScript("ok", l).needsConfirmation, "All 4 mechanical and 3 conceptual items? This includes the 2 that make a rule weaker, remove a file a rule needs, or put work off: C1 and C2.");
  assert.deepEqual(decisionsOf(readAnswerScript("approve M1 and C3, no to C2", l)), [["M1", "approved"], ["C2", "declined"], ["C3", "approved"]]);
});
test("'ok' to an item with several options chooses nothing", () => { … });
```
- [ ] **Step 2–5:** run (fail), implement (port `lists.py`'s `diff`), run (pass), commit: `"verify-rules: the two lists and the strict reading of answers"`.

### Task 31: The end-of-run report (S)

**Carries out:** tools: End-of-run report 1–4; SKILL: "How a run ends"; SKILL: core 3; tools: Gate job4.3.

**Files:** Create `run/report.ts`, `tests/run/report.test.ts`.

**Interfaces:**
- Consumes: `RunState` (Task 1); `firstLineCounts` (Task 5); `TieReport` (Task 10); the record: `entries`, `append`, `checkedState` (Task 2); the approval quotes from `questions` (Task 4).
- Produces: `export function firstLine(s: RunState, tie: TieReport): string`, `export function endState(s: RunState): { done: boolean; text: string }`, `export function report(p: RunPaths): string` (command: `report`).

- [ ] **Step 1: Write the failing tests:**
```ts
test("the first line comes from the item states, in the fixed form", () =>
  assert.equal(firstLine(s, tie), "Tied both ways: 3 of 4 specific rules, and 3 of 4 counted files. Open: 9 (waiting on you: 2; put off by the doer: 1; other: 6). Declined by you: 1."));
test("firstLine takes no text from the doer: its only inputs are the state and the tie report", () => assert.equal(firstLine.length, 2));
test("the end state is 'done' only with every step passed and nothing open; a version-1 run is always 'incomplete: <list>'", () => { … });
test("the report prints every approval quote with its date, the spend beside the estimate, Claude usage, and the run folder's path as temporary", () => { … });
test("the first line is written into the record by the gate, before the report is posted", () => { … });
```
- [ ] **Step 2–5:** run (fail), implement, run (pass), commit: `"verify-rules: the end-of-run report"`.

### Task 32: The version-1 steps, wired end to end (L)

**Carries out:** tools: Per-step checklists for steps 0, 7, 8, 9 (v1 parts), 12 (as the tie stage) and 14; tools: Record 3.3 (step 14 runs `verifyRecord`; a problem fails the step); tools: State-builder 12 (a fact builder per done-when item); branch: clause-audit.md (reviewers, one per CLAUDE.md, at most 40 clauses); branch: final-check-fails.md; SKILL: steps 0, 7, 8, 9, 14; SKILL: core 3 (the final check, the whole-process question, the shortcut audit).

**Files:** Modify `checks/questions.ts` (`FACTS` for every done-when item of the v1 steps), `checks/gate.ts` (commands `review`, `submit`, `lists`, and step 14's final check, whole-process question and shortcut audit). Create `tests/e2e/v1-run.test.ts`, `tests/helpers/honest-checker.ts`.

**Interfaces:**
- Consumes: everything above.
- Produces: the commands `review` (starts the reviewers and parses their answers into citations), `submit <kind> <file>` (kinds: `citation-fix`, `clause-cut`, `clause-kind`, `search-test`, `finding-group`, `planned-change`, `put-off`, `reading`; each submission is validated by schema and becomes an item for the correct check), and `lists`.

- [ ] **Step 1: Write the failing tests:**
```ts
test("every done-when item of the version-1 steps has a fact builder, and no fact is typed by the doer", () => {
  for (const id of doneWhenIds(["0", "7", "8", "9", "tie", "14"])) assert.ok(FACTS[id] || laterVersion(id), id);
});
test("a whole version-1 run on the toy repo with honest fake checkers ends with the script's first line and 'incomplete: <steps not in version 1>'", async () => { … });
test("the same run with a fake checker that passes everything is caught: the round is void, and the second time the checker cannot be used", async () => { … });
test("the honest fake catches every canary, and the run's findings are the toy repo's planted faults", async () => { … });
test("a step-14 item that fails goes back to the step that owns it", async () => { … });
test("killing the run between steps and starting it again resumes, and verifyRecord passes: the chain, every captured output and every trailer of this run", async () => { … });
```
`honest-checker.ts` is a fake `claude` and a fake Jev that compare each item's quoted file text with the worktree and fail any item whose text differs; it stands in for a careful checker, which the gate cannot tell from a real one.
- [ ] **Step 2–5:** run (fail), implement, run `npm test && npm run typecheck` (pass), commit: `"verify-rules: version-1 steps wired end to end"`.

### Task 33: The instructions say how to run version 1 (S)

**Carries out:** tools: Root 8 (the doer uses the tools, never does their job by hand); SKILL: "How a run goes" (a smaller model can follow it); branch: long-job-duties.md (the doer sends the phone push; the gate writes when one is due).

**Files:** Modify `verify-rules/SKILL.md` (a short section "Running version 1", after "How a run goes"); `checks/gate.ts` (command `help`). Create `tests/checks/gate-help.test.ts`.

- [ ] **Step 1: Write the failing test:** `test("every command SKILL.md names is one gate help lists, and the other way round", …)`.
- [ ] **Step 2: Run** and see it fail.
- [ ] **Step 3: Write the section**: the commands in order (`start`, `heard`, `run 0`, `checkpoint 0`, `review`, `submit`, `run 7`, `checkpoint 7`, `run tie`, `checkpoint tie`, `run 8`, `checkpoint 8`, `lists`, `heard`, `run 9`, `checkpoint 9`, `run 14`, `checkpoint 14`, `report`), when to send the phone push (whenever the status file says one is due; each push names the run folder and the status file's record hash, so the user keeps copies of the hash), and what version 1 does not do, in plain words. Implement `help` from one table both use.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `verify-rules/SKILL.md`, `checks/gate.ts` and the test: `"verify-rules: how to run version 1"`.

### Task 34: Calibrate version 1's states on a pinned Jev version (M) — the calibration task, part 2. Needs the user's go.

**Carries out:** tools: Jev client 7 (pin and record); tools: Thresholds 4–9 (calibrated on the registered states; again when the model id changes); tools: State-builder 11 (one registered state per type).

**Files:** Modify `checks/calibration/items.jsonl`, `checks/calibration/thresholds.json`, `checks/jev.ts` (`JEV_MODEL`), `docs/tools.md` (the thresholds table, if values move). Create `tests/calibration/rebuild.test.ts`.

- [ ] **Step 1: Ask the user's go** for about 574 Jev calls (about $0.05; price read from the gateway's model list), with the money budget it uses.
- [ ] **Step 2: Write the failing test:** `test("each live-test and loophole-hunt item is rebuilt with version 1's registered builder, on the clean copy or its planted fault", …)`, checking that every item id of `items.jsonl` with `source` "live test" or "loophole hunt" has a rebuilt state whose builder is registered.
- [ ] **Step 3: Implement the rebuild** in the test helper: read the items and faults from `…/stress-ties/harness/items.py`, `faults.py` and `labels-p1a.json` and `…/stress-loopholes/reqs*.json`, apply each fault to a copy of `…/stress-ties/clean`, and build each state with `buildStates`. If those scratch folders are gone, rebuild the faults from the live test's list in tools.md and say so in the commit.
- [ ] **Step 4: Send** the rebuilt states through `askJev` on `typesafe-ai/jev-1.13.0` and on `typesafe-ai/jev-1.14.0` (tools: Jev 6: these are new requests, not replays). Save the answers as new items (`source: "v1 calibration <version>"`).
- [ ] **Step 5: Choose** the version with no false pass at its computed thresholds and the fewest unsure answers; on a tie, the newer. Set `JEV_MODEL`, recompute `thresholds.json`, and update `docs/tools.md`'s table where values moved.
- [ ] **Step 6: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 7: Commit** with every changed threshold listed: `"verify-rules: Jev pinned to <version>; thresholds calibrated on version 1's states"`.

### Task 35: Measure the mutation cap (M). Needs the user's go.

**Carries out:** tools: Mutation runner 9 (a cap per clause, to be calibrated).

**Files:** Modify `code/mutate.ts` (the cap's value). Create `tests/code/mutate-cap.test.ts`.

- [ ] **Step 1: Ask the user's go** for a local measurement run: the LodeSTAR clauses' mutations at a cap of 64, on a copy of senior-thesis-research at `e3cb238` (only `experiments/` changed since; measured), with progress lines and a resumable table (about 1 to 2 hours; no money).
- [ ] **Step 2: Run** `node checks/gate.ts measure-cap --repo <copy> --scope models/lodestar --cap 64` (a gate command added in this task, test-first: `test("measure-cap records, per clause, the rank of its first killing mutation in targeting order", …)`).
- [ ] **Step 3: Set the cap** to the smallest number that keeps every kill found at 64. Write the measured ranks and times into the commit message.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `"verify-rules: mutation cap set by measurement"`.

### Task 36: Probe the checker models (S). Needs the user's go.

**Carries out:** tools: Launcher 9 (the ranking table built and tested before release); tools: Gate 15 (probe mode).

- [ ] **Step 1: Ask the user's go** for one probe per candidate (claude-fable-5-2, claude-mythos-5-2, claude-fable-5-1, claude-mythos-5-1, claude-fable-5, claude-sonnet-5-5), about $1 to $3 at list price, and for the user's yes or changes to the ranking order (a judgment).
- [ ] **Step 2: Run** `node checks/gate.ts probe --model <id>` for each, through a throw-away run folder.
- [ ] **Step 3: Record** which ids this account can run and the id each reports. Adjust `RANKING`'s notes, never its order, unless the user said so. Run `npm test`.
- [ ] **Step 4: Commit**: `"verify-rules: checker models probed"`.

### Task 37: The acceptance test: a real version-1 run on a copy of `models/lodestar` (L). Needs the user's go.

**Carries out:** SKILL: core 17 (stress-tested before use); every task above, on the real thing.

**Files:** Create `tests/acceptance/lodestar-expected.json`, `tests/acceptance/compare-lodestar.ts` (reads a run folder and prints PASS or MISS for each expected finding; exits 1 on a miss).

- [ ] **Step 1: Write `lodestar-expected.json`** from the LodeSTAR test report, section 1. Findings are named by file and text, never by the old run's rule ids:

| # | Expected finding | How version 1 finds it | Measured or inferred (report) |
|---|---|---|---|
| E1 | The bold sentence "LodeSTAR" of the rule "**LodeSTAR** is the LodeSTAR class from the deeplay library, used as it is." is also the bold label of the global tree's LodeSTAR entry | tie check: broken, shared bold sentence | measured |
| E2 | That rule's whole-folder mark is disputed: the class question reads it as one file's job, and the whole-folder question does not pass it | tie stage conditions; the rule stays specific and gets a C item "Is this a rule for one file, or for the whole folder?" | measured |
| E3 | `models/lodestar/CLAUDE.md` line 14 ("LodeSTAR is everything in the LodeSTAR folder…") stands outside any rule | tie check: broken, stray line | measured |
| E4 | The train rule's clause "Its crops show only the target object, as the datasets' rules require" cannot be tested in `train.py` | mutation runner: "not testable here: code lives in another file" | measured |
| E5 | The outline rule's "(the experiments choose it on the training pictures)" is not carried out in `outline.py` | mutation runner: "not testable here: code lives in another file", or a gap | measured |
| E6 | The deeplay-class rule has no test at all | clause audit: gap to check | measured |
| E7 | "These steps are plain image processing, not a trained step" has no test (it needs a search test) | gap to check | measured |
| E8 | "Nothing has to use it" (optimal threshold) has no test | gap to check | measured |
| E9 | The 5,000-steps test checks only the function's default, not what the trainer receives | call-site check; the clause is not tested | measured |
| E10 | Forms that have no crops are not covered | gap to check | measured |
| E11 | No search tests for "No Cellpose", "the code uses only listed libraries" and "a model never depends on a dataset" | general rules' clauses in the LodeSTAR folder: gaps to check | measured |
| E12 | Long jobs must show progress; `train.py` relies on Lightning's default bar | the general clause's verdict, a gap or a recorded judgment | inferred |
| E13 | No clause is credited with a mutation that breaks a different clause. The old run credited five wrongly (checker 1's FAIL lines in its run folder): "uses deeplay's own LodeSTAR training" with `5000 → 5001`; "the threshold is a quantile of that score" with `BORDER 3 → 4`; "training LodeSTAR itself, getting its internal layer, and training its readout" with the deleted `requires_grad_(False)` of the frozen clause; and the models CLAUDE.md's "the subfolder holds everything needed" and "includes its training functions, layer readers and hooks" with a kernel-size and a device-count change | element targeting, distinct citations, Claude confirmation | measured (by checker 1) |
| E14 | The repo's own tie check reports 0 broken while the skill's reports E1 and E3 | Task 27's comparison | measured |

Not expected from version 1, because their checks are later milestones: the save written five times and the models/experiments duplicate (L4, duplicates); the 10 missing and 6 partial system rules, the System Rules block and the conflict of global rules 1 and 10 (L2, step 1); the stray line in `models/CLAUDE.md`, which is not lowest-level (L2, hierarchy checks).

The run must also show: the record's chain verifies against every trailer; every checkpoint had at least 3 canaries and the Claude checkers caught every one; every Jev answer was served by `typesafe-ai` on the pinned version; the report's first line is in the record from the gate; and the shortcut audit finds none of the LodeSTAR test's four shortcuts (hand-typed facts, a hard-coded first line, a read canary key, a hand-edited mutation table).

- [ ] **Step 2: Write `compare-lodestar.ts`** test-first, against a small made-up run folder (`tests/acceptance/compare.test.ts`: one finding present, one missing → exit 1 and the missing one named).
- [ ] **Step 3: Ask the user's go**, and ask the user to start the run themselves by typing `/verify-rules` in a session on the copy: the budgets and every approval must be typed by the user (tools: Gate job4.1), so a subagent cannot run it. Estimate first with the budget keeper (the LodeSTAR test: 273 Jev calls cost $0.0165; 12 Claude runs cost about $16 at list price).
- [ ] **Step 4: Make the copy**: `git clone /home/user/senior-thesis-research <scratch>/v1-acceptance/repo && git -C <scratch>/v1-acceptance/repo checkout -b acceptance e3cb238`. The run's scope is `models/lodestar`; the Python interpreter is `/home/user/senior-thesis-research/.venv/bin/python`; the test command is `python -m pytest` at the repo root (the LodeSTAR test: 206 passed).
- [ ] **Step 5: The user runs it**; the doer follows SKILL.md's "Running version 1". The user may answer the lists or leave them: unanswered items end open with `user-unanswered`.
- [ ] **Step 6: Compare** with `node tests/acceptance/compare-lodestar.ts <run folder>`. Expected: every E1–E14 PASS and every structural check PASS. A miss goes back to the task that owns its check, with a new failing test first.
- [ ] **Step 7: Commit** the acceptance files and the comparison's output in the commit message: `"verify-rules: version 1 passes its acceptance run on models/lodestar"`. Then delete `docs/plans/v1-plan.md` in its own commit.

---

## Later milestones, one branch at a time

| # | Milestone | Branch files and tools |
|---|---|---|
| L1 | Writing approved changes: the mover, the word-for-word comparison, step 9's writing, the tie writer and the standing tie-gap item | rule-moves.md, tie-gap.md; tools: Mover, Word-for-word comparison, Tie writer |
| L2 | Step 1: the model text and structure check, the system rules, the System Rules block, conflicts (the item lister's pairs), the number search, the hierarchy checks | system-rules.md, system-rules-block.md, rule-conflict.md, number-reference.md, hierarchy-failure.md |
| L3 | The rule-scope chain (questions 2 to 8) and the endings of extra pieces | question-chain.md, file-does-more.md, rule-scope-examples.md |
| L4 | Duplicates: the duplicate finder, part 4's "same code in two files", the final check's duplicates | duplicates.md |
| L5 | Step 2: building or completing the repo's own tie check, test-first, in its language; CI paths; the generated-files exempt group | tools: Tie-check template 16–20, Exempt-list 4 (generated) |
| L6 | Steps 3 to 5: the folder plan, the full classification table, the map | folder-plan.md, general-or-specific.md, map-rules-files.md, untied-file-or-rule.md |
| L7 | Step 6 and step 10: the golden harness with its import adapter; the restructure with step agents | golden-capture.md, step-agents.md |
| L8 | Step 11 and late findings: the fix groups' proofs, the lateness script, the follow-up lists | fix-groups.md, late-finding.md |
| L9 | Step 13 and full budgets: the freshness script, kept results, the compute budget, Claude usage reports | kept-results.md, budget.md |
| L10 | Situations A and B: the interview and the empty-repo set-up; version folders | situation-a.md, interview.md, version-folders.md |
| L11 | Other people and dangerous actions: pull requests, ownership notes, the action guard | other-people.md, dangerous-action.md |
| L12 | More languages behind the interface: TypeScript, SQL, shell | tools: Tie-check 15 |
| L13 | Process rules checked against the run's own record; the quick check (open: C64) | clause-audit.md, quick-check.md |
| L14 | The mistakes list counted, and repeated mistakes made into checks | repeated-mistake.md; tools: Mistakes list |

## Points that need the user's confirmation

These are mechanical choices this plan makes where the approved design is silent or disagrees with itself. Each is in the report to the caller.

1. **The reason code `later-version`** (Task 5) is new. The design's code list is fixed, and no code fits work that the skill's version does not do yet.
2. **Three files outside the proposal's tree** (`code/language.ts`, `code/python.ts`, `code/python_ast.py`), and one generated file (`checks/instructions.json`). `python_ast.py` is Python, against "one language for every tool"; it uses only Python's standard library, under the target repo's own interpreter, which runs the tests anyway. The other way is tree-sitter in Node (`web-tree-sitter` with `tree-sitter-python`): everything in TypeScript, but its parse can differ from the interpreter's, and mutants could not be compiled before running.
3. **The instructions snapshot** exists because the install command copies only `verify-rules/`, so an installed copy has no `docs/tools.md` to quote from.
4. **The threshold values** of Task 16 differ from tools.md's table, which Task 16 then updates (see the report).
5. **The reviewer prompt and the checkers' prompts live in the launcher's file**, so the launcher's planned rule (C23) would also cover reviewers.
6. **"No two clauses cite the same lines"** is read as identical line sets.
7. **An unnamed rule in a lowest-level CLAUDE.md** is both listed as unnamed and broken, as the thesis repo's check does.
8. **An interrupted checkpoint round restarts** with fresh Jev requests and new canaries, because the canary key lives only in the checkpoint process. Items' own checks are saved and resume.

## Self-review against the spec

- **Coverage of version 1's scope.** (1) The four-part check: Tasks 10, 11, 13, 14, 28. (2) The three checks after each step: Tasks 20, 21, 25, 26, 27, 32. (3) The two lists and the question log: Tasks 4, 23, 29, 30. (4) Saving and resuming: Tasks 1, 2, 3, 24 (resume), 26 (kill test), 32 (resume across steps). (5) The gate that owns every check: Tasks 21 (item lister), 20 (state and fact builders), 22 (canaries), 31 (the first line), 24–27 (the gate). (6) The tools: Tasks 6 (rule reader), 10–11 (tie check), 7 and 14 (clause tables, mutation runner), 17 (Jev client), 18 (launcher). Calibration: Tasks 16 and 34. Acceptance: Task 37.
- **tools.md checks in version-1 sections that are left to milestones:** Gate 8's import adapter (L7); Evidence 8's golden tables (L7); Exempt-list 4's generated files (L5); Tie-stage p4.14's same code (L4); Item lister 1 (L2); Situation detector 3's system-rule test (L2); Budget's compute budget (L9). Each is a `later-version` item in a run, never silently skipped.
- **Type consistency:** `StepId`, `RunPaths`, `RunState`, `RunView` and `Finding` (Task 1); `Rule`, `RuleRef` (Task 6); `Clause` (Task 7); `Language`, `Piece`, `Mutation`, `TestOutcome` (Task 8); `TieReport`, `RepoView`, `ExemptConfig` (Task 10); `Citation`, `PieceRow`, `GatheredPiece` (Task 13); `MutationRow` (Task 14); `BuiltState`, `JevRequest`, `BudgetKeeper` (Task 17); `QuestionType` (Task 20); `Item` (Task 21); `Reading` (Task 16) are each defined once and used by those names later.
