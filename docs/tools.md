# The skill's tools

This is the specification the skill's tools are built from, test-first. Each section gives the tool's job, its
inputs and outputs, every check it must enforce, and the triggers it raises: the events that send the doer to a
branch file. Wherever these instructions once relied on the doer to notice something, a tool detects it and raises
the trigger, so that no branch can be forgotten. The trigger table in `verify-rules/SKILL.md` lists every trigger.

Claude's own mechanical choices for the skill (the exempt groups, how Jev is asked, the list of very dangerous
actions, how the fourth part of the tie-stage check is built) are written here and in the skill's files, not in the
CLAUDE.md files (decided as technical: the proposal's question Q5, audit fix 10).

**The tools ship pre-built and tested** (LodeSTAR test, problem 2). The doer never builds or edits the gate, the
item
lister, the fact builders, the canary builder or the mutation runner during a run: a doer who builds them writes
its
own exam. Measured in the LodeSTAR test: the shortcut audit found the doer hand-typing checklist facts, hard-coding
the
report's first line, reading the canary key, and hand-editing the mutation table.

## Where the skill lives

1. Decided by the user: the master copy is its own private GitHub repo,
   Rupertlim88/ClaudeMD-Repo-Verification-Skill. The user's computer holds a clone of it in the user's skills
   folder, so every local project sees the skill; a cloud session sees only what is in its repos, so there the
   skill folder is copied into the repo being checked, or the skill repo is added to the session.
2. In the user's words: "the way we make the skill folder is the exact same way as we've made this list of
   instructions we're making here", and "within the skill folder, you definitely need to add the [rule]" that the
   doer handles the mechanical details and the user the conceptual ones. So:
3. The skill repo is set up by this workflow itself, as situation (A): it holds these instructions (`verify-rules/`
   and `docs/tools.md`) and no CLAUDE.md yet (measured). The core, the user's decisions and the open points become
   its CLAUDE.md rules through the two lists, approved by the user.
4. Its files sit outside `.claude/`, and are tied both ways like any other code: each of the skill's files is tied
   to exactly one specific rule, and each specific rule to exactly one file.
5. Its skill file (`SKILL.md`) holds the core, the steps and the trigger table, and sets `disable-model-invocation:
   true`. Its branch files and its tools sit beside it.
6. Once its CLAUDE.md exists, it outranks these instructions, and these instructions become its lower-level doc
   (the core).
7. A repo being checked may hold a copy under `.claude/skills/verify-rules/`. That copy's master is the skill repo,
   so the exempt list does not count it there (tools: exempt-list builder).

8. The skill ships its tools with it. Each tool is built test-first and tested before the skill is released. The
   tools read text, so they work in a repo of any language; the heading reader and the piece cutter work per file
   type (step 2). The doer uses them, and never does their job by hand.

9. The repo's own code (its two-way tie check, its tests) follows the repo's own rules, including its dependency
   list. The skill's tools are not the repo's code, and the repo's code never imports them.

**Where the measured figures come from.**

10. The workflow is general. It applies to any repo whose CLAUDE.md files follow the rule system in tools:
    tie-check template; system-rules.md, in any language. It was first worked out on the senior-thesis-research
    repo (Python, November 2026). It was then dry-run on the conference-matching-api repo (TypeScript, Python, SQL,
    TLA+, shell and others), and simulated end to end, with real Jev calls and a real Claude checker, on a small
    made-up repo. Four stress tests then ran on it, and their measured findings are built in:
11. a loophole hunt, which proved on a copy of senior-thesis-research how a doer could end a run with hard work
    undone and every checker green;
12. an intent audit, which checked every sentence against the user's own words;
13. a live test of the tie-stage check on a copy of senior-thesis-research, with 287 real Jev calls, which measured
    Jev's thresholds per question type (tools: thresholds and calibration);
14. a simulation of an empty repo (situation A) set up end to end.
15. Examples come from those runs. Each example names its source and says whether it was measured (seen in a file
    or in command output) or inferred (concluded, not seen). An example never limits what a step must do in another
    repo.

**History.**

16. 2026-11-23: revised after two reviews (an adversarial review of these instructions, and a dry run of the
    workflow on the conference-matching-api repo), a simulation on a small repo, a study of the system rules and a
    study of rule scope, and with the user's decisions on the questions they raised (the core), including the
    decided system rules, the very dangerous actions, and the situations the skill handles.
17. 2026-11-23 (second revision): sharpened after four stress tests (a loophole hunt, an intent audit, a live test
    of the tie-stage check with 287 Jev calls, and a simulation of an empty repo), with the user's decision that
    nothing is duplicated without a purpose, and with the settled readings of the intent audit's questions. Its
    main changes are now part of these instructions.

## Gate

**Job:** The **gate script**: it starts every checker, builds every state from the **state-builder registry**,
builds the evidence pack, parses the Claude checkers' answers, checks every approval against the live transcript,
sets the baseline, and writes the **record** as a chain of hashes with checkpoint trailers.

**Inputs and outputs:** In: a step and its item list. Out: the evidence pack, every checker's verdict, the step's
result, chained into the record.

**Triggers it raises:** `test-commands.md` (step 0 fixes the test commands, or a test command fails before the run
changed anything); `resume.md` (a context summary, a usage limit, a crash or a restart; a new session; a branch
with earlier run commits); `canaries.md` (a checker passes a canary); `step-fails.md` (a step's round fails);
`checker-unusable.md` (a checker cannot be used); `other-people.md` (uncommitted work, an ownership note, an open
pull request, another branch, or main brought in); `final-check-fails.md` (a final-check item fails, the
whole-process question is not passed, or the shortcut audit finds something).

**Checks it must enforce:**

1. One gate script ships with the skill. The doer calls it with a step and that step's item list, and the gate does
   the rest. The doer never writes a verdict, a probability, a checker's state, a checker's prompt or the record.
   Measured in the loophole hunt: a state the doer built with its own one-off script (it printed "item 6: listed")
   scored 0.68, unsure, and the simulation's notes record that Jev is "only as good as the state the doer writes".
   The gate has six jobs.

**1. It starts the checkers.**

1. It starts Jev through the Jev client (tools: Jev client), and checker 1 and the second Claude checker (tools:
   Claude-checker launcher) as fresh processes.
2. It starts each Claude checker with an explicit, full model id, never an alias, and that id must differ from the
   doer's own model id. Measured in the empty-repo simulation: the `opus` alias resolved to claude-opus-5-5, the
   doer's own model, so an earlier simulation that used `--model opus` broke this rule without noticing.
3. It reads the model id that the checker process itself reports in its own output, never only the id it asked for.
   A reported id that equals the doer's, or that differs from the id asked for, voids the round.
4. It writes each checker's prompt: the fixed prompt file plus the evidence pack. Where a session can start a
   checker only with the Agent tool, the gate writes the prompt to a file, the doer passes that file's content
   unchanged, and the gate compares the hash of the first message in the subagent's transcript with the hash of the
   prompt file. A mismatch voids the round.
5. It captures each checker's answer from that process's own output, and chains its hash into the record at once
   (job 3).

**4. It checks every approval at the moment of use.**

1. An approval counts only when the gate has found its exact text in the live session's transcript, as a message
   the user typed, at the checkpoint where it is first used, and has chained its hash. Tool results, hook output,
   messages from agents or other sessions, scheduled prompts and context summaries never count (tools: conversation
   check).
2. A CLAUDE.md change merged from main through someone else's reviewed pull request is confirmed against that pull
   request instead (reading-approvals.md).

3. The end-of-run report prints, by script, every approval quote the run used, with its date. The user's own copy
   of the chat is the one copy nobody in the run can edit.

**5. It sets the baseline.**

1. The **baseline** is the commit that every "same" check, every approval check, the test list, the test bodies and
   the golden outputs compare with.
2. When the run's branch has no commits that are not on main, the baseline is the run's start commit.
3. When the branch already has commits that are not on main (an earlier run, or work resumed in a new session), the
   baseline is `git merge-base <branch> <default branch>`, never "the start of this run"; in a repo with no default
   branch to compare with, it is the run's start commit (LodeSTAR test, problem 12). So a new run can never take an
   earlier run's unchecked work as its "before".

4. The first commit message on the run's branch names the run's start commit and the baseline.
5. **6. It lists stray executables.** The pack lists, by hash, every executable file in the run folder that is not
   a shipped tool. Each one is an item for checker 1.

6. Broken always fails the repo's test run. A suite that is already red hides a new broken tie: on the live test's
   copy, the repo's own tie test read "1 failed, 11 passed" before and after every planted fault (measured). So the
   gate script also compares the broken list with the baseline's, item by item. Any broken item that was not there
   at the baseline fails the step, whatever the suite's summary line says.

7. **Counts against the baseline**: the count of specific rules and the count of exempt files per group may not
   fall or grow during a run without a numbered, approved item for each change (general-or-specific.md; tools:
   exempt-list builder).

8. The tests are moved, so the test list is compared by name, through the import adapter's mapping, with the
   baseline's. The baseline's own test files are also run, through the import adapter, against the new code. And a
   script diffs the assertions of every test that existed at the baseline: a removed or changed assertion is an
   item for checker 1. Measured in the loophole hunt: replacing all 8 assertions of one folder's tests with `assert
   True` left the result "5 passed" and the collected test list unchanged.

9. Check, through the gate script, that both checkers can be used: one fresh Claude checker, started with an
   explicit model id from the ranking table, reports a model id that is that id and differs from the doer's; and
   one Jev request (a canary) returns an answer served by `typesafe-ai`. If either fails, checker-unusable.md
   applies.

**The checker map.**

### The checker map

10. Three kinds of checker are used:
11. **Script**: decides anything exact: existence, counts, names, word-for-word text, golden equality, test
    results, single-mutation results, coverage tables, and whether a change is mechanical.
12. **Jev**: one typed question per item, on a state built by a registered state builder (tools: state-builder
    registry).
13. **Claude checker**: a fresh agent on a different Claude model, for reading judgment, subtle bugs and the whole
    picture (tools: Claude-checker launcher). A second fresh Claude checker judges every item Jev left unsure.

14. Where Jev was measured to be weak (subtle bugs, comparing two long texts, whole files against many rules, code
    hidden under an exempt name), a script or the Claude checker decides, and Jev's answer can only fail the item.
    The numbers in brackets are the provisional pass and fail thresholds of tools: thresholds and calibration.

| Check | Script | Jev | Claude checker | Who must pass |
|---|---|---|---|---|
| Correct, every step | builds the item list; decides every exact fact | the correct question, per item | judges the whole step | all three |
| Same, code, every step | runs every test and check; compares golden outputs value by value, with counts ("5 of 6 compared"); runs the baseline's tests against the new code, and diffs every old test's assertions | the same question for code, per item, on the script's output | re-judges, looking for behaviour the proof could miss | all three |
| Same, CLAUDE.md, every step (the meaning check for moved rules) | word-for-word comparison, both ways; the scope check: the counted files the rule covers, before and after | the same question for CLAUDE.md, per moved or cut piece (0.65 / 0.40) | must also pass, because Jev is weak at comparing long texts | all three |
| Complete, every step | counts the items, and checks each has a recorded answer; the coverage tables and their floors (tools: coverage tables) | the complete question, per clause or item | judges the whole step | all three |
| Mechanical or conceptual (is-it-mechanical.md) | decides alone, by effect: the same clauses, the same covered files, the same rules that need a file | asked on the script's output ("Does this output show a pass?"); may only fail (audit fix 2) | re-runs the script | the script; a Jev fail fails it |
| Tie stage, part 1: a rule with no file (tools: tie-stage check) | decides alone | asked on the script's output ("Does this output show a pass?"); may only fail (audit fix 2) | re-runs the script | the script; a Jev fail fails it |
| Tie stage, part 2, per clause (tools: tie-stage check) | the clause table; a generated single mutation inside the clause's own lines makes a named test fail on an assertion | may only fail the clause (below 0.35) | must pass the clause: subtle bugs are its job | the script and the Claude checker; a Jev fail fails it |
| Tie stage, part 2, per rule (tools: tie-stage check) | every clause of the rule has passed | "Does this clause list cover every requirement of the rule's text?" | must pass the rule | all three |
| Tie stage, part 3: file → rule (tools: tie-stage check) | fails any counted file with no specific rule; the function-to-clause table, in which every unmapped piece is an extra piece | per mapped piece, question 1 against its own clause (0.75 / 0.45); per file, a weak signal (0.73 / 0.19) | must pass the file | all three |
| Tie stage, part 4: one file, one rule (tools: tie-stage check) | fails a file named by two rules, a bold sentence two rules share, two files that write one output, and the same code in two files; picks the candidate rules for each piece | per piece and candidate rule, then per sentence of a rule above the fail line, question 1 (0.75 / 0.45; LodeSTAR test, problem 1) | must pass every file | all three |
| Heading states the bold sentence | decides alone, word for word | asked on the script's output ("Does this output show a pass?"); may only fail (audit fix 2) | re-runs the script | the script; a Jev fail fails it |
| Exempt file is in its group (tools: exempt-list builder) | decides alone, by pattern, by content, and by imports and calls | may only fail; it flags names that only look exempt (fail below 0.92) | re-judges every file that became exempt during the run | the script; a Jev or Claude-checker fail fails it |
| General or specific rule (general-or-specific.md) | lists every rule; checks the fact a "general" answer needs | per rule, without the doer's label (0.72 / 0.27, p = specific) | per rule, without the doer's label | Jev and the Claude checker agree; specific is the default |
| Whole-folder mark (general-or-specific.md) | lists every general rule in a lowest-level CLAUDE.md; refuses a mark on a rule that has, or ever had, a file line | per mark (0.88 / 0.60); it must agree with the class question | re-judges | all three, then the user (a conceptual item) |
| Sits as low as it can | lists each rule's CLAUDE.md and the folders of the code it is about | per rule | re-judges | all three |
| A clause counts as tested (tools: mutation runner) | decides alone: a generated single mutation | asked on the script's output ("Does this output show a pass?"); may only fail (audit fix 2) | may run its own mutations | the script; a Jev fail fails it |
| The rule-scope chain (question-chain.md) | gathers each piece's code, what it writes, who calls it, and other rules' sentences on its subject | the 8 fixed questions, per piece | re-judges each ending | Jev and the Claude checker |
| Nothing duplicated without a purpose (duplicates.md) | finds every candidate pair | per pair | per pair | all three |
| An item the doer put off (open-items.md) | checks its reason code and its evidence | "Can this item be closed only with a new decision from the user, or with something outside this run?" | the same question | both must pass; a "no" from either sends the item back to its step |
| A late finding (tools: lateness script) | the lateness script decides alone | asked on the script's output ("Does this output show a pass?"); may only fail (audit fix 2) | re-runs the script | the script; a Jev fail fails it |
| Final check: correct | the record of each step | per step | must pass | Jev and the Claude checker |
| Final check: same | as for every step, against the baseline | per item | must pass | all three |
| Final check: complete | counts every item, and checks each shows "passed" | per clause per folder, and per step | must pass | all three |
| Final check: nothing duplicated | the duplicate finder, on the whole repo | per pair | per pair | all three |
| Final check: only conceptual questions | lists every message, from the question log and the transcripts | per message, the kind question | must pass | all three |
| Final check: the whole process | writes the summary of every step's results | "Have we implemented the whole process correctly?", once | both Claude checkers read the same summary when Jev does not pass it | Jev, or both Claude checkers |
| Final shortcut audit (tools: Claude-checker launcher) | gives it every file it asks for | not asked | a fresh Claude checker reads the transcripts and the record | Claude checker |
| Canaries, every checkpoint (tools: canary builder) | draws them from the step's real items, and keeps the answer key out of the doer's and every checker's reach | answers them | answers them | any checker that passes one fails the round |

15. **A recorded probe mode** (LodeSTAR test, problem 14): the gate can start a checker on a test prompt, to try a
    model id or a command-line flag, and records the probe like any checker run, so that no checker is ever started
    outside the gate.

## Evidence

**Job:** Says what counts as evidence in the pack and the record.

**Inputs and outputs:** In: command output, files, diffs, tables, user messages, checker answers. Out: evidence
lines the pack quotes.

**Triggers it raises:** none.

**Checks it must enforce:**

1. The gate script builds the pack from files on disk and from command output. The doer never writes anything into
   it. It is plain text and self-contained: a checker must not need the conversation. It holds:
2. the step's number and name, its "done when" list and its three checks, copied by script from these instructions;
3. every item of the step, with its state, its three checks' answers, and its evidence; and the count of items,
   with the count that has a recorded answer for each check;
4. for each "done when" item: the command run and its full output, or the file excerpt with its path and line
   numbers, or the diff, that shows it;
5. the two-way tie check's full output, and its broken list compared with the baseline's, item by item;
6. the output of every test command fixed in step 0, each named, each run in full exactly as fixed. A command that
   could not run is listed as "not run", with why. A step with a command not run cannot pass (step-fails.md);
7. the test list and the test commands, compared by script with the baseline's;
8. the coverage tables of tools: coverage tables that the step touches, with their floors and counts;
9. the count of specific rules and the count of exempt files per group, each against the baseline
   (general-or-specific.md; tools: exempt-list builder);
10. `git status --porcelain` and `git diff --stat <the step's start commit>`, so new untracked files show too;
11. for steps that asked the user something: each message's exact text, the user's exact answer, and the chat
    report that followed, from the question log, with their message ids;
12. the canaries (tools: canary builder), laid out like the other items and not marked;
13. the open items with their reason codes, and the declined items (open-items.md);
14. every stray executable in the run folder (tools: gate);
15. the spend so far against each budget, and the checks still unpaid with their cost (budget.md).
16. Every line number, model id and commit hash in the pack is produced by script, never typed. Claims without
    output ("tests pass") do not count as evidence. Long outputs are saved to files in the run folder; the pack
    names each file and quotes the lines that matter.

17. Evidence is one of these: a command and its full output; a file excerpt with its path and line numbers; a diff;
    a coverage table built by script; a quoted user message with its message id, confirmed by the gate in the live
    transcript; a saved Jev response with its request id and provider; a Claude checker's verdict as the gate
    captured it.
18. Never evidence: "tests pass", "verified", "looks good", or a summary of output in place of the output.
19. Evidence is made by a script or a command. The doer never retypes output.
20. Long outputs are saved to a file in the run folder, named in the record. The pack quotes the lines that matter.

21. Every claim about the repo is labelled measured or inferred.

## Record

**Job:** Keeps the run's record as a chain of hashes, with checkpoint trailers.

**Inputs and outputs:** In: every answer, verdict, approval and step result. Out: the record file in the run
folder; the record's hash in each checkpoint commit's trailers.

**Triggers it raises:** none.

**Checks it must enforce:**

**3. It keeps the record as a chain of hashes.**

1. Every entry of the record (each answer, each verdict, each approval, each step's result) carries the SHA-256 of
   the whole record up to and including it.
2. Each checkpoint commit on the run's branch carries, as trailers in its message, the step, the round and the
   record's hash at that moment, for example `Verify-Rules-Record: <hash>`.
3. Step 0 and step 14 verify the whole chain from git, not from the run folder: every trailer must match the
   record. A verdict file that does not match its entry in the chain fails the step.
4. The record itself never enters the repo. Only its hashes do, in the commit messages.

5. Every checkpoint ends with a commit on the run's branch that carries the record's hash; a step that changes no
   file makes an empty commit that holds only that trailer.

(open: run traces in git, audit fix 11) The checkpoint commits, their trailers, the declined-item trailers and the
empty commit of a step that changes no file put run traces into git history. Whether that is kept, or the
checkpoint commits are squashed when work is merged, waits for the user.

6. Write the start facts into the record: the repo; the start commit; the baseline; the doer's model id; each
   Claude checker's reported model id; Jev's model id and provider; the test list, the test commands and their
   outputs; the known failures; the budgets, quoted; the situation.

7. The record is one file in the run folder, outside the repo (tools: run folder and state). The gate script writes
   it from the state, the captured verdicts and the Jev response files, as a chain of hashes. The doer never types
   a verdict or a probability into it.
8. For each step it holds: the step; every item, with its state and its answers; the evidence pack's file names;
   each Claude checker's captured verdict, checker id and reported model id; Jev's raw response file names, request
   ids, model id, provider, builder names and probabilities; the canaries and every checker's answer on them; the
   number of rounds, void rounds included; the commit that holds the step's work, with its trailer; the spend; the
   open items, with their reason codes; the declined items; and every mistake a checker found
   (repeated-mistake.md).
9. It ends with the final check, the whole-process question and its answers, the shortcut audit, the run's end
   state (SKILL.md: the target state), and the first line of the end-of-run report, written by script (tools:
   end-of-run report).
10. It is never committed to the repo; only its hashes are, in the checkpoint commits' trailers. The end-of-run
    report in the chat (step 14) summarises it and gives its path.

## State-builder registry

**Job:** Holds every fixed question and the one registered way to build the state each question type is asked on.

**Inputs and outputs:** In: a question type and an item. Out: the state, with the builder's name and hash.

**Triggers it raises:** `fix-groups.md` (a finding is sorted (step 8) or fixed (step 11)).

**Checks it must enforce:**

**2. It builds every state from the registry.**

1. A registry of state builders ships with the skill. For every question type, it names the exact commands and file
   slices that build the state, and the exact lines of these instructions that are the question's instructions.
2. The Jev client refuses any state that a registered builder did not build. It records the builder's name and hash
   beside every answer.
3. An item for which no builder is registered is not sent to Jev. It goes to checker 1 and the second Claude
   checker, and both must pass it. The record says that Jev did not check it.
4. Every item's evidence is built in a temporary copy of the worktree, outside the repo, so that a canary's
   evidence looks no different from any other item's (tools: canary builder).

5. **The three questions** are fixed, in the user's words:
   - correct: "Was it done correctly, based on these instructions?"
   - same, for code: "If it's code, does it pass all of the same checks it did before?"
   - same, for a CLAUDE.md: "If it's CLAUDE.md, does it have the exact same meaning as before?"
   - complete: "Have you actually completed this completely, or have you only done part of it?" This one is sent as
     a choice question with two answers, "completely" and "only part of it"; the right answer is "completely". If
     the client's tests show Jev cannot take a choice question, it is sent as the yes/no question "Have you
     actually completed this completely, rather than only part of it?"
6. **The other fixed questions**, each with its text in the registry: the tie-stage questions (tools: tie-stage
   check), the classification and whole-folder questions (general-or-specific.md), the exempt-group question
   (tools: exempt-list builder), the "sits as low as it can" question (step 4), the rule-scope chain
   (question-chain.md), the duplicate questions (duplicates.md), the put-off question (open-items.md), the
   clause-kind question (step 7), the group question (step 8), the message-kind question (tools: conversation
   check), and the whole-process question (step 14). Their slots are filled by script.
7. **Positive form.** Every question is in positive form. For a pass-or-fail question, "yes" (or the named right
   choice) means right for that item; a question where "yes" means wrong is never sent. Some questions are not
   pass-or-fail: the classification question, whose yes and no each name a class; the rule-scope chain, whose yes
   and no each lead to a next question; and the duplicate questions, whose yes means "merge".
8. **One request per item.** Each request is about one thing: one rule, file, piece, CLAUDE.md, clause, folder,
   moved piece, finding, change, list item, test command or message. A question about a whole list is never sent,
   with one exception: the user's own final question, "Have we implemented the whole process correctly?", asked
   once on the gate's summary (step 14). A script knows how many items each check has, and a step cannot pass until
   every item has a recorded answer.
9. **The state is always built by a registered builder from raw output**: a diff, a grep, the file itself, a test
   result, a comparison's output. Never the doer's description, and never two long texts to compare. It holds only
   what that one question needs: the item; the instructions for it, copied from these instructions and from the
   CLAUDE.md rules it concerns; and that raw evidence. Measured in the simulation: Jev scored identical long texts
   at 0.11 to 0.15 when given both texts, and at 0.86 to 0.89 when given the script's diff; it also did badly on
   multi-line git output (0.26) and on thin states (0.49, then 0.87 with one more line). Measured in the live test:
   putting a clause's test output into its state turned "is it carried out?" into "is it tested?" (tools: tie-stage
   check). The complete question's state is the script's per-fact checklist: each fact the item requires, marked
   present or missing, with its evidence. Measured in the empty-repo simulation: that state separated a complete
   item (0.92) from an incomplete one (0.00).
10. **Exact comparisons are decided by script.** String equality, file existence, golden equality, the
    word-for-word comparison, mutation results, coverage, the effect of a CLAUDE.md change, and diff limits are
    decided by a script. Jev gets the script's output and is asked whether it shows a pass.
11. **No re-asking for a better answer.** Each question type has one registered state, the calibrated one. Where
    the registry holds a second state for a type, the client sends both every time, and records the lower of the
    two answers. The doer never asks again with a state of its own choosing. One re-ask is allowed after a registry
    change: when a FAIL came from a bad state, the registry gets a better state for that question type, the type is
    calibrated again, and the item is asked once more; the record keeps both answers and the change (LodeSTAR test,
    problem 5).

12. **A fact builder per done-when item** (LodeSTAR test, problem 3): every done-when item of every step has a
    registered fact builder and evidence slice, and the doer never types a fact. Measured: with hand-typed
    "present" facts, a canary scored 0.76 and voided a round.

13. **Positive form for every verdict type**, "partly" and "missing" findings included: the question asks whether
    the doer's finding is right (for example "Is this system rule missing from the repo's CLAUDE.md files?"), so
    that yes always means the doer was right (LodeSTAR test, problem 3).

## Jev client

**Job:** The **Jev client**: calls `experimental_decide`, holds every fixed question, refuses states no registered
builder made, checks the provider of every answer, and records every raw response.

**Inputs and outputs:** In: a registered state and its question. Out: the raw response, with request id, model id,
provider and tokens.

**Triggers it raises:** `jev-unsure.md` (jev's answer falls between a question type's two thresholds).

**Checks it must enforce:**

1. **What it is**: TypeSafe's Jev (`typesafe-ai/jev`), reached through the Vercel AI Gateway and called with the AI
   SDK's `experimental_decide`. In AI SDK 7.0.179, `experimental_evaluate` is a deprecated alias of it (measured in
   the live test); the client calls `experimental_decide`. It is a fast decision model that answers a typed
   question about one state with a probability. A working call (measured): `experimental_decide({ model:
   "typesafe-ai/jev", state, questions: { q: { type: "boolean", instructions } } })`. The answer carries
   `{"answers":{"q":{"type":"boolean","probability":0.49}}}` with `inputTokens` and `outputTokens`, and no reason
   text. The request id is in the response's `x-vercel-id` header. The skill's Jev client is built from the AI
   SDK's current documentation, read when the client is built, and is tested before use. The gateway key goes
   through the session's credential flow at the moment it is first needed.
2. **The provider is checked on every call.** The gateway's routing data for Jev lists a fallback provider
   ("digitalocean" in the live test; measured). The client records, for every call, the provider that finally
   served it. An answer served by any provider other than `typesafe-ai` counts as a checker that cannot be used
   (checker-unusable.md). In the live test, 286 of 287 answers came from `typesafe-ai`, and one had no provider
   recorded (measured; corrected by the LodeSTAR test, problem 15); in the LodeSTAR test, all 273 did.

3. **What Jev is good and bad at** (measured in the simulation and the live test): it is good at spotting a gap
   when its state shows the missing thing (0.02 for a clause the code did not carry out), at the meaning of a moved
   rule given the script's diff, at the class of a rule, and at small questions about one piece and one sentence.
   It is bad at subtle bugs (`>` against `>=`), at single-element breaks read from code alone, at comparing two
   long texts, at judging a whole file against many rules, at code hidden under an exempt name, at multi-line git
   output and at thin states. So those are always the script's or the Claude checker's job (the checker map).

4. **Sending.** The Jev client may send the requests of one item together. It writes each raw response, with the
   request id, the model id, the provider, and the input and output tokens, to the run folder, and the gate chains
   each one into the record.
5. **Cost.** Every request counts against the money budget (budget.md). Measured: 287 calls used 561,367 input and
   5,720 output tokens, at about 0.94 seconds each (live test); 140 calls used 113,101 input tokens, about 808 per
   call, costing about $0.005 at $0.000000042 per input token, the price read from the gateway's model list
   (empty-repo simulation).

### Saved answers

6. Each Jev answer is saved with its question, a hash of its state, its builder, its provider and the model id.
   Saved answers are for the record only. They are never replayed. Every new round and every new run sends a new
   request, and a changed state is always a new question.

7. **The version is pinned** (LodeSTAR test, problem 15): `typesafe-ai/jev` is an alias next to pinned versions
   (1.13.0 and 1.14.0 at the LodeSTAR test), and a response does not say which one answered. The client calls one
   pinned version, and records it with every answer.

## Thresholds and calibration

**Job:** The **calibration file and thresholds**.

**Inputs and outputs:** In: labelled known-right and known-wrong items with Jev's answers. Out: each question
type's role, pass threshold and fail threshold.

**Triggers it raises:** none.

**Checks it must enforce:**

1. **Thresholds, and Jev's role, per question type** (open: calibration). For a yes/no question, p is Jev's
   probability of "yes"; for the classification question, of "specific"; for a choice question, of the right
   choice. Each question type has a role, a pass threshold and a fail threshold. The values below are provisional:
   they come from the live test's calibration file, on small samples of 4 to 41 items per type, below the target of
   20 of each kind, and they are set again as runs add labelled items.

| Question type | Jev's role | Pass | Fail | Measured (live test unless named) |
|---|---|---|---|---|
| Clause carried out (part 2) | may only fail | — | 0.35 | on code alone: right 0.33–0.97 (12), wrong 0.06–0.95 (19); 8 of 19 wrong at 0.8 or more |
| Clause list covers the rule's text (part 2, per rule) | decides with the Claude checker | 0.8 | 0.5 | not calibrated; loophole hunt: 2 requirements dropped 0.09, 8 clauses merged into 4 at 0.87 (caught by the script's floor) |
| A sentence requires this piece (question 1; parts 3 and 4) | decides with the Claude checker | 0.75 | 0.45 | right 0.79–0.92 (4), wrong 0.09–0.39 (4); 0 errors |
| The file serves only its rule (part 3, per file) | weak signal | 0.73 | 0.19 | right 0.20–0.91 (12), wrong 0.10–0.72 (9); 0 errors, 13 of 21 unsure |
| Exempt group (tools: exempt-list builder) | may only fail | — | 0.92 | right 0.93–0.98 (20), wrong 0.03–0.95 (7); 3 of 7 wrong at 0.8 or more |
| Same meaning after a move | decides with the Claude checker, after the script's covered-files check | 0.65 | 0.40 | right 0.68–0.92 (8), wrong 0.02–0.60 (8); 0 errors |
| General or specific (p = specific) | decides with the Claude checker, without the doer's label; specific is the default | 0.72 | 0.27 | right 0.28–0.95 (23), wrong 0.03–0.70 (17); 10 of 40 unsure |
| Whole-folder mark | decides with the Claude checker; must agree with the class question; then the user | 0.88 | 0.60 | right 0.88–0.94 (5), wrong 0.63–0.82 (6); loophole hunt: one wrong mark at 0.90 |
| Every other question type | decides with the Claude checker | 0.8 | 0.5 | not calibrated |

2. Two questions are no longer asked, because they separated nothing (measured in the live test): the old per-rule
   "does `<file>` do everything its rule asks?" (right 0.07–0.96, wrong 0.07–0.21) and the old whole-file part 4
   (right 0.20–0.54, wrong 0.23–0.43). tools: tie-stage check replaced them.

3. (open: calibration) The thresholds are mechanical, but they must be calibrated by testing, because they vary by
   question type. In the user's words: "you should probably test it out on a few test examples… I suspect it
   actually varies on the type of prompt and the type of situation".
4. **The first calibration is done, and its values are provisional.** The live test ran 287 Jev calls on a copy of
   senior-thesis-research: known-right items from the repo's real rules, ties and clauses, and known-wrong items
   made from them by planted faults and single-element breaks, each labelled by hand against the code. Its
   calibration file, `calibration.json`, holds every probability per question type, with each type's best threshold
   and its errors. It ships with the skill, and the thresholds of tools: thresholds and calibration come from it
   (measured).
5. The samples are small: 4 to 41 items per type, and fewer than 20 known-right and 20 known-wrong items for most
   types (measured). So every value is provisional, and every question type not in the file uses 0.8 and 0.5 until
   it is calibrated.
6. **It is recalibrated as runs add items.** Every run adds its labelled items to the calibration set:
   - known wrong: every canary, and every item that a later check proved wrong after Jev had passed it;
   - known right: every item a script proved right and both Claude checkers passed. Before each release of the
     skill, and whenever Jev's model id changes, the thresholds are set again from the whole set.
7. **How a threshold is set.** For each question type, the pass threshold is set just above the highest probability
   any known-wrong item got, so that no known-wrong item passes. The fail threshold is set just below the lowest
   probability any known-right item got. Where a few known-right items lie far below the rest, the fail threshold
   may sit above them, and the record counts those false fails (for "clause carried out", 1 of 12 known-right items
   lies below 0.35; measured). Items between the two thresholds go to the second Claude checker.
8. **When the groups overlap too much.** If most items of a type would fall between the thresholds, first the state
   that type sends is improved (never the wording of the question), and the type is calibrated again. If that does
   not help, Jev's role for that type becomes "may only fail", or the question is replaced, as the old part 2,
   per-rule and part 4 questions were (tools: tie-stage check).
9. The calibration set, every probability, and the chosen thresholds are recorded in the skill.

10. **The table and the calibration file agree** (LodeSTAR test, problem 15). Measured: in calibration.json, the
    `spec_pass_threshold` and `spec_fail_threshold` fields differ from this table, and for four types they are
    inverted, the pass threshold below the fail threshold: question 1 (0.40 / 0.78), same meaning (0.61 / 0.67),
    whole-folder mark (0.83 / 0.87) and exempt imports (0.91 / 0.92). The rule above inverts whenever a type's
    known-right and known-wrong items do not overlap. Then both thresholds are set inside the gap, the pass
    threshold at or above the fail threshold, as this table's values are, and the calibration file is rewritten to
    hold the values the table uses.

11. **How a choice question's answer counts** (LodeSTAR test, problem 15): p is Jev's probability of the expected
    choice (the recorded situation, the logged kind, the recorded group), read against the type's thresholds like
    any p. The top choice does not decide alone: in the LodeSTAR test the situation item's top choice was right (C)
    at only 0.40, which is unsure.

## Claude-checker launcher

**Job:** The **model ranking table** of Claude models, for choosing the Claude checkers.

**Inputs and outputs:** In: the step, its evidence pack, its per-step checklist. Out: each Claude checker's
captured answer, parsed into item lines.

**Triggers it raises:** none.

**Checks it must enforce:**

1. **A fresh checker for every round**, started by the gate script (tools: gate). Its model is an explicit Claude
   model id different from the doer's, and at least as capable as the doer's, by the ranking table that ships with
   the skill. Using a checker the table ranks below the doer's model needs the user's yes, asked once (kind b).
   Where no Agent tool exists, the gate runs `claude -p --model <id>` from the shell, with an allow-list of the
   read-only commands it may re-run: the test commands, the two-way tie check, and read-only git commands. In the
   simulation, a checker run without an allow-list could not re-run anything (measured). The record holds the model
   id the checker itself reported.
2. It gets a fixed prompt file that ships with the skill. With it, it gets: the core and the steps (SKILL.md);
   words.md; the tie-check template, tie-stage check and evidence sections of docs/tools.md; asking-the-user.md,
   is-it-mechanical.md, reading-approvals.md and dangerous-action.md; the step's checklist (per-step checklists);
   every branch the step names; and the evidence pack. For steps 0, 1 and 14 it also gets system-rules.md, and the
   hierarchy-checks and conversation-check sections. For steps 7 and 12 it also gets the clause tables. It gets
   read access to the run's worktree.
3. It always re-runs the test commands fixed in step 0 and the two-way tie check. It may run read-only git
   commands, and its own mutations in a temporary copy outside the repo. It runs nothing else: no experiments, no
   end-to-end runs, no edits.
4. Its prompt says: "Judge this step by the three checks: correct (was each thing done correctly, based on these
   instructions?), same (is everything that was not meant to change exactly as before, by the proof shown?) and
   complete (was all of it done, or only part?). Then decide, for each 'done when' item and each item you are asked
   about, PASS or FAIL. A FAIL must name the id of the item it breaks and show the evidence: a command and its
   output, or a file excerpt with its path and line numbers. Look for subtle bugs, and for what the evidence leaves
   out. You did not do this work; do not trust any claim you cannot see proven. Some items are planted to test you;
   judge each item only on its own evidence. Never invoke /verify-rules."
5. It answers in a fixed form: one line per item, `PASS|FAIL — <item id> — <evidence>`; then one line each for
   `CORRECT`, `SAME` and `COMPLETE`, each `PASS` or `FAIL`; then `STEP PASS` or `STEP FAIL`.
6. **The gate's parser decides what the answer says.** A FAIL line that names an item id of the step (a "done when"
   item, or any item of its three checks) and shows evidence is a FAIL. Any other remark is a note, by its form,
   never by the doer's choice. The step's verdict is computed by the parser from the item lines, leaving out the
   canaries' lines (tools: canary builder); the checker's own `STEP` line is recorded beside it.
7. Subtle bugs are the Claude checker's job. Jev alone is not enough there (tools: Jev client).

8. In step 14, after the final check, the gate script starts a fresh Claude checker on a different Claude model
   from the doer's, which reads the run's transcripts and the record. The gate names the canary files to it. It
   looks for any skipped or bent step, for any item marked passed without its full evidence, and for any open item
   whose reason code does not hold.

9. **The ranking table ships with the skill**, built and tested before release (LodeSTAR test, problem 14: none
   shipped, and "at least as capable" then left only Fable models for an Opus 5.5 doer).

10. **The command-line flags that work** (measured, LodeSTAR test, problem 14): `claude -p --model <id>
    --disable-slash-commands --strict-mcp-config --no-session-persistence`; `--bare` breaks authentication. A
    checker pack was 170k to 255k characters.

## Canary builder

**Job:** The **canary builder**.

**Inputs and outputs:** In: the step's real items. Out: planted known-false items laid out like the others; the
answer key, held by the gate.

**Triggers it raises:** none.

**Checks it must enforce:**

1. Every checkpoint includes planted, known-false items, built by the canary builder, so that a checker that passes
   everything is caught.
2. **How many**: at least 3 per checkpoint, or 5% of the step's items, whichever is more.
3. **What they are**: judgment items drawn from the step's own real items, never facts a script already decides.
   Examples: a clause whose code line is mutated; a file with one function of a neighbour's pasted in; a move whose
   target folder is changed; a list item whose effect is changed. Measured in the loophole hunt: a canary of the
   old kind (one word of a heading changed) is an exact fact, and Jev failed it at 0.06; it tests only whether a
   checker can read the word BROKEN in the script's output.
4. **How they are built**: the canary builder makes each one in a temporary copy of the worktree, outside the repo,
   as every item's evidence is built (tools: gate), and lays it out like the other items. Jev gets each canary as
   one more request, except on question types where Jev may only fail: there the canary goes to the Claude checkers
   only, and Jev's answer on it is calibration data (LodeSTAR test, problem 4: a hole-filling break scored 0.73
   against a fail line of 0.35, and voided round after round). Checker 1 gets each canary as one more item in the
   pack.
5. **The answer key** is held by another process or another user, outside every path the doer or a checker can read
   (LodeSTAR test, problem 2), and is revealed only after every verdict of the round is chained. After the round,
   the gate names the canary files to the shortcut audit (tools: Claude-checker launcher), so that it does not take
   them for real questions or real failures.

6. **Canaries never count toward the step's verdict.** The gate's parser computes the verdict from the other lines
   (tools: Claude-checker launcher). Measured in the empty-repo simulation: checker 1 answered STEP FAIL on every
   step, because it rightly failed the canary, and the shortcut audit then read passed steps as "marked passed
   despite STEP FAIL".

## Secret stripper

**Job:** The **secret stripper**.

**Inputs and outputs:** In: a state about to be sent. Out: the cleaned state, and the list of what was removed.

**Triggers it raises:** `secret-found.md` (the secret stripper refuses a state).

**Checks it must enforce:**

1. **Nothing secret leaves the machine.** Before any request is sent, a script strips secrets, keys, tokens, the
   contents of env files and credential files, and account names (for example the account names in a repo's
   job-runner settings). It writes to the run folder a list of what it removed: the kind and the place, never the
   value. In the live test, the stripper found no account name or key in any of 287 states (measured).

## Coverage tables

**Job:** Names the four coverage tables, each built by the tool that owns its result, and their floors.

**Inputs and outputs:** In: the step's rules, clauses, pieces and golden inputs. Out: the tables, saved in the run
folder.

**Triggers it raises:** none.

**Checks it must enforce:**

1. Four tables are built by script, never by hand. Each has a floor. A table below its floor fails the complete
   check of the step that uses it. The tables are saved in the run folder and given to the checkers in the pack.

The tables are owned by: the clause-table builder (rule text → clauses), the mutation runner (clause → mutation),
the function-to-clause table builder (function → clause), and the golden harness (golden inputs → line coverage).
The other floors belong to the item lister (conflict pairs), the duplicate finder (duplicate pairs) and the gate
(counts against the baseline).

## Rule reader

**Job:** The **rule reader**: lists every rule in every CLAUDE.md with its CLAUDE.md, its bold sentence (or
"unnamed"), its number, its indent and its exact text span.

**Inputs and outputs:** In: every CLAUDE.md (or, in situation A, the draft CLAUDE.md files). Out: one row per rule.

**Triggers it raises:** `general-or-specific.md` (a rule must be classified, or a whole-folder mark is proposed);
`version-folders.md` (the repo's rules offer versions side by side).

**Checks it must enforce:**

1. **Rule**: an item the user wrote as a requirement. It is a numbered item (`N. ...`) or a top-level bullet (`-
   ...`) at the start of a line, under a category heading, outside the copied opening, outside the System Rules
   block and outside any fenced code block. A rule is identified by its CLAUDE.md and its bold sentence together,
   never by its number.
2. **Rule text**: a rule's text runs from its first line to the line before the first of these: the next rule at
   the same or a lower indent, the next heading, or its file line. It includes every indented line, fenced code
   block, table and tag inside that span. A tag is a label such as `*(NIST REC-API-3)*`; conference-matching-api
   has many (measured by the dry run). A rule's text is always handled whole. A fenced block, a table or a tag is
   never cut.
3. **Sentence boundary**: a place between two sentences of a rule's text, where one sentence ends with ".", "?" or
   "!" and the next begins. A full stop inside an abbreviation ("e.g.", "et al.") or a number ("0.96") is not a
   sentence boundary. Rule texts are cut only at sentence boundaries.
4. **Bold sentence**: the text between the rule's first `**` and the next `**`. It states the rule's idea. Rules
   refer to each other by their idea, never by their number, so every rule needs a bold sentence. It is copied word
   for word, punctuation included (even a trailing comma or colon), wherever it is cited. Bold sentences are unique
   in the whole repo: no two rules share one, in one CLAUDE.md or in different ones. Headings and file lines are
   written by script from the CLAUDE.md text, never typed, so characters such as `×`, `%`, dashes and quote marks
   are never retyped wrong.
5. **Unnamed rule**: a rule with no bold sentence. The skill proposes a bold sentence for it, on the conceptual
   list, and the user approves it (step 4). Example: conference-matching-api has 20 such items, and its tie check
   silently skips the two that sit in lowest-level CLAUDE.md files (measured by the dry run and by the system-rules
   study).
6. **Sub-rule**: an indented item under a rule, bulleted or numbered, with or without a bold sentence of its own.
   It belongs to the rule above it, and to that rule's one file. Every clause of a sub-rule must be its parent
   file's job. Step 4 checks this for each sub-rule.
7. **Copied opening**: the summary of what the CLAUDE.md files are, and the rule never to change a CLAUDE.md, which
   every lower CLAUDE.md copies word for word from the global one. It is not a rule of the lower CLAUDE.md. The
   two-way tie check finds it by its exact text, never by a rule number or by a heading's first words.

8. It skips the copied opening and the System Rules block by their exact text, and every fenced code block that is
   not inside a rule's text;

9. **It is one skipped unit.** The rule reader, the two-way tie check and hierarchy checks 5 to 8 skip it by its
   exact text, as they skip the copied opening. Its items are not rules of the repo, need no bold sentences and no
   files, and its file names are not hierarchy failures. Measured in the empty-repo simulation: the block holds 53
   rule-shaped items, 46 of them with no bold sentence, 11 lines outside any item, a table, and 5 file names
   (`.env`, `.gitignore`, `PRD.md`, `SKILL.md`, `docs/harness/claude-code.md`). Read as rules, it would fail the
   rule definition, the unnamed-rule step and hierarchy checks 6 and 7.

10. Run the rule reader. Each row holds: the CLAUDE.md, the bold sentence (or "unnamed"), the number, the class
    (general or specific), and, for a specific rule, its destination lowest-level folder. The copied opening of
    each lower CLAUDE.md is listed once per file as "copy", and the System Rules block once as "block"; neither is
    classified.

## Clause-table builder

**Job:** The **clause-table builder**: makes the first cut of every rule's text and checks every clause list
against its floor.

**Inputs and outputs:** In: a rule's text. Out: its clause table, checked against its floor.

**Triggers it raises:** `clause-audit.md` (step 7 or step 12 audits a rule).

**Checks it must enforce:**

1. **Clause**: one requirement inside a rule's text: a sentence or part of a sentence, copied word for word. Each
   number, condition, step, "never", "only", "at most", "at least", "before", "after", "each" and "every" is its
   own clause. A sub-rule's clauses count too. The clause list of a rule is a table that a script checks (tools:
   coverage tables): every clause is an exact substring of the rule's text; the clauses together cover every word
   of it; no clause holds two numbers or two of those keywords; and the list holds at least the floor the script
   counts from the text's sentences, numbers and keywords.

**1. Rule text → clauses.**

1. The script makes the first cut of every rule's text: at each sentence boundary (tools: rule reader), and around
   each number and each of these keywords: "never", "only", "always", "at most", "at least", "before", "after",
   "each", "every", "if", "unless", "when", "until". A keyword phrase ("at most", "only after", "never before") is
   one marker, and the rule's own list number ("8.") is stripped before the cut (LodeSTAR test, problem 11: the
   two-keyword rule split "…frozen; only" from "after that…"). The reviewer may cut a clause further. It never
   joins two.
2. The script then checks the clause list:
   - every clause is an exact substring of the rule's text;
   - the clauses together cover every word of the rule's text, sub-rules included (the bold markers and the file
     line aside);
   - no clause holds two numbers, or two of the keywords (a keyword phrase counts as one);
   - the floor: the list holds at least, for each sentence, the larger of 1, its count of numbers and its count of
     keywords, summed over every sentence.
3. Measured in the loophole hunt: Jev passed a list of eight clauses merged into four at 0.87. The floor fails that
   list.

## Effect script

**Job:** The **effect script**: decides whether a CLAUDE.md change is mechanical, by its effect on clauses, covered
files and the rules that need a file, and writes the M list's header and each C item's opening diff
(is-it-mechanical.md; tools: list builder).

**Inputs and outputs:** In: the CLAUDE.md files before and after a change. Out: mechanical or conceptual, with the
words of what it would change.

**Triggers it raises:** `is-it-mechanical.md` (any CLAUDE.md change is planned).

**Checks it must enforce:**

1. **A CLAUDE.md change is mechanical only by its effect, which a script computes.** The effect script compares the
   CLAUDE.md files before and after the change, as the rule reader reads them, and the change is mechanical only if
   all three of these stay the same:
2. **the same clauses**: every rule's clause list is the same, word for word. The one allowed difference is a
   reference to another rule by its number replaced by the words of that rule's bold sentence, which the script
   maps both ways;
3. **the same covered files**: every rule applies to the same counted files. For a general rule, those are the
   counted files its CLAUDE.md covers. For a specific rule, it is its one file, or its planned file;
4. **the same rules that need a file**: the set of specific rules is the same.
5. A change that fails any of the three is conceptual, and its item says, in words the script writes, what it would
   change: for example "This rule would stop applying to: `dataset/`, `experiments/`." Measured in the loophole
   hunt: moving "No Cellpose" from the global CLAUDE.md into the models CLAUDE.md showed 0 word differences, yet it
   would let the dataset and experiment code use Cellpose; Jev scored the move 0.53 and 0.60, unsure. The
   covered-files check catches it.

## List builder

**Job:** Lays out the two numbered lists, and every follow-up pair.

**Inputs and outputs:** In: every planned change, with the effect script's result. Out: the M list and the C list,
with full detail saved in the run folder.

**Triggers it raises:** none.

**Checks it must enforce:**

1. Every run shows the user two numbered lists to agree to, together in one message, in step 9:
   - **the mechanical list**: every mechanical CLAUDE.md change (is-it-mechanical.md), each with a very short
     description of one line, grouped by kind, with a count per kind. Example: "M3. Move 'How LodeSTAR's outline is
     made' from the models CLAUDE.md to the LodeSTAR CLAUDE.md, word for word." The list opens with a header the
     effect script writes: "N items. Of the J items the effect script checks, 0 change a clause, 0 change which
     code a rule applies to, and 0 remove a rule's need for a file. K items are mechanical by the user's decision:"
     followed by those kinds with their counts (is-it-mechanical.md). A non-zero count means a conceptual item is
     on the wrong list, and the gate script fails the step. The full detail of each item (the exact text before and
     after, and the clause lists) is saved in the run folder. It is shown only if the user asks for the mechanical
     details;
   - **the conceptual list**: every conceptual change (is-it-mechanical.md). Each item opens with a diff the script
     writes, before any words of the doer's: "Removes from the rule: '…'. Adds: '…'. Stops applying to: …. Code
     changes: none" (or the number of lines). Then a description the user can understand: what it changes, why, and
     the exact rule text each option would write, with the CLAUDE.md it would go in, and the doer's recommendation
     with its reason.
2. **Items that weaken a rule, remove a file a rule needs, or put work off come first.** On the conceptual list,
   every item that removes or loosens a clause, takes away a rule's need for a file, sets a tolerance, or puts work
   off is grouped first, under the heading "These make a rule weaker, remove a file a rule needs, or put work off",
   with their count. They are confirmed by number (reading-approvals.md).
3. **The recommendation defaults to fixing the code.** When the code and a rule disagree, the recommended option is
   "fix the code". Any other recommendation must cite the rule-scope chain's answers or other evidence, and checker
   1 judges that recommendation as an item of its own.
4. Number the mechanical items M1, M2, … and the conceptual items C1, C2, …. Say how many items each list holds.
5. Nothing is written into any CLAUDE.md until the user approves (reading-approvals.md). For a conceptual item with
   several options, the user's answer names the option; approving the item's number alone approves its recommended
   option.
6. An item that depends on another says so ("goes with C4"). An item whose dependency is not approved is not
   written.
7. Each planned file line on the mechanical list is approved to be written only when its rule's clause audit passes
   (step 12), and only together with the file's heading, so that the two-way tie is written both ways at once. In
   situation (A), step 8 adds a planned file line for each specific rule, so a later run can tie each file without
   a new approval (situation-a.md).

8. Build the two lists from every item of steps 1 to 8. The effect script decides each CLAUDE.md change's list
   (is-it-mechanical.md). The mechanical list: one line per item, grouped by kind, with the script's header, and
   its full detail saved in the run folder. In situation (A), it holds a planned file line for each specific rule
   (situation-a.md). The conceptual list: each item opens with its script-written diff, then what it changes, why,
   the exact rule text of each option with its CLAUDE.md, and the doer's recommendation, which is "fix the code"
   wherever the code and a rule disagree; the items that weaken a rule, remove a file a rule needs, or put work off
   come first, under their heading. Number them M1… and C1…. State every dependency between items. Count each list.

9. A conceptual item with several options shows each option's own script-written diff, and opens with the
   recommended option's diff (LodeSTAR test, problem 16).

## Mover

**Job:** The **mover**: applies approved moves, cuts, combines, bold sentences, indents, number replacements and
renumberings by copying exact text, and asserts that every piece is found.

**Inputs and outputs:** In: approved items. Out: the written CLAUDE.md files (or, in situation A, the drafts).

**Triggers it raises:** `rule-moves.md` (a rule is to be moved, cut, combined, named, indented or renumbered).

**Checks it must enforce:**

1. In situation (A), it assembles the draft CLAUDE.md files in the run folder (situation-a.md);

2. Write the approved changes with the mover, never by retyping: new CLAUDE.md files with their copied openings;
   allowed-list changes; moves; cuts; combines; merges; bold sentences; indents; marks; number replacements;
   renumberings; exempt-group additions; and each approved conceptual text, exactly as its chosen option shows it.
   Fenced blocks, tables and tags move as single units. File lines are not written now: each is written with its
   file's heading, both halves of the two-way tie together, in step 12.

## Word-for-word comparison

**Job:** The **word-for-word comparison**: compares old and new rule texts in both directions, and prints a diff
for Jev's state (step 9).

**Inputs and outputs:** In: the CLAUDE.md files at the step's start commit and now. Out: the diff, with every
missing and added piece.

**Triggers it raises:** none.

**Checks it must enforce:**

1. Run the word-for-word comparison against the CLAUDE.md files at the step's start commit. Every old rule text
   must be in the new files, apart from the approved cut points and the approved conceptual changes. Every new text
   must be old text or approved text. Compare whole rule texts with the cut points marked. Never compare sentences
   split on full stops, which break on "e.g.", "et al." and "0.96". In situation (A), compare the written text with
   the approved list items, word for word.
2. Check that the diff holds only approved items (script comparison of the diff with the lists), and run the effect
   script on the written files: every mechanical item it checks must still show the same clauses, the same covered
   files and the same rules that need a file.

## Tie writer

**Job:** The **tie writer**: writes both halves of a two-way tie together, the heading and the file line, from the
CLAUDE.md text.

**Inputs and outputs:** In: an approved file line and its rule. Out: the heading and the file line, in one commit.

**Triggers it raises:** `tie-gap.md` (a file tied both ways has an open gap, or its rule's wording changed).

**Checks it must enforce:**

1. Its two halves are written together, in one commit, by script, and removed together. Never one without the
   other.

2. For each specific rule whose clause audit passes (its complete check, per clause), and whose file does nothing
   its rule does not ask: write the two-way tie both ways, in one commit, with the tie writer: the file's heading
   states the rule's bold sentence, and the rule's file line names the file, exactly as the approved mechanical
   item says. Nothing writes a heading earlier.

## Tie-check template

**Job:** Carries the design of each repo's own two-way tie check, with the tests it must pass.

**Inputs and outputs:** In: the repo's CLAUDE.md files and files. Out: every specific rule, counted file, exempt
file and general rule; the broken list and the not-yet-tied list, one item per line.

**Triggers it raises:** `untied-file-or-rule.md` (a counted file has no rule or no lowest-level CLAUDE.md, or
cannot carry a heading; a specific rule has no file).

**Checks it must enforce:**

### What a two-way tie is

1. A **two-way tie** links one file and one specific rule in both directions at once:
2. **file → rule**: the file's heading states the rule's bold sentence word for word, and no other rule names the
   file;
3. **rule → file**: the rule's file line names the file, and no other file's heading states the rule's bold
   sentence.

4. **File line**: an indented line under the rule, such as ``  *File:* `outline.py` ``, giving the path from that
   CLAUDE.md's folder. That is the format in senior-thesis-research (measured). Use the repo's own format.
5. **Heading**: the first line of the file's opening docstring or comment, in the file's own language (after any
   shebang or encoding line), or a Markdown file's title. It states the rule's bold sentence word for word, exactly
   as the repo's two-way tie check reads it. Step 2 writes down, for each file type in the repo, how its heading is
   written. A file whose type cannot carry a comment (JSON, images, PDFs, other binary files) cannot be tied as a
   single file. It sits in a folder of data, or in an exempt group.
6. **Folder of data**: a folder tied as a whole, both ways, to one specific rule: for example ``*File:* `./` `` for
   the CLAUDE.md's own folder, or ``*File:* `results/` ``. It counts as one file. It holds one short note whose
   title is the rule's bold sentence (in senior-thesis-research the note is `RULE.md`, measured). A folder of data
   holds no code file (tools: exempt-list builder).

### Direction 1: file → rule

7. Every file in the repo that is not on the exempt list is tied to exactly one specific rule. That rule sits in
   the lowest-level CLAUDE.md that covers the file's folder. Lowest-level means that there is no CLAUDE.md in any
   folder below that CLAUDE.md's own folder.

### Direction 2: rule → file

8. Every specific rule sits in a lowest-level CLAUDE.md and is tied to exactly one file. A folder of data with its
   note counts as one file. A specific rule marked "needed" fails until it is tied both ways (in situation A, it is
   not an open item; situation-a.md). A specific rule with no file line at all (an **unmarked** rule) fails too. A
   specific rule that sits in a CLAUDE.md that is not lowest-level fails, and is moved down (step 4).

### Marks

9. Only the marks the repo's rules and check define are used. The doer never makes up a mark.
10. **"needed"**: a specific rule that is not yet tied both ways. It fails rule → file until it is tied.

### What the script reports

11. The repo's two-way tie check (step 2) builds the lists: every specific rule; every counted file; every exempt
    file, with its group; every general rule, with its mark if it has one. It reports two kinds of failure, always
    for both directions:
12. **broken**: half of a two-way tie that is wrong. Examples: a file line naming a file that does not exist; a
    heading that states a rule of any CLAUDE.md in the repo that does not name that file; a file named by two
    rules; a rule naming two files; a heading that differs from its rule's bold sentence; a bold sentence that two
    rules share; a counted file whose nearest CLAUDE.md is not lowest-level.
13. **not yet tied**: a counted file with no rule, or a specific rule with no file (marked "needed", or unmarked).

14. Not yet tied is listed, not broken, while a run is under way: a heading and its file line are written only
    after that rule's clause audit passes (step 12), so most files are not yet tied until then. Not yet tied fails
    the final check, and the run cannot end "done" while anything is not yet tied, in either direction (in
    situation A, a "needed" rule is the one exception; situation-a.md). When step 12 leaves nothing not yet tied,
    the check's test on the real repo is switched to fail on not yet tied too, so that both directions hold at all
    times from then on.

15. Write the heading table: for each file type found in step 0, how its heading is written, or "cannot carry a
    heading". Where the repo's check already decides this, follow it. Otherwise these are reasonable choices
    (inferred): Python, the first line of the module docstring; JavaScript and TypeScript, the first text line of
    the first `/** … */` or `//` comment, after any shebang line; SQL, the first `--` comment line; shell, the
    first `#` comment line after the shebang; YAML, the first `#` comment line; Markdown, the first `# ` title.
    JSON, images, PDFs and other binary files cannot carry a heading.

16. If the check is missing, build it test-first, using the repo's test-first rule and skill. If it exists, compare
    its tests with the list below. Add each missing test first, and watch it fail before changing the check. Prove
    a failure only on a temporary copy; never break a real CLAUDE.md in place (the simulation did this once, and
    its checker objected; measured).
17. The tests, each on a small made-up repo in a temporary folder:
   - **file → rule**: a counted file tied to exactly one specific rule in its nearest CLAUDE.md, which is
     lowest-level, passes; a counted file with no rule is listed as not yet tied; a counted file whose nearest
     CLAUDE.md is not lowest-level fails; a file named by two rules fails; a heading that states a rule of any
     CLAUDE.md in the repo that does not name that file fails, not only a rule of the nearest CLAUDE.md (the live
     test's check read only the nearest one; measured); a heading that differs from its rule's bold sentence by one
     character fails;
   - **rule → file**: a specific rule tied to exactly one existing file passes; a rule naming a file that does not
     exist fails; a rule with two file lines fails; a rule naming a file outside the folder of its CLAUDE.md fails;
     a specific rule marked "needed" is listed as not yet tied; an unmarked specific rule is listed as not yet
     tied; a general rule marked "the whole folder" is listed as general, not as untied;
   - **folders of data**: one with its note passes; one without its note fails; one whose note has a wrong title
     fails; a rule tying its own folder (`./`) works; a folder of data named outside the folder of the CLAUDE.md
     that names it fails; a folder of data that holds a code file (tools: exempt-list builder) fails; a migrations
     folder is tied, both ways, as one folder of data;
   - **the exempt list, by pattern and by content**: each group's patterns place their files only when the group's
     content rule holds; a file no pattern places is counted; a file named like a test from which the test runner
     collects no test is counted; a test helper that product code imports fails; a docs folder that holds a code
     file fails; a README-type file below a folder's top is counted, and one that a counted file reads fails; an
     empty-package file that holds code is counted (the live repo's pattern matched any file starting and ending
     with a docstring; measured by the loophole hunt); a generated file whose rebuild differs fails, and a
     generator holding more than 5 lines of its output word for word fails; what was copied into `.claude/` from
     elsewhere is exempt, and a skill whose master copy is this repo is counted; the CLAUDE.md files and
     `.gitignore` are placed in their groups; names are matched by whole path parts, so `contests/` and `latests/`
     are not tests (senior-thesis-research's check skipped any path containing "tests/"; measured by the
     adversarial review);
   - **the import and call test**: any exempt file that a counted file imports, calls, names in a dynamic import, a
     module runner, an exec or a subprocess call, or adds to the import path, fails, tool settings read as settings
     aside; a git-ignored file present on disk that a counted file imports fails;
   - **reading CLAUDE.md files**: rules in every shape the repo uses are read (numbered items, top-level `- **`
     bullets); a numbered or bulleted rule with no bold sentence is listed as unnamed, never skipped
     (conference-matching-api's check silently skips two such rules; measured by the system-rules study); two rules
     that share one bold sentence fail, whether they sit in one CLAUDE.md or in different ones, and whether their
     texts agree or not, and the check says whether the copies' texts agree (conference-matching-api has "The
     steps, in order." as the bold sentence of two different rules in six places, and its copies disagree; measured
     by the system-rules study); a sub-rule is read as part of its parent rule's text and needs no file of its own;
     a file line not directly under its rule (for example after a category heading) fails; a non-blank line in a
     lowest-level CLAUDE.md that is not a heading, the copied opening, the System Rules block, part of a rule's
     text, or a file line fails; the copied opening and the System Rules block are skipped by their exact text,
     never by a rule number or by a heading's first words; a rule under a category heading that starts like the
     opening's heading is still read; a higher CLAUDE.md is not read for file lines; no rule is found by its
     number;
   - **headings**: a heading is read in every file type of the heading table, including after a shebang or encoding
     line, and in a block comment whose first line is empty; a file whose type cannot carry a heading, outside a
     folder of data and not exempt, is listed as unable to be tied;
   - **the two kinds of failure**: broken fails the test run; not yet tied is listed, in both directions, and does
     not fail the test run until the switch of tools: tie-check template is made; the check prints its broken list
     one item per line, in a stable order, so that the gate can compare it with the baseline's item by item.
18. Add one test that runs the check on the real repo and fails on anything broken.
19. Make the check run in the full test command and in every CI path that a change to a CLAUDE.md, a data note or a
    file tied both ways triggers. Prove it. If the repo's CI has a change filter, give it a change that touches
    only a CLAUDE.md, one that touches only a data note, and one inside each version folder, and show the check
    runs each time. Example: in conference-matching-api, a change to CLAUDE.md files only skipped the job that runs
    the check (measured by the dry run). If draft pull requests run no CI, say so in the record.
20. Say where the system rule that a check confirms every two-way tie sits, and where the check's file sits. The
    check is audited clause by clause in steps 7 and 12, like any rule that code carries out. Where the check's
    file sits under an exempt tests folder, its rule is still audited, and the record says where the code that
    carries it out lives (in the empty-repo simulation it sat under the tests folder; measured).

## Exempt-list builder

**Job:** The **exempt-list builder**, with each group's content rule and the import and call test.

**Inputs and outputs:** In: the repo's files and its path patterns. Out: each exempt file with its group, or
"counted".

**Triggers it raises:** `exempt-list.md` (the exempt-list builder refuses a file, or a repo rule lists the exempt
groups differently).

**Checks it must enforce:**

1. **Code file**: a file in a programming or scripting language, known by its extension or by a first line that
   names an interpreter, including notebooks and shell scripts; and any other file that a counted file reads to
   decide what it does (for example a settings file that lists the steps to run). A folder of data holds no code
   file (tools: tie-check template).

2. The exempt list is fixed and written down, as part of the repo's two-way tie check (step 2). Each entry is a
   path pattern, with the group it belongs to, the group's content rule, and the reason. A script decides which
   files are exempt. Any file the script cannot place counts as not exempt.
3. The user decided that these groups are mechanical, and the doer's choice:
4. **Not counted** (these files need no tie). A file is placed in a group only when its pattern matches and its
   content passes the group's content rule:
   - **tests**, and the helpers inside test folders. Content rule: the repo's test runner collects at least one
     test from the file, or every file that imports it is such a test file, or the test runner loads it as
     configuration (for example pytest's `conftest.py`; LodeSTAR test, problem 13);
   - **docs**, including a folder's overview at its top. Content rule: a docs folder holds no code file; a
     README-type overview is exempt only at the top of a folder, and only if no counted file reads it;
   - **tool settings**: test settings, lint and type-checker settings, CI workflow files, package manifests and
     lockfiles, the dependency list, and version-control settings such as `.gitignore`. Content rule: the file is
     read by a tool, not imported or run by the repo's own code;
   - **the CLAUDE.md files themselves**: they hold the rules, and the hierarchy checks check them (tools: hierarchy
     checks);
   - **what was installed or copied into `.claude/` from elsewhere**: plugins, and skills whose master copy is
     another repo, such as a copy of this skill under `.claude/skills/verify-rules/`. A skill whose master copy is
     this repo is counted and tied both ways like any other code. Skills copied in are still written test-first in
     their own repo;
   - **generated files** that a tied file rebuilds by a command. The generator is tied both ways, not its output.
     Content rule: the script rebuilds each one in a temporary copy and compares the bytes, and the generator does
     not hold more than 5 lines of its output word for word (more means the code is hiding in the generator as
     text). The two-way tie check lists each generated file with its generator;
   - **the empty file that lets other code use a folder's code**, where the repo's rules exempt it (both repos seen
     so far do; measured from their CLAUDE.md files). Content rule: the file's parse holds nothing but comments, a
     docstring, and the names it passes on.
5. **Must be tied, both ways**:
   - all other code;
   - data, as a whole folder with its note. Database migrations, which are a record of every change, count as one
     folder of data.
6. **Exempt by content, never by name alone.** On top of each group's content rule, the script runs an import and
   call test over the whole repo:
7. any exempt file that a counted file imports, calls, or names in a string passed to a dynamic import, a module
   runner, an exec or a subprocess call, or adds to the import path, fails. Tool settings that the code reads as
   settings are the one exception;
8. a git-ignored file that exists on disk and that a counted file imports fails.
9. Measured in the loophole hunt: 220 lines of product code escaped the repo's check in eight ways (renamed with a
   `test_` prefix, renamed `conftest.py`, moved under `docs/`, moved under `contests/`, moved into a data folder,
   pasted into an empty-package file, saved as `README.md`, and git-ignored). The empty-package pattern matched any
   file that starts and ends with a docstring. Measured in the live test: Jev passed production code hidden in real
   `tests/` and `docs/` folders at 0.84 to 0.95, and still at 0.90 when the state said a counted file imports it.
10. **Jev's part is only to flag names that look exempt but are not.** Jev is asked only about files the script has
    placed in a group: "Does `<file>` belong to the exempt group `<group>`, as that group is defined?" The state is
    the group's definition and content rule, the whole file, and the script's list of the files that import it. Jev
    may only fail the file (below 0.92, provisional); it never makes a file exempt. In the live test, Jev failed
    `contests/` at 0.03 and `latests` at 0.05 (measured).
11. **The exempt count may not grow unnoticed.** The pack shows the count of exempt files per group against the
    baseline. Every file that became exempt during the run is an item for checker 1.

12. Path patterns are written per repo, from its own layout, in step 2. Examples (inferred): `tests/**` and
    `**/test_*.py` for tests; `docs/**` and a folder's top `README.md` for docs; `.github/workflows/**`,
    `package.json`, `package-lock.json`, `requirements.txt` and `.gitignore` for tool settings; `**/CLAUDE.md`.
    Patterns match whole path parts, never substrings, so `contests/` is not `tests/`.

13. Write the exempt list into the check with the exempt-list builder: path patterns, each with its group, its
    content rule and its reason, and the import and call test. A file no pattern places is counted. Each generated
    file is listed with its generator.

## Tie-stage check

**Job:** Runs the user's four-part check of the two-way ties, in the user's order.

**Inputs and outputs:** In: the tie check's lists, the clause tables, the function-to-clause tables. Out: a verdict
per part, per clause, per piece and per file.

**Triggers it raises:** none.

**Checks it must enforce:**

1. The user calls the check of the two-way ties "probably the most important" part of the skill, and fixed its four
   parts and their order. In the user's words:
2. "If there is no file associated with the rule, it's failed already."
3. "If there is, for every ClaudeMD rule where it's attached a file, you run Jev on the rule and the file to see if
   everything's satisfied for each ClaudeMD rule."
4. "After that, you go through each file which is not on the list of exemptions, and then it will be tied to a
   specific rule. … Jev will double-check the rule and see if it satisfies."
5. "There will be a final check …, which sees if one file contains multiple [rules]." Later, on how to build it:
   "Is this file free of other rules jobs? How do you recommend we implement this?"
6. The check is set out here once, and the steps point to it: step 2 builds its script parts; step 12 writes the
   two-way ties and runs it; step 14 runs it again inside the final check. Its four parts run in the user's order.
   The live test ran every part on a copy of senior-thesis-research with 287 real Jev calls and planted faults, and
   measured how well each checker answers each part. Each part below says who answers it and why, and tools:
   tie-stage check puts it in one table.

### Part 1: a rule with no file fails (script)

7. The script goes through every rule that must be tied to a specific file: every specific rule. A rule with no
   file, or naming a file that does not exist, fails at once.
8. **Who answers: the script, with Jev on its output.** Whether a file line exists and names an existing file is an
   exact fact, decided by the script. Jev is asked on the script's output ("Does this output show a pass?"), and
   may only fail it (audit fix 2).

### Part 2: rule → file (the script, the Claude checker, and Jev, which may only fail)

9. For every rule with a file attached, the rule is checked against the file, to see whether everything the rule
   asks is satisfied: first clause by clause, then per rule.
10. **Per clause.** Jev gets one request per clause: "Does `<file>` carry out this clause of its rule: '<clause>'?"
    The state holds only the clause, the rule's whole text, and the file itself. It never holds the clause's test
    or its mutation output.
11. **Jev may only fail a clause.** A p below 0.35 fails it. A clause passes only when the script's single-mutation
    evidence shows it tested (tools: mutation runner) and the Claude checker passes it. Whether a clause is tested
    is decided by the script alone and is never put in Jev's state.
12. **Why**, measured in the live test:
   - with the test and mutation output in its state, Jev answered "is it tested?" instead of "is it carried out?":
     it scored 10 of 41 right clauses below 0.5, for example 0.36 for `EXAMPLE_THRESHOLD = 0.9` and 0.18 for a
     three-name list of experiments; re-asked on the code alone, 4 of 5 of these rose to 0.88–0.97;
   - on the code alone, Jev passed 8 of 19 real single-element breaks at 0.8 or more, for example `> 0.5` changed
     to `>= 0.5` at 0.84. So a Jev "yes" never passes a clause.
13. **Per rule.** First the script checks that every clause of the rule has passed. Then Jev gets one request per
    rule: "Does this clause list cover every requirement of the rule's text?" The state is the rule's whole text
    and the script's clause table, each clause with its span. Its thresholds are 0.8 and 0.5 until it is calibrated
    (tools: thresholds and calibration). The Claude checker judges every rule of part 2.
14. **Why**: the old per-rule question ("Does `<file>` do everything its rule asks?") only mirrored the clause
    verdicts, and separated nothing (right items 0.07–0.96, wrong items 0.07–0.21; measured in the live test). On
    the clause-list question, Jev failed a list with two requirements dropped at 0.09, but passed a list with eight
    clauses merged into four at 0.87 (measured in the loophole hunt). Merged clauses are caught by the script's
    floor on the clause count instead (tools: coverage tables).
15. **Folders of data.** For a folder tied as a whole, "the file itself" is the folder's note together with the
    script's listing of the folder: every file's name and size, and, for each text file, its first lines or its
    column names. A clause about the data is checked against that listing and against the code that writes the
    folder. Its "pieces" (parts 3 and 4) are the files in it.

### Part 3: file → rule (the script, then Jev, then the Claude checker)

16. Part 3 asks two things of every counted file: does it do everything its rule asks, and is everything in it
    asked for by its rule (a reading of the user's words, waiting for confirmation on list C; audit fix 9).
17. **The script first.** Every counted file must be tied to one specific rule, in the lowest-level CLAUDE.md that
    covers it. A file with none fails at once.
18. **Does the file do everything its rule asks?** The script confirms that part 2 passed every clause of the
    file's rule, and passed the rule's clause-list question. Nothing new is asked.

**Is everything in the file asked for by its rule?**

1. The script builds the file's function-to-clause table (tools: coverage tables). Every piece of the file, private
   ones included, is mapped to the clauses whose cited lines it holds: clauses of its own rule, or of a general
   rule over its folder. **Every piece that maps to no clause is an extra piece, automatically.** The doer cannot
   answer "none". Each extra piece goes to file-does-more.md.
2. For each mapped piece, Jev confirms the mapping with the rule-scope chain's question 1, asked of the file's own
   rule: "Does this sentence of this file's rule require what this piece of code does?" The state is the piece's
   code, what it writes, who calls it, and every sentence the piece maps to, of its own rule and of the general
   rules over its folder together (LodeSTAR test, problem 3: measured, outline() scored 0.25 against its bold
   sentence and 0.86 against its specific one). Thresholds 0.75 and 0.45. A piece that fails is an extra piece.
   This stops a doer from citing a whole file as one clause's lines.
3. Then Jev gets one request per file, as a weak signal: "Does everything in `<file>` serve its rule '<bold
   sentence>', with no part doing something its rule does not ask for?" The state is the file itself, its rule's
   whole text, the general rules over its folder, and the function-to-clause table. Thresholds 0.73 and 0.19.
4. The Claude checker must pass every file.
5. **Why**, measured: per file, right files scored 0.20–0.91 and wrong ones 0.10–0.72 in the live test. At 0.73 and
   0.19 no measured item is wrongly passed or failed, but 13 of 21 fall between, and go to the second Claude
   checker (tools: Claude-checker launcher). The per-file question is still worth asking: it caught both planted
   second jobs that the old part 4 missed (0.16 and 0.31 in the loophole hunt; 0.11 and 0.20 in the live test). The
   table and the per-piece questions carry the weight; the per-file answer is a signal on top.

### Part 4: one file, one rule (the script, Jev per piece, and the Claude checker)

6. Part 4 asks whether one file carries out the jobs of several rules.

7. The user had left both the checker ("I don't know if you use [Jev or an] LLM") and how Jev is asked ("regarding
   sending it to Jev, it's just up to you, mechanically") to the doer, so part 4 is built as recommended: piece by
   piece, against candidate rules the script picks, with the Claude checker on every file, because one question
   about the whole file was measured to separate nothing.

8. **Why it is asked piece by piece.** Asked as one question about the whole file ("Is `<file>` free of the job of
   every other rule?"), right files scored 0.20–0.54 and wrong files 0.23–0.43 in the live test. The two groups
   overlapped completely, 11 of 12 right files fell below 0.5, and an improved state did no better (measured). In
   the loophole hunt, a file holding a whole second rule's job scored 0.69, and in the empty-repo simulation a file
   that also marked books read scored 0.61 and 0.70 (measured). Jev cannot judge a whole file against many rules at
   once. On small questions about one piece and one sentence, it separated right from wrong 8 times out of 8. So:
9. **The script cuts the file into pieces** (tools: piece cutter), and lists, for each piece, what it writes and
   who calls it.
10. **Each piece is matched to its own rule** by part 3's function-to-clause table. A piece that carries out a
    clause of its own rule, or of a general rule over its folder (such as "every save is written whole or not at
    all"), is fine. A piece left over is already an extra piece (part 3).
11. **The script picks the candidate rules for each piece**: every other rule of the same CLAUDE.md, and every rule
    anywhere in the repo whose key words appear in the piece (its names, its strings, and the paths it writes),
    leaving out the general rules over the piece's folder, which the point above already counts as fine (LodeSTAR
    test, problem 8: train() was flagged against "Long jobs save as they go." at 0.81).
12. **Jev is asked per candidate rule first, then per sentence** (LodeSTAR test, problem 1): for each piece and
    each candidate rule, Jev is first asked question 1 on the rule's whole text, and only where the rule scores
    above the fail line is the piece asked again, once per sentence of that rule, the rule-scope chain's question
    1: "Does this sentence of another rule require what this piece of code does?" The state is the piece's code,
    what it writes, who calls it, and the one candidate sentence with its rule's bold sentence. Thresholds 0.75 and
    0.45 (provisional). Measured in the live test: right pieces scored 0.79–0.92 and wrong ones 0.09–0.39, and the
    planted fault that moved hit counting into the graph file was flagged at 0.92. The sample is small (8 items),
    so these thresholds are fixed again as runs add items (tools: thresholds and calibration).
13. **Any yes means the piece is another rule's job.** It moves to that rule's file, as a rule-scope ending
    (file-does-more.md). If the two rules really make one result, they are combined instead, and that is a
    conceptual item. An unsure answer goes to the second Claude checker (tools: Claude-checker launcher).
14. **Some cases fail by script alone**: a file named by two rules; a bold sentence two rules share; two files that
    write the same output path; and the same code in two files (duplicates.md).
15. **The Claude checker must also pass every file.** It reads the file with every rule around it, which catches
    what the small questions miss.
16. **Cost.** Asked per piece and per candidate sentence, part 4 took 1,617 of the 2,883 Jev calls that one round
    on the LodeSTAR folder needed (44 pieces × about 37 candidate sentences; measured, LodeSTAR test, problem 1),
    not the 20 to 30 calls per 100-line file first inferred from the live test. Asking per candidate rule first
    leaves about one call per piece per candidate rule, plus the sentences of the rules above the fail line
    (inferred).

### The conditions that still hold

17. These are checked in the same stage:
18. the file's heading states the rule's bold sentence word for word (script);
19. general rules are not tied, but are accounted for (general-or-specific.md): each one classified, each
    whole-folder mark checked, and each clause checked in every folder the rule covers;
20. the exempt list holds: every exempt file is placed by pattern and by content, and passes the import and call
    test, by script; Jev only flags names that look exempt but are not (tools: exempt-list builder).

### Who answers each part, and why

21. The numbers are measured in the live test unless another source is named. The thresholds are the provisional
    ones of tools: thresholds and calibration.

| Part | Script | Jev | Claude checker | Why |
|---|---|---|---|---|
| 1. A rule with no file | decides alone | asked on the script's output ("Does this output show a pass?"); may only fail (audit fix 2) | re-runs the script | an exact fact |
| 2. Rule → file, per clause | decides "tested": a generated single mutation inside the clause's lines makes a named test fail | may only fail (below 0.35); its state never holds test output | must pass every clause | on code alone, Jev passed 8 of 19 real single-element breaks at 0.8 or more; with test output in its state, it answered "is it tested?" and failed 10 of 41 right clauses |
| 2. Rule → file, per rule | every clause passed | "Does this clause list cover every requirement of the rule's text?" (0.8 / 0.5, not yet calibrated) | must pass every rule | the old per-rule question separated nothing (right 0.07–0.96, wrong 0.07–0.21); Jev failed a list missing two requirements at 0.09 (loophole hunt) |
| 3. File → rule | tied to one rule; the function-to-clause table, where every unmapped piece is an extra piece | per mapped piece, question 1 on its own rule (0.75 / 0.45); per file, a weak signal (0.73 / 0.19) | must pass every file | per file, right 0.20–0.91 and wrong 0.10–0.72: no measured error at 0.73 / 0.19, but 13 of 21 unsure |
| 4. One file, one rule | fails two rules naming one file, a shared bold sentence, one output path written by two files, and the same code in two files; picks the candidate rules | per piece and candidate rule, then per sentence of a rule above the fail line, question 1 (0.75 / 0.45) | must pass every file | whole-file question: right 0.20–0.54 and wrong 0.23–0.43, no separation; per piece: 8 of 8 separated |
| Exempt files (tools: exempt-list builder) | decides by pattern, content, imports and calls | may only fail (below 0.92) | re-judges every file that became exempt | Jev passed production code hidden in real `tests/` and `docs/` folders at 0.84–0.95 |

## Number search

**Job:** The **number search**: finds every place in a CLAUDE.md, a code file or a doc that cites a rule by number.

**Inputs and outputs:** In: every CLAUDE.md, code file and doc. Out: every hit, with its place.

**Triggers it raises:** `number-reference.md` (the number search finds a hit).

**Checks it must enforce:**

1. It reports every hit with its file, its line and the number cited, and whether that number points to a rule that
   exists; number-reference.md gives each hit its verdict.

2. It searches CLAUDE.md files, code files and docs alike, so that step 9 can update every citation, and it lists
   the programs that read CLAUDE.md files by file and number.

## Duplicate finder

**Job:** The **duplicate finder**.

**Inputs and outputs:** In: every CLAUDE.md and all the code. Out: every candidate pair, with the script's diff.

**Triggers it raises:** `duplicates.md` (the duplicate finder lists a candidate pair).

**Checks it must enforce:**

1. **Detection: the script first.** The duplicate finder lists candidate pairs. It is tuned to miss nothing; every
   candidate then gets a verdict:
2. rules: the same bold sentence; the same clause text in two rules; and near-identical rule texts across all the
   CLAUDE.md files (after case and punctuation are removed, at least 60% of the shorter text's words, in order,
   appear in the longer one); and near-identical clauses: the same 60% test is run per sentence, between sentences
   of different rules (LodeSTAR test, problem 9: whole-rule tests missed models:25 against experiments:19);
3. code: identical or near-identical pieces by syntax tree or by tokens (names and literals replaced by
   placeholders, at least 0.9 similarity, a length ratio of at most 1.5, over at least 8 lines; LodeSTAR test,
   problem 9: at 60% of tokens over 5 lines it gave 2,271 pairs in 30 files); two files that write the same output
   path; and every clause the mutation runner listed as carried out twice.
4. **Then Jev and the Claude checker, per candidate pair.** For two rules: "Do these two rules require the same
   thing?" For two pieces of code: "Do these two pieces of code do the same job?" The state is the script's diff of
   the two and the two short texts themselves (two rule texts, or two pieces, never two whole files). Yes means a
   duplicate. Both checkers must answer the same way for the verdict to stand. An unsure answer, or a disagreement,
   puts the pair on the conceptual list with the doer's recommendation. A pair with identical text is a duplicate
   by script alone.

5. **When it runs:** on the rules in step 1 and step 4; on the code in steps 5 and 7, and in part 4 of the
   tie-stage check (tools: tie-stage check); and always in the final check, on the whole repo (step 14), because
   several agents working on one repo at once are its main cause.

6. **Duplicates**: every candidate pair of the duplicate finder gets a verdict (duplicates.md).

## Model text and structure check

**Job:** The **model text** of the structure and the system rules, taken from conference-matching-api's global
CLAUDE.md where it holds them in full, and from system-rules.md otherwise.

**Inputs and outputs:** In: the repo's CLAUDE.md files. Out: each part of the structure found or missing; the model
text for each missing part.

**Triggers it raises:** `system-rules.md` (step 1 finds a system rule missing, held in part, or worded to require
something different); `system-rules-block.md` (the System Rules block is missing, different, or met by a reader).

**Checks it must enforce:**

1. So conference-matching-api's global CLAUDE.md is the model. The skill ships a model text of the structure and of
   every system rule, so it works in any repo without reaching that repo:

2. where that file holds a rule in full, the model text is that rule's text;
3. where it does not, the model text is the rule's own wording in system-rules.md, without its section pointers.
   Measured in the empty-repo simulation: that file holds only 12 of the system rules in full, and its summary and
   its dependency rule (which runs one app's own command) are specific to that app;
4. the model summary has one slot, the project's name. Filling it is mechanical;
5. the model dependency rule names the one dependency file in the repo's own language and tooling, and says how
   that file is kept up to date there;
6. the model decision rule (item 6 below) says that a decision about one run only, such as its budgets, is kept in
   that run's record, not in a CLAUDE.md. So the clash of rule-conflict.md does not arise in a repo set up by the
   skill.

### The structure

7. The global CLAUDE.md opens with the summary of what the CLAUDE.md files are.
8. It holds the rule that lists which CLAUDE.md files are allowed, as a tree.
9. The summary says that the CLAUDE.md files outrank everything below them (in both repos seen so far: "When
   anything at a lower level conflicts with a CLAUDE.md, the CLAUDE.md wins"; measured). Step 1 checks that idea
   there, in the global summary and in every copy of it.
10. The personal System Rules block (system-rules-block.md) sits in the global CLAUDE.md as one unit, which the
    readers skip (tools: rule reader).

11. Check the structure by script: the global CLAUDE.md opens with the summary; it holds the rule that lists the
    allowed CLAUDE.md files as a tree; each lower CLAUDE.md opens with the copied opening, word for word. In every
    situation, a missing part gets a mechanical item, with the model text as its proposed text; in situation (A),
    the model summary's one slot is filled with the project's name. A part that is present but requires something
    different gets a conceptual item. The allowed-tree rule is a mechanical item where it lists exactly the
    CLAUDE.md files that exist; each new CLAUDE.md, and every entry for one that does not exist yet, is a
    conceptual item (is-it-mechanical.md).

## Hierarchy checks

**Job:** Runs the ten hierarchy checks; all must pass.

**Inputs and outputs:** In: every CLAUDE.md. Out: a verdict per check, per CLAUDE.md, rule or name it covers.

**Triggers it raises:** `hierarchy-failure.md` (a hierarchy check fails in text the user wrote).

**Checks it must enforce:**

1. Checks 1, 2, 5 and 10, and the listing parts of checks 6 and 7, are decided by script. The rest are judged by
   Jev and the Claude checker, as correct-check items, one request per CLAUDE.md, rule or name each check covers,
   with the check's text as the instructions. Checks 5 to 8 skip the copied opening and the System Rules block by
   their exact text (system-rules-block.md).

2. Every CLAUDE.md in the repo is in an allowed list (the global list together with each version folder's own
   list), every listed one exists, and each list's tree matches the folders on disk. Per CLAUDE.md.
3. Each lower CLAUDE.md opens with the summary and the rule never to change a CLAUDE.md, word for word as in the
   global one. Per lower CLAUDE.md.
4. Every specific rule sits in a lowest-level CLAUDE.md, as low as it can. Per specific rule.
5. The two-way ties hold, both ways (tools: tie-check template; tools: tie-stage check): every counted file is tied
   to exactly one specific rule, in the lowest-level CLAUDE.md that covers it, and every specific rule is tied to
   exactly one file. Per counted file and per specific rule, by the tie-stage check.
6. No rule refers to another rule by its number. A rule's own numbered steps, cited together with the rule's idea,
   and IDs from outside standards, are allowed. Code and docs that cite rule numbers are listed. Per hit of the
   number search.
7. No CLAUDE.md names a file, except the dependency file and the one file (or folder of data) of each specific
   rule, in its file line. Per file name found in a CLAUDE.md.
8. Rules are grouped in categories, each under a heading. No text stands outside a heading, the copied opening, the
   global CLAUDE.md's own summary, the System Rules block, or a rule's text. Per CLAUDE.md.
9. The CLAUDE.md files hold only rules: no status, progress, notes, or names of current implementations. A switch
   the user sets (such as a mode line) and a stack choice the user made are rules, not status. Per rule.
10. Every decision in this run's question log is written into a CLAUDE.md, as the repo's rules ask. A decision
    about this run only stays in the run's record (rule-conflict.md). Per decision.
11. Nothing is duplicated without a purpose: no rule appears twice across all the CLAUDE.md files, unless a rule
    states the purpose (duplicates.md). Per candidate pair of the duplicate finder.

## Piece cutter

**Job:** The **piece cutter** and the **function-to-clause table builder**.

**Inputs and outputs:** In: a file. Out: its pieces, each with what it writes and who calls it.

**Triggers it raises:** none.

**Checks it must enforce:**

1. **Piece**: one part of a file as the script cuts it by its syntax tree: each function, class and method, each
   top-level statement, and each branch inside them. For a file the script cannot parse, each block of lines
   between blank lines is a piece. Parts 3 and 4 of the tie-stage check work piece by piece (tools: tie-stage
   check).

## Function-to-clause table builder

**Job:** The **piece gatherer** for the rule-scope chain: each piece's code, what it writes, who calls it, and
other rules' sentences on its subject, and the candidate rules for part 4.

**Inputs and outputs:** In: a file's pieces and its clauses' cited lines. Out: the function-to-clause table; each
extra piece with its gathered state.

**Triggers it raises:** `file-does-more.md` (a piece maps to no clause of its rule, or a piece does another rule's
job); `question-chain.md` (an extra piece needs its ending).

**Checks it must enforce:**

1. **3. Function → clause.** One row per piece of every tied or planned file (tools: piece cutter), private pieces
   included, built from the file's syntax tree.
2. Each piece is mapped to the clause ids whose cited lines it holds: clauses of the file's own rule, or of a
   general rule over its folder.
3. **Every piece that maps to no clause is an extra piece, automatically**, and goes to file-does-more.md. The doer
   cannot answer "none".
4. Each mapped piece is confirmed by Jev with question 1 against its own rule (tools: tie-stage check), so that
   citing a whole file for one clause does not hide an extra piece.
5. A file that writes an output path which another rule's file also writes fails by script (duplicates.md).
6. The floor: every piece of every tied or planned file is in the table.

7. **A citation of more than about 30% of a file is refused**, unless the clause is a "never" or "only" clause
   checked by a search (LodeSTAR test, problem 7: general clauses citing lines 1 to 84 left 0 extra pieces in 44).

## Mutation runner

**Job:** The **mutation runner**: generates single mutations from its fixed operators inside a clause's cited
lines, runs the named test in a temporary copy, and checks the six conditions of a tested clause.

**Inputs and outputs:** In: a clause, its cited lines and its named test. Out: the mutation evidence, or "not
testable here" with its cause.

**Triggers it raises:** `untestable-clause.md` (a clause is not a requirement, or no single mutation is possible
inside its lines).

**Checks it must enforce:**

1. **Tested**: a clause counts as tested only when all of these hold, each decided by script (tools: coverage
   tables):
   - the mutation runner made one single mutation from its fixed operators (flip a comparison, move a literal by
     one, delete one statement, swap one name for another in scope, swap one string literal for another; LodeSTAR
     test, problem 6); the doer never writes a mutation;
   - the mutation sits inside the lines cited for that clause, and changes an element the clause names: its number,
     its keyword or a name it uses (LodeSTAR test, problem 6);
   - no other clause is backed by the same mutation (by the hash of its diff), and no two clauses cite the same
     lines (LodeSTAR test, problem 6);
   - a named test in the repo's suite fails on the mutated copy, on an assertion or on an exception raised inside
     the mutated lines, not on a missing import, a syntax error or an exception raised elsewhere (LodeSTAR test,
     problem 6: breaks in numeric code crash with IndexError);
   - the same test passes on the unbroken code;
   - the named test does not read any counted source file, unless the clause is a "never" or "only" clause tested
     by a search;
   - the Claude checker confirms each mutation's credit: the mutation breaks what the clause says, and the test
     fails because of it (LodeSTAR test, problem 6).
2. The mutation is made in a temporary copy outside the repo. A combined mutation that breaks several elements at
   once does not count. In the simulation, a mutation that removed two directions together hid an untested one
   until the final audit (measured). In the loophole hunt, one crude mutation reused for three clauses, and a test
   that only searched the source, each made an untested clause look tested (measured). Golden comparisons prove
   "same"; they never count as a clause's test.

3. **2. Clause → mutation.** One row per clause of kind "requirement": the clause, its cited file and lines, the
   mutation the runner generated, the hash of its diff, the named test, the failing assertion's line, and the named
   test's pass on the unbroken code.
4. The mutation runner generates the mutations itself, from fixed operators only: flip a comparison, move a literal
   by one, delete one statement, swap one name for another in scope, swap one string literal for another. It
   applies them only inside the lines cited for that clause, one at a time, in a temporary copy outside the repo.
   The doer writes none.
5. A clause counts as tested only under the conditions above: one single mutation, inside its lines and changing an
   element the clause names, backing no other clause and sharing no citation, failing a named test on an assertion
   or on an exception inside the mutated lines, the test passing on the unbroken code, the test reading no counted
   source file (search tests of "never" and "only" clauses aside), and the Claude checker confirming the credit.
6. The floor: every clause of kind "requirement" has a row that meets all six, or is listed as "not testable here"
   with its cause (untestable-clause.md), or is a gap.
7. Measured in the loophole hunt, on the real `optimal_counts` in senior-thesis-research with a test that checked
   only one of three counts: honest single mutations showed two of the three clauses untested; one crude two-line
   mutation, reused for all three, showed all three "tested"; a test that only searched the source did the same.

8. **Mutation evidence**, which proves a clause is tested, has these parts: the single change the mutation runner
   generated from its fixed operators, inside the clause's cited lines (a diff, with its hash, made in a temporary
   copy outside the repo); the named test's output on that change, failing on an assertion or on an exception
   inside the mutated lines; the same test passing on the unbroken code; and the script's check that the test reads
   no counted source file.

9. **A cap per clause, aimed at the clause's own element** (LodeSTAR test, problem 1): the runner makes at most a
   set number of single mutations per clause, a setting it ships with (a mechanical choice, to be calibrated), and
   picks first the mutations that change an element the clause names (its number or its keyword). Measured:
   uncapped, one clause gave 308 single mutations and took about 12 minutes.

## Golden harness

**Job:** The **capture and compare harness** for golden outputs, with its import adapter as the only part that may
change during a restructure, its line-coverage report, and its check of every normalisation (steps 6 and 10).

**Inputs and outputs:** In: fixed inputs and the code at a commit. Out: golden outputs, their comparison with
counts, and line coverage.

**Triggers it raises:** `golden-capture.md` (step 6 starts, or two golden captures differ).

**Checks it must enforce:**

1. **Golden outputs**: what the code produces or does on fixed inputs, recorded before code is restructured, so any
   later change can be detected exactly. This covers return values, files, database state, HTTP responses,
   generated and built files, and logs and other side effects. Values that are random or time-based by design are
   recorded with a stated normalisation, or checked by a property instead of by equality (step 6). The golden
   inputs are measured by line coverage: every line of a planned file that no golden input runs is an item (tools:
   coverage tables).

2. **4. Golden inputs → line coverage.** The golden inputs (step 6) are run under a coverage tool for the repo's
   language.
3. Every line of every planned file that no golden input runs is an item: an input is added that runs it, or the
   reason it cannot be run is recorded, and checker 1 judges that reason.
4. The floor: no line is left uncovered without a recorded reason.

5. The golden harness may change only its import adapter, so that it reaches each old public name at its new place.
   A script diffs the harness against its copy from step 6, and any other change fails the step.

## Freshness script

**Job:** Decides, for each kept result, whether it was made by the code now in the repo.

**Inputs and outputs:** In: each kept result's record and the git history. Out: current, not current, or untraced.

**Triggers it raises:** `kept-results.md` (a kept result is not current or is untraced; a file quotes a result).

**Checks it must enforce:**

1. Check freshness by script. A result is current when `git diff <producing commit> HEAD` shows no change outside
   the results folders, the docs and the CLAUDE.md files. The producing commit is the one named in the result's own
   record. A result's commit field may change only in a commit that also changes the result's values, matches a
   compute job the budget keeper logged, and holds the hash of the fetched output; the script checks all three. A
   result that names no commit is untraced: the user decided in step 0's budget question whether it is rerun
   (budget.md). Measured in the loophole hunt: senior-thesis-research's results name no commit today, so all three
   of its experiments would be untraced.

## Situation detector

**Job:** Detects the run's situation by script, from what is on disk.

**Inputs and outputs:** In: the counts of counted files and CLAUDE.md files, and the two-way tie check's output.
Out: A, B, C or D, with the steps that will run.

**Triggers it raises:** `situation-a.md` (step 0 finds no counted file and no CLAUDE.md: situation A, an empty or
new repo); `interview.md` (step 0 finds situation A or B, or a part of the repo that no CLAUDE.md describes);
`quick-check.md` (step 0 finds situation D and a quick check is asked for).

**Checks it must enforce:**

1. **Step 0 detects the situation by script**, from what is on disk, and records it in the state and the record:
2. **(A) Empty or new repo**: no counted file (tools: exempt-list builder) and no CLAUDE.md file. A repo with no
   commit at all is in situation (A).
3. **(B) Code but no rule system**: counted files exist, and there is no CLAUDE.md file, or none of the system
   rules (system-rules.md).
4. **(C) Partly set up**: some CLAUDE.md files or system rules exist, but not all; or two-way ties are missing.
5. **(D) Set up**: every system rule is present, and the two-way tie check reports nothing broken and nothing not
   yet tied. This is the routine check.
6. The script decides (A) alone, from the counts of counted files and CLAUDE.md files. It makes a first guess
   between (B), (C) and (D) from the same counts and from the two-way tie check's output. Step 1, which matches the
   system rules by idea, confirms or corrects the guess, and the record keeps both.

7. Find whether a two-way tie check exists, and its command. Then detect the situation (SKILL.md: situations) by
   script: count the counted files and the CLAUDE.md files, and read the two-way tie check's output if there is
   one. Record the situation, and the steps that will run for it, in the state and the record.

8. **A scoped run** (for example on one folder) decides the situation for that scope, from the counted files, the
   CLAUDE.md files and the two-way ties inside it (LodeSTAR test, problem 12: one "needed" rule in experiments/
   made the whole repo (C), while the scoped folder was (D)).

## Item lister

**Job:** The **item lister**: builds every step's item list from the whole repo, and leaves out declined items,
listing each one it left out.

**Inputs and outputs:** In: the whole repo and the step. Out: the step's item list, and every declined item it left
out.

**Triggers it raises:** `rule-conflict.md` (two rules conflict; a proposed rule would create a conflict; two parts
of these instructions cannot both be met); `repo-rules.md` (a repo rule changes how the run must go, or a CLAUDE.md
disagrees with these instructions); `folder-plan.md` (step 3 plans the folders); `map-rules-files.md` (step 5 maps
rules and files).

**Checks it must enforce:**

1. So that no conflict is missed, a script lists every pair of rules that share a noun outside a stop list of
   common words, where either rule holds "never", "only" or "always", and every such pair gets a verdict; the list
   is a floor, and the doer proposes any other conflict it finds (LodeSTAR test, problem 10: read as both rules,
   the pair rule gave 138 pairs and missed the one real conflict; read as either rule, 210) (tools: coverage
   tables).

2. A list the script counts as empty is recorded by script as "none: 0 items", and is not sent to Jev (SKILL.md:
   situations).

3. In step 0 it lists every rule whose text names one of the kinds of repo-rules.md (by words such as branch, pull
   request, merge, mode, go, ask first, session, commit, version, contract, long job, account, skill, scratch), so
   that the doer's list of the repo rules that change the run has a floor (new: so the doer cannot miss one because
   the repo words it differently).

## Run folder and state

**Job:** Keeps the run folder and the state, written whole, so a run can go on after a stop.

**Inputs and outputs:** In: everything the run finishes. Out: the run folder's files.

**Triggers it raises:** `step-agents.md` (steps 7, 10 or 11 start agents).

**Checks it must enforce:**

1. The run's record, its state, Jev's answers and the golden outputs live in a temporary folder outside the repo: a
   folder for this run inside the session's scratch folder, or, on the user's own computer, a temporary folder
   outside the repo that survives the session, such as one under the user's cache folder. They are never written
   into the repo. The repo keeps only the latest version of every file, and no one-off code or records lying
   around.
2. The folder's name holds the repo's name and the run's start time. The doer prints its full path at the start, at
   every checkpoint, in the end-of-run report and in every push notification.
3. It holds: the record, with its chain of hashes; the state; the question log; the status file; the full detail of
   every list item; the coverage tables; evidence files; the Claude checkers' captured verdicts; Jev's raw answers,
   with their builders and providers; every step agent's and reviewer's progress note; the golden harness and the
   golden outputs, with copies of any weights they need; and temporary mutation copies while they are in use.
4. A scratch folder can be cleared by a reboot or a routine cleanup (inferred from how sessions describe it). Work
   committed on the run's branch stays, and so do the record's hashes in its commit trailers; the run folder may
   not. resume.md says how a run goes on without it.

### The state

5. The state is a set of files in the run folder. It holds everything the run needs to go on after a stop or a loss
   of memory:
6. the run's start commit, the baseline and how it was chosen (tools: gate), the worktree's path, and the branch;
7. the current step, its round, and its start commit;
8. every item of every step so far, with its state and its answers;
9. the test list and the test commands fixed in step 0, and their outputs at the baseline;
10. the step-4 table, the map, the lists with each item's status (approved, written, waiting for its audit, not
    approved, declined), and the clause tables with their verdicts;
11. the budgets and the spend so far against each;
12. the open questions, the open items with their reason codes, and the declined items;
13. the running agents: each one's id, folder and start time, whether it has reported back, and the path of its
    progress note;
14. the mistakes found so far, by kind (repeated-mistake.md).

### Saving as it goes

15. Every state file is written whole: first to a temporary file, then renamed over the old one. A stop in the
    middle of a write leaves the old version intact.
16. Each finished piece of work is saved the moment it is done (an item's answer, a clause verdict, a captured
    output, a user's answer), so a stop loses at most the piece in progress.

17. The work a step does in the repo is committed at its checkpoint, on the run's branch, with the record's hash as
    a trailer (tools: record; other-people.md).

## Status writer

**Job:** The **status writer**.

**Inputs and outputs:** In: the state. Out: the status file.

**Triggers it raises:** `long-job-duties.md` (the run, a step or a long job starts, waits, stops, resumes or ends).

**Checks it must enforce:**

1. The run keeps a status file in the run folder that the user can read at any time. Its top lines say: the step
   and round; what is being done now; how many items are passed out of how many; the spend so far against each
   budget, and the checks still unpaid; the open items by reason code; the time of the last update; and anything
   that is waiting on the user.
2. Below that, it lists every item of the current step and its state, then one line per event.
3. The doer also prints progress lines in the chat as it goes.
4. Each long job the run starts (a capture, a rerun) writes its own progress lines, and the status file says where
   to find them.

5. The status file shows each one's state: not started, in progress, done, passed, failed or reopened.

## Question log

**Job:** The **question-log checker** and the **conversation check**.

**Inputs and outputs:** In: every message that asks the user something, and every answer. Out: the question log.

**Triggers it raises:** `asking-the-user.md` (the doer is about to ask the user anything); `reading-approvals.md`
(the user answers a list or a question; an approval is about to be used).

**Checks it must enforce:**

1. Every message that asks the user something, and the user's exact answer, is written to the question log the
   moment it happens: the message's kind (asking-the-user.md), its exact text, the answer word for word, the chat
   report that followed, and the transcript message ids. Where no message id can be read, write the time and say
   that the id could not be read.
2. A CLAUDE.md change may be written only if its approval is in the log and the gate script has confirmed it in the
   live transcript (tools: gate). A script checks this at every checkpoint (tools: conversation check).
3. A change merged from main through someone else's reviewed pull request is logged with that pull request's link
   as its approval.

## Conversation check

**Job:** Checks every question and approval against the session transcripts.

**Inputs and outputs:** In: the question log, the transcripts, the record. Out: a verdict per message and per
changed line.

**Triggers it raises:** none.

**Checks it must enforce:**

1. **At every checkpoint**, the question-log checker compares each CLAUDE.md line changed since the baseline
   (tools: gate), not only in the step's diff, with the approvals the gate confirmed. A changed line with no
   confirmed approval is a fail.
2. Every message in the log has a kind: (a), (b) or (c) (asking-the-user.md). The checker fails:
   - a message of no kind;
   - a question about a mechanical detail, or for something the doer could check itself;
   - a CLAUDE.md change shown or approved outside the lists;
   - an item on the mechanical list that the effect script finds conceptual (is-it-mechanical.md);
   - a conceptual item without its script-written diff, what it changes, why, and its exact rule text;
   - a bulk approval acted on without its one confirmation, where the lists held items of the first group
     (reading-approvals.md).
3. **The transcript is a cross-check**, read by script, never by hand. The doer does not list the questions; the
   script does:
   - Read the transcripts of every session the run used. The record lists them by session id. In Claude Code they
     are at `~/.claude/projects/<the folder the session started in, with every / as ->/<session id>.jsonl`, and
     subagents' transcripts are in `<session id>/subagents/` (measured by the dry run). One transcript can span
     several repos (measured by the dry run); keep only what concerns this repo.
   - Only messages a person typed count. Tool results, hook output, messages from other sessions or agents,
     scheduled-task prompts and context summaries are never the user's words, even when the transcript marks them
     as coming from the user.
   - Every question the doer asked must be in the log, with the same text. Every answer in the log must be in a
     transcript, word for word.
   - The verdicts in the record must match the checkers' captured outputs and the record's chain (tools: record).
   - Where a transcript cannot be read (for example an earlier session's, in a fresh cloud container), every
     approval it would hold is void, and is asked again (tools: gate). The question log alone never stands in for
     it. The record says which sessions could not be read.
   - A CLAUDE.md change merged from main is checked against its own pull request.
4. **Jev**, per message in the log, a choice question: "Which kind is this message: (a) one of the run's numbered
   lists, or the confirmation of a bulk approval of them; (b) a conceptual question asked outside the lists, about
   goals, trade-offs, risk, or how the work should be done at the level of method; (c) a request for something only
   the user can do or tell; or (d) something else, such as a question about a mechanical detail?" (audit fix 3) A
   message fails only when Jev's answer is (d); where Jev picks another of (a), (b) and (c) than the log, the
   Claude checkers decide its kind (LodeSTAR test, problem 15: Jev read budget questions as (c), and failed 7 of 8
   real messages). The options name no step on purpose. Measured in the empty-repo simulation: when option (b)
   listed "the interview of a new repo", a planted mechanical question tagged as an interview question was rated
   (b) at 0.94, while the same kind of question tagged as step 9 got 0.02 for (b).
5. **Jev**, per approval, the correct question, with the instructions "the quoted message, typed by the user,
   approves this change".

## Budget keeper

**Job:** The **budget keeper**: makes the estimate from the item counts, checks each spend against what is left,
and updates the status file with the spend and the checks still unpaid.

**Inputs and outputs:** In: the item counts, the price lists, every planned spend. Out: the estimate; a yes or no
per spend; the spend lines of the status file.

**Triggers it raises:** `budget.md` (step 0 asks for the budgets; a spend would go over a budget; any other cost
decision).

**Checks it must enforce:**

1. Make the cost estimate with the budget keeper, from the item lister's counts on the repo as it stands, without
   any paid call.

2. **Before asking, the budget keeper states the estimate**, made by script from the item lister's counts, without
   any paid call: the number of items each step will have, times the checks each item gets, with a margin for three
   rounds and for the canaries; the expected paid calls and services; and the expected compute (the real
   before-and-after golden run, and results reruns). Prices are read at that moment from the provider's price list,
   and the estimate says where they were read. A price that cannot be found is stated as unknown.
3. Figures to estimate with (measured):
   - the simulation of an earlier version of these instructions, on a small repo: 20 clauses took 48 Jev requests;
     172 Jev calls used about 92,000 input tokens (about 535 per call), at about 0.8 seconds per call; a checker-1
     round took about 30 to 150 seconds;
   - the live test of the tie stage: 287 Jev calls used 561,367 input tokens (about 1,960 per call, because
     tie-stage states hold whole files and rules), at about 0.94 seconds per call;
   - the empty-repo simulation: 140 Jev calls used 113,101 input tokens (about 808 per call) and cost about $0.005;
     13 `claude -p` checker runs took 76 to 336 seconds each, 2,109 seconds in all; the script's estimate for full
     per-item coverage was about 640 Jev requests per round on that tiny repo.

4. Before every spend (each set of Jev requests, each paid call, each compute job), the budget keeper checks that
   it fits in what is left of its budget. Anything that would go over stops the run and asks the user to raise the
   budget (kind b). At the first such request, the budget keeper prints its estimate beside the actual spend so
   far. The doer never spends past a budget.
5. The status file shows, from step 0 on, the spend so far against each budget, and the checks still unpaid with
   their estimated cost ("checks still unpaid: N, about $X"), updated after every spend.

6. **Claude's list-price cost is recorded separately from the budgets**: each Claude run's tokens, priced at list
   price, even where the host's plan pays (LodeSTAR test, problem 14: each checker run loads about 42,000 tokens
   before reading anything, about $0.68 at list price).

7. Figures from the LodeSTAR test (measured, report section 4): 273 Jev calls used 392,822 input and 6,424 output
   tokens (about 1,439 per call), cost $0.0165, at 0.73 seconds per call; 12 Claude runs took 1,638 seconds of
   checker time, about $16.2 at list price; one round on one folder, as first written, needed about 2,883 Jev
   calls.

## Open items

**Job:** Sets and checks every open item's reason code.

**Inputs and outputs:** In: each item put off, the state and the question log. Out: the item's code, or a refusal.

**Triggers it raises:** `open-items.md` (an item cannot be closed in its step, or the user declines an item).

**Checks it must enforce:**

1. **Every open item has one reason code from this fixed list.** The script sets the code from the state and the
   question log. A code whose evidence the script cannot find is refused; the item is then not put off, and its
   step fails.

| Code | Meaning | Evidence the script needs |
|---|---|---|
| `user-unanswered` | shown to the user; no answer yet | the question's entry in the log |
| `user-deferred` | the user chose to leave it for a later run | the user's words in the log |
| `needs-user-only-fact` | waits on something only the user can do or tell (kind c) | the request's entry in the log |
| `budget-refused` | needs spend the user refused to raise | the user's refusal in the log |
| `other-owner` | in a folder, branch or job that another person or session owns (other-people.md) | the ownership note, branch or pull request |
| `continued-by-user` | in a step the user said to continue past without passing (checker-unusable.md; step-fails.md) | the user's words in the log |
| `doer-deferred` | anything else the doer put off | none; it is checked below |

## Lateness script

**Job:** The **lateness script** and the **first-line writer** of the end-of-run report.

**Inputs and outputs:** In: a finding made in steps 10 to 14, and step 7's checkpoint commit. Out: a step-7 miss,
or a new finding.

**Triggers it raises:** `late-finding.md` (a finding is made in steps 10 to 14).

**Checks it must enforce:**

1. For each finding made in steps 10 to 14, the script checks whether the clause's text and its cited lines, or the
   file's pieces, are unchanged since step 7's checkpoint commit. If they are, step 7 should have found it: it is
   recorded as a step-7 miss (a mistake, repeated-mistake.md), and step 7's complete check for that rule is
   reopened.

## End-of-run report

**Job:** Writes the end-of-run report's first line by script, and the report's parts.

**Inputs and outputs:** In: the item states and the record. Out: the report posted in the chat.

**Triggers it raises:** none.

**Checks it must enforce:**

1. **The end-of-run report's first line is written by script**, from the item states, in this form: "Tied both
   ways: X of Y specific rules, and Z of W counted files. Open: N (waiting on you: K; put off by the doer: D;
   other: O). Declined by you: L." In situation (A) it reads: "Set up: S specific rules, each marked 'needed', and
   0 broken ties." The doer writes nothing before it.

2. **When the run ends**: the record writer writes the end state. Then the doer posts the end-of-run report in the
   chat. Its first line is the one the script writes. Then it holds:
   - the end state; every open item, with its reason code; and every declined item, with the part of the target
     state it leaves unmet;
   - every CLAUDE.md change made, file by file;
   - every rule-scope ending that changed no rule (each move and deletion), and every merge of duplicates, with its
     evidence (file-does-more.md; duplicates.md);
   - every fix that changed an output or a kept result, with its measured before and after, and every quoting file
     updated;
   - every approval quote the run used, with its date, printed by script (tools: gate);
   - the spend against each budget, beside the estimate;
   - (open: Claude usage) the Claude usage the run took: the number of agent and checker runs, their time, and
     their tokens where they can be read (budget.md);
   - every kind of mistake seen twice, in this run or in earlier runs, with the check made for it or proposed for
     the skill (repeated-mistake.md); and every mistake kind not yet in tools: mistakes list, as an item to add
     there;
   - the run folder's path, and that it is temporary.
3. Then follow the repo's rules on pull requests and merging, or the user's answer of step 0 where the repo has
   none, and send the push (long-job-duties.md).

4. The gate writes the first line from the item states; the doer can neither write nor edit it (LodeSTAR test,
   problem 2: the test's doer hard-coded it).

## Mistakes list

**Job:** The **list of mistakes seen before**, with the check each one became.

**Inputs and outputs:** In: every mistake a checker found, by kind. Out: the counts per kind; the list that ships
with the skill.

**Triggers it raises:** `repeated-mistake.md` (a mistake kind reaches two).

**Checks it must enforce:**

1. From the first run (senior-thesis-research, November 2026):
2. Retyping rules instead of copying them; "improving" wording while moving it.
3. Writing two-way ties early because the headings matched; trusting the check as proof.
4. Committing files an agent is still editing; agents editing outside their folder.
5. Changing an existing rule to remove a conflict without asking.
6. A shared helper copied into two files; a private function imported from another folder.
7. Leaving the kept results from older code after the code changed.
8. Asking the user about mechanical details; asking a long list without saying which items are conceptual.
9. A check that cannot fail (never tested against a broken repo).
10. Long jobs with no progress lines, or saves that a stop in the middle can corrupt.
11. Marking a specific rule "the whole folder" to avoid giving it a file.
12. From the reviews, the dry run, the simulation and the studies (November 2026):
13. Making a rule's wording match the code without the user's approval, and calling it mechanical.
14. Writing file lines and marks as if they needed no approval.
15. Jev questions where "yes" means wrong, and Jev questions about a whole list.
16. Replaying a saved Jev answer after a fix, or in a new run.
17. Writing headings during the restructure, before the audit, so that one half of a two-way tie exists without the
    other. Example: 2 broken ties in senior-thesis-research from headings written before their rules' file lines
    (measured by the adversarial review).
18. Checking a two-way tie in one direction only.
19. Acting on an approval remembered after a context summary.
20. Sweeping another session's uncommitted work into a commit with `git add -A` or `git commit -a`.
21. Capturing golden outputs from caches, so the comparison passes whatever the code does.
22. Editing the golden harness to hide a behaviour change (the simulation; measured).
23. A comparison that does not notice a deleted output (the simulation; measured).
24. Comparing moved rules in one direction only, so added text slips in.
25. Naming any test that touches a function as the test of a clause; a combined mutation that hides an untested
    element (the simulation; measured).
26. Paraphrasing the user's question in the record (the simulation; measured).
27. Giving Jev the doer's own description as its state, or two long texts to compare (the simulation; measured).
28. A checker that adds new demands every round, so a step never passes (the simulation; measured).
29. Going on with one checker, or substituting a model, when a checker cannot be used.
30. A tie check that silently skips rules with no bold sentence, or allows two rules one bold sentence
    (conference-matching-api; measured by the system-rules study).
31. Applying one repo's wording (GPU hours, phone pushes, Python docstrings) in a repo where it does not fit.
32. Doing everything correctly but only part of it (the reason for the complete check).
33. From the four stress tests (November 2026):
34. Ending a run "incomplete" with hard items put off under any label, and every checker green (the loophole hunt;
    inferred).
35. Letting one Claude checker decide every item Jev left unsure, with Jev's number in front of it (the loophole
    hunt; measured: 6 of 12 wrong items were unsure).
36. The doer writing its own exam: clause lists, mutations, states and the checker's prompt (the loophole hunt;
    measured: a state built by a one-off script scored 0.68).
37. Merging clauses so that fewer need tests; one crude mutation reused for several clauses; a "test" that only
    searches the source (the loophole hunt; measured).
38. Calling a specific rule general, marking it "the whole folder", or indenting it under another rule, so that it
    needs no file (the loophole hunt; measured: the tie check showed 0 broken after each).
39. A word-for-word move that narrows what a rule covers, called mechanical (the loophole hunt; measured on "No
    Cellpose").
40. Hiding product code under an exempt name or place: a `test_` prefix, `conftest.py`, `docs/`, `contests/`, a
    data folder, an empty-package file, `README.md`, or a git-ignored file (the loophole hunt; measured: 8 ways).
41. Replacing a test's assertions while the test list stays the same (the loophole hunt; measured).
42. A new run taking an earlier run's unchecked work as its "before" (the loophole hunt; inferred).
43. Putting a clause's test output into the state of "is it carried out?", so that Jev answers "is it tested?" (the
    live test; measured).
44. Asking Jev one question about a whole file against many rules (the live test; measured: no separation).
45. A suite that is already red hiding a new broken tie (the live test; measured).
46. A tie check that reads only the nearest CLAUDE.md when it checks a heading (the live test; measured).
47. One requirement stated by two rules, and one clause carried out twice in a file (the live test; measured).
48. Naming a checker's model by an alias that resolves to the doer's own model (the empty-repo simulation;
    measured: `opus`).
49. Sending Jev requests before the budgets are set, and asking questions before the question log exists (the
    empty-repo simulation; measured).
50. Counting a canary's line in the step's verdict, so that every step reads STEP FAIL (the empty-repo simulation;
    measured).
51. Treating a user's "no" as an open item, so that the same item is proposed again every run (the empty-repo
    simulation; measured).

## Action guard

**Job:** (new: proposed so that the doer cannot miss the very-dangerous-action trigger.) Watches the doer's
commands before they run.

**Inputs and outputs:** In: each command the doer or an agent is about to run. Out: allowed, or refused with the
dangerous-action trigger.

**Triggers it raises:** `dangerous-action.md` (an action is on the very dangerous list, or the repo's rules say to
ask first).

**Checks it must enforce:**

Refuse, and raise dangerous-action.md, before any command that does one of the very dangerous actions of
dangerous-action.md: for example a force-push, a reset or rebase of a pushed branch, a deletion outside the run's
own temporary files and the run's branch, a deploy, a comment or post, a visibility change, a change to settings in
the hosting service, or a write outside the repo and the run folder.

Refuse `git add -A`, `git add .` and `git commit -a` (other-people.md).

Refuse any invocation of `/verify-rules` from inside a run.

Allow an action that the user approved by its exact words, once the gate has confirmed the approval in the live
transcript.

## Per-step checklists

**Job:** Holds each step's done-when items, its three checks item by item, and what the Claude checker watches for.
The gate copies them into the pack.

**Inputs and outputs:** In: the step. Out: its checklist.

**Triggers it raises:** none.

**Checks it must enforce:**

**Step 0.**

**Done when**:

1. if this was the session's first reply, the start-of-session duties were done first (quoted from the chat);
2. the run folder, outside the repo, holds the state, the status file, the question log and the record, and it
   existed before the first question (the log's times);
3. the cost estimate was stated, and both budgets (or the money budget alone, where no compute is used) are quoted,
   and no paid call came before the answer (the budget keeper's log);
4. every repo rule of the kinds in repo-rules.md is listed, quoted, with how the run follows it;
5. every test command is listed and ran in full on the unchanged code, and every known failure is recorded and was
   reported to the user (or "none: 0 items" in situation A);
6. the worktree and the branch exist, made from a named clean commit (in situation A, the empty start commit), the
   branch's first commit message names the start commit and the baseline, and the draft pull request exists if the
   repo requires one (link);
7. uncommitted work, open pull requests, branches and ownership notes were checked, and the folders left out are
   listed;
8. the programs that read CLAUDE.md files, and the files that cite rules by number, are listed (search output);
9. the existing golden, trace and dependency mechanisms are listed, or "none" with the search output;
10. both checkers answered a test request through the gate, each Claude checker's reported model id differs from
    the doer's, and Jev's provider is `typesafe-ai`;
11. the situation is recorded, with the script's counts as its evidence, and the list of steps that will run;
12. the baseline is recorded, with how it was chosen, and where the branch has earlier commits, the record's chain
    matches the commit trailers.

**The three checks**:

   - **Correct**, per action of step 0: the state is built by that action's registered builder from the commands it
     ran (tools: state-builder registry); an action with no registered builder goes to both Claude checkers instead
     of Jev. For the situation, a choice question: "Which situation is this repo in: (A) empty or new, (B) code but
     no rule system, (C) partly set up, or (D) set up?", with the definitions of SKILL.md: situations and the
     script's counts; its answer must match the recorded situation.
   - **Same**: the repo is unchanged by step 0, apart from the empty start commit of situation (A), which changes
     no file. Proof: `git status --porcelain` and `git diff` of the repo, before and after the step. One request
     per CLAUDE.md (CLAUDE.md question) and one per test command (code question); where the script counts none,
     "none: 0 items".
   - **Complete**, per "done when" item.
1. **Watch for**: starting in a dirty working tree; a narrowed test command; any paid call, or any question, before
   its place in this order; missing a rule of repo-rules.md because the repo words it differently; writing the run
   folder inside the repo; naming a checker's model by an alias; taking "the start of this run" as the baseline on
   a branch that already has earlier run commits.

**Step 1A.**

**Done when**:

1. every question of the interview was asked, and its answer is in the question log, word for word;
2. the folders question carried the doer's proposed tree as its recommendation;
3. every part the user named, and in situation (B) every part no CLAUDE.md describes, has its rules drafted, and
   every drafted rule is on the conceptual list;
4. nothing was written (diff).

**The three checks**:

   - **Correct**: per drafted rule (it says what the user's answer says, in the user's words, and adds nothing);
     per rule, the classification question; per question asked, the message-kind question (tools: conversation
     check).
   - **Same**: per CLAUDE.md, CLAUDE.md question on the step's empty diff; in situation (A), "none: 0 items".
   - **Complete**: per question of the interview (asked and answered); per part the user named, and per part no
     CLAUDE.md describes (it has rules).
1. **Watch for**: asking several questions at once; putting words in the user's mouth; drafting rules about
   implementation details the user did not ask for; asking about mechanical details (audit fix 3); a folders
   question with no recommendation; in situation (B), drafting a part's rules from its code when the user could
   have been asked.

**Step 1.**

**Done when**:

1. every part of the structure is found, or has an item;
2. every approved system rule maps to a quoted rule, or has an item (mechanical when missing, conceptual when held
   in part);
3. the personal System Rules block and the skills it needs are present word for word, or each difference has a
   mechanical item, and the reference copy and the skills' source are recorded;
4. every pair on the script's conflict list has a verdict, and every conflict found has a conceptual item quoting
   both rules;
5. every candidate pair of the duplicate finder has a verdict, and every duplicate and name clash has an item;
6. every hit of the number search has a verdict, and every reference by number has an item;
7. no CLAUDE.md changed in this step (diff).

**The three checks**:

   - **Correct**: per system rule found (the quoted rule says what the system rule says); per item drafted (it
     states exactly what is missing, different, in conflict or duplicated, with its exact proposed text); per
     candidate pair, the duplicate question (duplicates.md); per number-search hit (its verdict follows
     number-reference.md).
   - **Same**: per CLAUDE.md, CLAUDE.md question; the proof is the step's empty diff.
   - **Complete**: per part of the structure; per approved system rule; per part of the System Rules block and per
     skill it needs; per pair on the conflict list; per candidate pair of the duplicate finder; per number-search
     hit.
1. **Watch for**: changing an existing rule to remove a conflict without asking; proposing a rule without its
   exceptions; putting a missing system rule on the conceptual list; replacing a number in one CLAUDE.md but not in
   every copied opening; missing a rule because the repo words it differently; looking only for missing rules and
   not for conflicts or duplicates; reading the System Rules block as rules; writing anything in this step.

**Step 2.**

**Done when**:

1. the heading table covers every file type found in step 0;
2. the exempt list covers every group of tools: exempt-list builder with patterns, content rules, groups and
   reasons, and a script placed every exempt file;
3. every test of the list exists (test names matched to the list, one by one) and passes;
4. each test was seen failing before the code that passes it was written, or, for a test added to an existing check
   that already passes it, was seen failing against a copy of the check broken on purpose (saved output);
5. the check runs in the full test command and in every CI path the tie-check template names (one output each);
6. its full output on the repo is in the evidence: the lists, everything broken, and everything not yet tied in
   each direction.

**The three checks**:

   - **Correct**: per test case (it fails on a check broken for that case, and passes on the real check); per file
     type (the check reads a sample heading as the table says); per CI path (the check runs); per exempt file, the
     script's placement and the exempt-group question, which may only fail it (tools: exempt-list builder).
   - **Same**: code question, per test command (every test and check that passed before still passes); per pair the
     old check read (its verdict is unchanged, or the change is explained by a named new test case; before and
     after outputs compared by script); the step's diff touches only the check, its tests, its exempt list and CI
     files. In situation (A), "none: 0 items" for what existed before.
   - **Complete**: per required test case; per file type; per exempt group; per CI path.
1. **Watch for**: a check that passes by reading nothing (test it against a broken repo); checking only one
   direction; an exempt list used to hide files; exemption by name alone; counting docs or tests; treating the
   global CLAUDE.md as lowest-level; reading only the first line of a file; reading only numbered rules; skipping
   rules with no bold sentence; a CI filter that skips the check when only CLAUDE.md files change.

**Step 3.**

**Done when**:

1. every CLAUDE.md in the repo is in an allowed list, every listed one exists, and each list's tree matches the
   folders on disk (script output), or the difference has an item; where the script counts none, "none: 0 items";
2. every counted file whose nearest CLAUDE.md is not lowest-level has a planned fix;
3. every planned folder move lists what is wired to its path;
4. nothing was written, and no code moved (diff).

**The three checks**:

   - **Correct**: per proposed folder (it is one part of the repo, as the CLAUDE.md files or the interview's
     drafted rules describe it, rather than one rule's job); per item drafted (it shows the exact list entry and
     opening); per planned fix (a new lowest-level CLAUDE.md or a move, never an exemption).
   - **Same**: per CLAUDE.md, CLAUDE.md question, and per test command, code question; the proof is the step's
     empty diff.
   - **Complete**: per CLAUDE.md in the repo; per counted file whose nearest CLAUDE.md is not lowest-level; per
     planned folder move.
1. **Watch for**: planning a CLAUDE.md that is not in a list; making a folder lowest-level but leaving code in its
   parent; one folder per rule; proposing a change to the wrong list; moving code before the golden capture; moving
   a folder without updating everything wired to its path; fixing a file by exempting it.

**Step 4.**

**Done when**:

1. every rule the rule reader lists appears in the table exactly once per place it stands, and every row is a rule
   the reader lists (script comparison, both ways);
2. every rule is classified as general-or-specific.md says, and every specific rule has a destination lowest-level
   folder;
3. every planned change is on exactly one list, the one the effect script decided, with its exact text and cut
   points;
4. every planned change has its two clause tables and its effect-script result;
5. every rule that would stop being specific has its own conceptual item;
6. nothing was written (diff).

**The three checks**:

   - **Correct**: per rule, the classification question, without the doer's label; per general rule in a
     lowest-level CLAUDE.md, the whole-folder question, which must agree with the class question; per specific
     rule, "Does this rule sit as low as it can: in the lowest CLAUDE.md that covers all the code it is about?",
     once moved as planned (state: the rule's text, its planned CLAUDE.md, and the script's list of the folders of
     the code it is about); per new bold sentence (it names the rule's idea without adding, removing or changing
     anything the rule requires).
   - **Same**: per planned move, cut, combine, merge, new bold sentence and indent, CLAUDE.md question on the
     script's diff of the planned before and after text, with its clause tables and its covered files (nothing is
     written yet); per CLAUDE.md, CLAUDE.md question on the step's empty diff. In situation (A), per draft
     CLAUDE.md: it matches the list items word for word, by script.
   - **Complete**: per rule the reader lists (it is in the table, with a class and a place); per sub-rule; per
     planned change (it has its effect-script result).
1. **Watch for**: leaving a specific rule high "because it is short"; classifying a specific rule as general,
   marking it "the whole folder" or indenting it, to avoid giving it a file; cutting a sentence so its meaning
   changes; combining rules whose files will differ; missing bullet rules or unnamed rules; putting a new bold
   sentence, a mark or an indent on the mechanical list; a word-for-word move that narrows what a rule covers.

**Step 5.**

**Done when**:

1. the map holds every counted file and every planned specific rule exactly once, both ways (script comparison with
   the check's output and the step-4 table);
2. no planned file serves two rules, and no planned rule has two files;
3. every gap in the map has a planned fix on a list, or is an open item with a reason code the script accepted;
4. every old public name has a new place in the map;
5. every candidate pair of the duplicate finder on the code has a verdict;
6. nothing was written (diff).

**The three checks**:

   - **Correct**: per counted file (planned to exactly one specific rule in the lowest-level CLAUDE.md that will
     cover it); per planned specific rule (planned to exactly one file); per planned file (everything it will do
     belongs to its one rule, by the piece listing of map-rules-files.md); per mechanical item (the effect script
     shows it mechanical); per candidate pair, the duplicate question.
   - **Same**: per CLAUDE.md, CLAUDE.md question on the step's empty diff.
   - **Complete**: per counted file and per planned specific rule, both ways (it is in the map); per old public
     name (it has a new place); per candidate pair.
1. **Watch for**: planning one direction only; a map typed by hand instead of built from the script's lists; hiding
   a second job inside a file ("it's only a helper"); a helper copied into two files of one version; writing rules
   from code as if that were mechanical.

**Step 6.**

**Done when**:

1. every kind of output is listed, with how it is captured or why not;
2. the capture ran on the baseline commit, before step 10, and the diff from the baseline to the step's commit
   touches only the two-way tie check, its tests, its exempt list and CI files;
3. every resume cache was empty at the start (listing), and computed and read-back outputs are recorded;
4. the two captures are identical after the stated normalisations, and each normalisation touches only values that
   differed;
5. the comparison passes old against old, and fails old against each tampered, deleted and added output, with its
   counts;
6. every line of every planned file is run by a golden input, or has a recorded reason;
7. the real end-to-end run is planned for just before step 10, or its absence is recorded with the reason.

**The three checks**:

   - **Correct**: per kind of output (computed by the code, not read back); per tampered, deleted and added output
     (the comparison reports it, with counts); per rule (its inputs exercise it); per uncovered line (an input now
     runs it, or its reason holds).
   - **Same**: code question, per output (the two captures match after the stated normalisation, with nothing
     normalised that the code does not make random or time-based by design); the step's diff (the product's code is
     unchanged since the baseline).
   - **Complete**: per kind of output (captured, or a reason); per rule (an input exercises it, or a reason); per
     planned file (its coverage is measured).
1. **Watch for**: capturing after code has changed; a comparison that checks only shapes; a comparison that ignores
   deleted keys; reading old outputs from a cache and calling them golden (example: senior-thesis-research's
   experiment runs read back what is finished, and its weights sit in a git-ignored folder; measured by the
   adversarial review); trivial inputs that leave code unrun; training on the local machine; normalising away a
   real difference; saving golden outputs inside the repo.

**Step 7.**

**Done when**:

1. every rule in scope has a clause table that meets its floor;
2. every clause, in every folder it covers, has a verdict for its kind with its evidence, or is a gap, or is "not
   testable here" with its cause;
3. every planned file has its function-to-clause table, and every extra piece has its chain answers and ending;
4. every duplicate candidate has a verdict;
5. every finding has a location, what it is, measured or inferred, and a fix kind;
6. nothing in the repo changed (diff), and every mutation copy was outside the repo and is deleted.

**The three checks**:

   - **Correct**: per clause verdict, as part 2 of the tie-stage check judges it (tools: tie-stage check): the
     script's mutation evidence, Jev, which may only fail it, and the Claude checker; per clause, the clause-kind
     question; per call site (it uses the value or choice the clause fixes); per mapped piece, question 1 on its
     own rule; per extra piece, the chain's questions (question-chain.md).
   - **Same**: per test command, code question (every test and check still passes as before); per CLAUDE.md,
     CLAUDE.md question on the step's empty diff.
   - **Complete**: per rule, the script's floor and Jev's question "Does this clause list cover every requirement
     of the rule's text?"; per clause and folder (it has a verdict); per planned file (its table holds every
     piece).
1. **Watch for**: trusting the check; reviewers that only skim; style preferences reported as gaps; merging or
   dropping clauses; citing a whole file as one clause's lines; relabelling a hard clause's kind to escape its
   test; naming any test that touches the function as its test; checking a value in one file but not where it is
   passed in; leaving higher rules or process rules out of the audit.

**Step 8.**

**Done when**:

1. every finding is in exactly one group, with a reason, and every finding with a conceptual part is split;
2. every planned change from steps 1 to 8 is on exactly one list (script cross-check), the one the effect script
   decided;
3. the mechanical list's header shows, for every item the effect script checks, 0 changed clauses, 0 changes to
   which code a rule applies to, and 0 rules that stop needing a file;
4. every conceptual item opens with its script-written diff, and has what it changes, why, the exact text of each
   option, and a recommendation; the first group is first;
5. every item put off passed the put-off question;
6. every dependency between items is stated;
7. nothing was written (diff).

**The three checks**:

   - **Correct**: per finding, the group question; per list item, the effect script's result (a script fact; Jev is
     asked on the script's output and may only fail it, audit fix 2); per conceptual item, "Does this item's
     description tell the user, in plain words, what it changes, why, and the exact rule text of each option, and
     does it agree with the script-written diff above it?"; per recommendation other than "fix the code", checker 1
     judges it as an item; per item put off, the put-off question.
   - **Same**: per CLAUDE.md, CLAUDE.md question on the step's empty diff.
   - **Complete**: per finding, and per planned change from steps 1 to 8 (it is on exactly one list).
1. **Watch for**: sorting a fix that changes results as (A); putting a conceptual change on the mechanical list;
   leaving a finding's conceptual part unsplit; a conceptual item the user cannot understand without reading the
   code; recommending the cheapest option instead of fixing the code; burying a weakening item in the middle of the
   list; choosing between cutting and broadening by file size.

**Step 9.**

**Done when**:

1. the user's answer is in the question log, word for word, with its message id, and the gate confirmed each
   approval in the live transcript;
2. the word-for-word comparison shows 0 missing and 0 added pieces, apart from the approved items;
3. the diff holds only approved items, and the effect script shows every mechanical item it checks still
   mechanical;
4. the allowed lists match the files;
5. every program that reads CLAUDE.md files gives the same result before and after, apart from the approved changes
   (both outputs);
6. every rule-number citation is updated or listed;
7. the map is updated, every declined item is recorded as declined, and every unanswered item is open with its
   code;
8. every change was reported in the chat, file by file.

**The three checks**:

   - **Correct**: per written item (it was written exactly as approved); per approval (the quoted words, typed by
     the user and found by the gate in the live transcript, approve that item).
   - **Same**: per moved or cut piece, CLAUDE.md question: read in its new place, does it have the exact same
     meaning as before, with every "it", "its", "this" and "they" pointing at the same thing? First the script's
     covered-files check must show that it covers the same files (is-it-mechanical.md). The state is the
     comparison's diff and the piece's old and new surrounding rule, never two long texts. The provisional
     thresholds are 0.65 and 0.40 (tools: thresholds and calibration). The Claude checker must also pass each
     piece. Per rule not named in an approved conceptual item, CLAUDE.md question. Per test command, code question
     (every test and check that passed before still passes). In situation (A), per CLAUDE.md written: "Does the
     written CLAUDE.md match the approved list items word for word, as the script's comparison shows?"
   - **Complete**: per approved item (it was written); per change (it was reported in the chat).
1. **Watch for**: writing before the answer; retyping (it brings small changes); fixing wording "while moving";
   lowercasing a sentence after a cut; losing the indented lines under a rule; a pronoun left pointing at nothing
   (example from senior-thesis-research: "Its dots come from its final output." moved out of the training rule; the
   sentence measured by the adversarial review); a program that silently drops a moved rule; treating a move
   between CLAUDE.md files as reorganising; acting on an approval the gate has not confirmed.

**Step 10.**

**Done when**:

1. every test command passes (the last lines of each); every baseline test is still present by name, through the
   import adapter's mapping; the baseline's own test files pass against the new code; and no old test's assertion
   was removed or changed without checker 1 passing it;
2. the golden comparison reproduces every output exactly, after the stated normalisations, with every output
   compared (counts shown);
3. the harness diff shows only its import adapter changed;
4. every file in the map exists, and no file's heading states any rule's bold sentence (script output);
5. every file not in the map is deleted, apart from versions offered side by side;
6. every step agent's changes are inside its folder, apart from the wired paths listed in step 3 (diff per folder);
7. every red seen was a valid red (saved outputs).

**The three checks**:

   - **Correct**: per map entry (the file exists with its public names, and holds only what the map gives it); per
     moved test (its saved red failed on a not-implemented stub or an assertion, not on an import, file or syntax
     error); per folder (its diff touches only files inside it, apart from the listed wired paths).
   - **Same**: code question, per test command (every test and check that passed before still passes), per baseline
     test file run against the new code, per old test's assertion diff, and per golden output (identical); the
     harness diff.
   - **Complete**: per map entry (its file exists); per old file (deleted, or kept by the map or a version folder);
     per fixed name (unchanged).
1. **Watch for**: a step agent editing outside its folder; changing behaviour "to clean up"; "simplifying" a moved
   test; editing the golden harness beyond its imports; committing another agent's half-done work; private helpers
   imported across folders; renaming something a live system depends on; deleting and recreating a file the map
   keeps; writing a heading early.

**Step 11.**

**Done when**:

1. every test command passes;
2. every (A) fix is proven to leave outputs identical;
3. every (B1) fix has its test that failed before, its measured effect, its difference list, and the golden record
   updated only for its outputs;
4. every (B2) fix changed the contract first (commit order), and has its approval quote;
5. every gap scheduled for this run is closed, and every gap not closed is an open item with a reason code the
   script accepted, each `doer-deferred` one having passed the put-off question;
6. the two-way tie check shows nothing broken, and no broken item that the baseline did not have.

**The three checks**:

   - **Correct**: per fix (it was done as these instructions say for its group).
   - **Same**: code question, per golden output (identical, apart from the outputs a listed (B1) fix was meant to
     change, each with its before and after and its own test), and per test command (every test and check that
     passed before still passes).
   - **Complete**: per clause gap scheduled for this run, in every folder it covers.
1. **Watch for**: weakening a rule to match the code; a fix that changes outputs it was not meant to change; a gap
   closed in one folder but not in another the clause covers; updating the golden record for more outputs than the
   fix was meant to change; calling a fix that changes a quoted result internal.

**Step 12.**

**Done when**:

1. every rule in scope has an updated clause table that meets its floor, and every clause, in every folder it
   covers, has a verdict;
2. the tie-stage check's four parts and conditions pass for every two-way tie written;
3. every two-way tie written has a passed clause audit and its approved item (script cross-check);
4. every specific rule and every counted file not tied both ways is listed as an open item, with its reason code,
   or as declined;
5. every test command passes, and the broken list holds no item the baseline did not have.

**The three checks**:

   - **Correct**: the tie-stage check's parts 1 to 4 and its conditions, each with the checkers tools: tie-stage
     check names; per clause verdict, as in step 7.
   - **Same**: code question, per test command and per golden output (as after step 11): headings and file lines
     change no behaviour. CLAUDE.md question, per CLAUDE.md: the diff holds only approved file lines and marks.
   - **Complete**: per clause of every rule, in every folder it covers; part 2 of the tie-stage check, per rule.
1. **Watch for**: writing every two-way tie at once because the headings match; writing one half without the other;
   leaving a heading that claims a rule marked "needed" (the check calls this broken); writing a file line that is
   not an approved item; tying a file that does more than its rule; "finding" late what step 7 should have found.

**Step 13.**

**Done when**:

1. every kept result is current by the freshness script; or is untraced and the user chose not to rerun it
   (declined); or is an open item with the code `budget-refused` and the user's answer quoted;
2. everything that quotes the results is updated, or listed as a request to the user with the user's answer.

**The three checks**:

   - **Correct**: per kept result (it was regenerated by the current code, within the budgets, and its commit field
     changed only with its values, its logged job and its output hash); per quoting file (it quotes the value now
     in its result).
   - **Same**: code question, per test command (every test and check still passes); the step's diff (it touches
     only the results and the files that quote them).
   - **Complete**: per kept result; per quoting file.
1. **Watch for**: calling results current because they were made recently; writing HEAD's hash into a result's
   record without rerunning it; requiring a result's commit to be HEAD itself, which no committed result can be;
   running past a budget; forgetting quotes in binary files.

**Step 14.**

2. Run everything: every test command, and the baseline's test files through the import adapter; the tie-stage
   check (tools: tie-stage check), all four parts and its conditions; the hierarchy checks (tools: hierarchy
   checks); the duplicate finder on the whole repo (duplicates.md); the conversation check (tools: conversation
   check); step 13's freshness check; the "after" half of the real before-and-after golden run, where its "before"
   half ran (within the budgets); the full golden comparison against the baseline; and the gate's check of the
   record's chain against every commit trailer (tools: record).
3. Run the final check (the core), with one request per item:
   - **Correct**, per step 0 to 14: the state holds the step's text and its record;
   - **Same**: code question, per test command and per golden output, against the baseline (every test and check
     that passed at the baseline still passes, with every baseline test still present; every golden output is
     identical, apart from the outputs a listed (B1) fix was meant to change); CLAUDE.md question, per moved or cut
     rule, against the baseline (apart from the approved conceptual changes);
   - **Complete**, per clause of every rule, in every folder it covers, and per step of the workflow. In situation
     (A), each clause of a "needed" rule is recorded "needed: no code" by script, and not sent to Jev
     (situation-a.md);
   - **Nothing duplicated without a purpose**: per candidate pair of the duplicate finder, the duplicate question
     (duplicates.md);
   - **Only conceptual questions**: per message in the question log, the kind question of tools: conversation
     check.

4. Ask the whole-process question. The gate writes a summary of every step's results: for each step, its items and
   how many passed, its rounds, its open items with their reason codes, its declined items, and its coverage
   tables' counts against their floors. Jev is asked once, on that summary, the user's own question: "Have we
   implemented the whole process correctly?"

*Asking the whole-process question once, on the gate's summary and on top of every item's checks, is a reading of
the user's words, waiting for confirmation on list C (audit fix 9).*

**Done when**:

1. every test command passes, every baseline test is still present by name and passes through the import adapter
   (in situation A, the test list is compared from the end of step 2);
2. the tie-stage check passes, and nothing is not yet tied in either direction (in situation A, every specific rule
   is marked "needed", and nothing is broken);
3. every hierarchy check passes, or its failure in text the user wrote has an answered conceptual item, or is an
   open item with its reason code;
4. every kept result is current, or untraced and declined by the user, or an open item with the code
   `budget-refused`;
5. the conversation check passes;
6. every item of the final check passes, and nothing is duplicated without a stated purpose;
7. the whole-process question passed, by Jev or by both Claude checkers;
8. the shortcut audit found nothing, or each finding was sent back and its step passed again;
9. the record's chain matches every checkpoint commit's trailer.

10. **The three checks**: the final check above is this step's three checks.

## Shortcuts

**Job:** Lists every known shortcut, what blocks it and what catches it.

**Inputs and outputs:** In: none. Out: the table, given to the shortcut audit.

**Triggers it raises:** none.

**Checks it must enforce:**

1. The skill assumes the doer will take shortcuts. Every step is built so that a shortcut is caught. The loophole
   hunt showed that, under an earlier version of these instructions, a doer that wanted to finish fast could end a
   run with most of the hard work undone and every checker green, through three gaps: "incomplete" was a free exit;
   an unsure Jev answer handed the decision to one checker; and the doer wrote its own clause lists, mutations,
   states, checker prompt and record (measured on a copy of senior-thesis-research). tools: gate; tools: coverage
   tables; open-items.md close those gaps.

### Every other shortcut, and what stops it

2. Taken from the adversarial review, the dry run, the simulation's list of corners it could have cut unnoticed,
   and the four stress tests.

| Shortcut | What blocks it | What catches it |
|---|---|---|
| Skipping Jev items | the script knows each check's item count; a step cannot pass until every item has a recorded answer | the pack's count lines; the complete check |
| Writing verdicts yourself, or trimming a FAIL out of the record | the gate captures each verdict from the checker's own output and chains its hash at once | the chain check at steps 0 and 14; the conversation check |
| Slanting Jev's state or question, or briefing the Claude checker | registered state builders; fixed templates; the gate writes every prompt, and checks the hash of an Agent-tool checker's first message | the canaries; the second Claude checker; the shortcut audit |
| A checker on the doer's own model, through an alias | explicit model ids only; the gate reads the model the checker reports | the record's model ids; a void round |
| Jev answers served by another provider | the client records the final provider of every call | a checker that cannot be used (checker-unusable.md) |
| Paraphrasing the user's question or answer | the question log keeps the exact text, with message ids | the gate's transcript check; the conversation check |
| A made-up or bent approval | an approval counts only once the gate finds it in the live transcript, at the moment of use | a void approval, shown again |
| Laundering an earlier run's work in a new run | the baseline is the merge-base with main whenever the branch has earlier commits | the chain check; re-approval of every changed line |
| Editing the golden harness to hide a change (the simulation did this once; measured) | only its imports may change during a restructure, and a script diffs it against its copy from step 6 | the diff in the pack; checker 1 |
| Deleting a golden output so the comparison passes | the comparison counts outputs and reports "5 of 6 compared" as a difference | the same check for code |
| Normalising away a real difference | a normalisation may touch only values that differed between the two captures of step 6 | the script's proof per normalisation; checker 1 |
| Choosing golden inputs that miss the code | line coverage of the golden inputs (tools: coverage tables) | the uncovered-lines items |
| Weakening tests (skip, expected failure, deselect, a narrower command, an assertion replaced) | the test list is compared by name with the baseline; the baseline's tests run against the new code through the import adapter; every old test's assertions are diffed | the same check for code; checker 1. Measured in the loophole hunt: all 8 assertions of one folder replaced by `assert True` left "5 passed" and the test list unchanged |
| Writing two-way ties early | only the tie writer writes headings and file lines, both together, after the rule's clause audit passes | a heading with no file line is broken (tools: tie-check template) |
| Calling a clause tested because some test touches it, with a crude mutation, or with a test that reads the source | generated mutations, inside the clause's lines, one per clause, failing on an assertion, from a test that reads no source (tools: coverage tables) | tie-stage part 2; checker 1's own mutations |
| Merging or dropping clauses | the clause table's span coverage and floor | the step's complete check |
| Hiding files in the exempt list | exemption by pattern and content; the import and call test; the exempt count against the baseline | the script; checker 1 on every file that became exempt |
| Hiding code in a folder of data | a folder of data that holds a code file fails the check | the check's test (step 2) |
| Calling a specific rule general, marking it "the whole folder", or indenting it under another rule, to avoid giving it a file | classification without the doer's label, with specific as the default; marks and indents are conceptual items; the history guard; the specific-rule count against the baseline | the script; Jev and the Claude checker; the user |
| A word-for-word move that narrows what a rule covers, called mechanical | the effect script (is-it-mechanical.md) | the M list's script-written header |
| Making a rule match the code and calling it mechanical | any change to what a rule requires is conceptual; the effect script | the M list's header; the conversation check |
| A second job hidden in a tied file as private helpers | the function-to-clause table, private pieces included; question 1 per piece; the same-output-path check | tie-stage parts 3 and 4 |
| A duplicate left behind by parallel agents | the duplicate finder, in every final check | the final check (duplicates.md) |
| Approval by momentum: cheap recommendations, bulk "approve all" | the script-written diff first; the weakening group first, confirmed by number; "fix the code" as the default recommendation, judged by checker 1 when it is not | the conversation check |
| Putting hard work off with a free label | the fixed reason codes; the put-off question to both checkers | the step's checks; step 14 passes only with no open item |
| Finding at step 12 what step 7 should have found | the lateness script | step 7's complete check, reopened |
| A low budget as an excuse | the estimate is made by script from the item counts; `budget-refused` needs the user's refusal in the log | the status file's unpaid checks |
| Making old results "current" by editing their record | a result's commit field may change only together with its values, a compute job the budget keeper logged, and the hash of the fetched output | the freshness script (step 13) |
| A fix that changes a result, called internal | a (B1) fix that changes a kept result or a quoted number is a conceptual item | the step-8 group question; the golden difference list |
| Writing a rule that describes the code, or deleting working behaviour, without asking | the rule-scope procedure: every rule change is a conceptual item; every deletion is reported | tie-stage parts 3 and 4; the shortcut audit |
| Auditing only the lowest-level rules | the audit's scope is every rule at every level | the complete check, per rule |
| Acting on an approval remembered after a context summary | only an approval the gate confirms counts | the question-log checker at every checkpoint |
| Writing conceptual answers into the CLAUDE.md files at the end, or never | step 9 writes every approved answer before any code fix | hierarchy check 9 (tools: hierarchy checks) |
| Mis-citing line numbers, models or commits | every line number, model id and commit in the pack is produced by script | checker 1 |
| Substituting a checker, or going on with one | never allowed; a missing answer is never a pass | the record's model ids and providers; the conversation check |
| Sweeping other people's work into a commit | a separate worktree; staging by path only | `git status` and the diff in the pack |
| A checker that passes everything | planted canaries, drawn from real items, in every checkpoint | the canary results |
| A checker that adds new demands every round | a FAIL must name an item id; the parser decides | the record's round count |
| Claiming "done" with open items | the record writer derives the end state, and the script writes the report's first line | the final check; the shortcut audit |
| Doing a step only partly | the complete check, per clause, with the coverage tables and their floors | the final check's complete check; the shortcut audit |
