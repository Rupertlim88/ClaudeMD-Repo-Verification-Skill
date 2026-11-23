# Situation A: an empty or new repo

- **When:** Step 0 finds no counted file and no CLAUDE.md: situation A, an empty or new repo.
- **Check it runs:** the set-up order of steps; the run ends "done (set up)".
- **Detected by:** situation detector.

**(A): the set-up branch.** The steps run in this order: step 0; step 1A (the interview); step 1; step 3; step 4;
step 8; step 9; step 2; step 14. Steps 5, 6, 7, 10, 11, 12 and 13 have no code to work on. Each is recorded by
script as "not needed: no code", with the count of zero counted files as its evidence. In situation (A) the run
ends once the structure and the rules are set up; code is written in later runs. In the user's words: "It's going
to set everything up." What differs in (A), each point also written into the step it changes:

1. **An empty start commit.** If the repo has no commit, step 0 first makes one empty commit on the main branch. It
   changes no file, so it counts as no change, and it is the run's start commit. The worktree and the branch are
   made from it.
2. **Budgets before any paid call**, as in every situation (step 0).
3. **The interview** (step 1A). Its folders question carries the doer's proposed folder tree as its recommendation,
   so that "you decide" settles it.
4. **Model text for every system rule** (tools: model text and structure check). The structure, the system rules,
   the personal System Rules block and the skills that block needs go on the mechanical list, because the user has
   already decided their text. The entries of the allowed-CLAUDE.md tree and each new CLAUDE.md stay conceptual
   items, built from the interview's folders answer (step 3). The user's specification of each part is written as
   rules, in the user's words, on the conceptual list (step 1A).
5. **The System Rules block is one skipped unit** for the rule reader, the two-way tie check and hierarchy checks 5
   to 8, as the copied opening is (system-rules-block.md).
6. **Step 4 runs on drafts.** No CLAUDE.md exists yet, so the mover assembles draft CLAUDE.md files in the run
   folder from the list items, and the rule reader reads those.
7. **Planned file lines.** Step 8 adds one planned file line per specific rule to the mechanical list, so that a
   later run can write each two-way tie once its file passes its clause audit (tools: list builder).
8. **Empty items are not sent to Jev.** An item whose list the script counts as empty (for example "every test
   command" before any test exists, or "every CLAUDE.md before the run") is recorded by script as "none: 0 items".
   The test list is compared from the end of step 2, when the first tests exist.
9. **"Needed" counts as done.** The run ends with every specific rule marked "needed" and the two-way tie check
   reporting 0 broken. In (A) a "needed" rule is not an open item. Each of its clauses is recorded by script as
   "needed: no code". The run ends "done (set up)", and the end-of-run report lists every "needed" rule as code
   still to write.
10. **Later runs tie the code.** Each file and its rule are tied both ways only once the code exists and passes its
    clause audit, with the tie-stage check and its four parts (tools: tie-stage check). That happens in later runs,
    as situation (C).
11. **The same check** compares the written CLAUDE.md text with the text of the approved list items, word for word,
    by script, and Jev and the Claude checker judge that proof (the core).

- There, Jev's question is: "Does the written CLAUDE.md match the approved list items word for word, as the
  script's comparison shows?"

*That a run in a new repo ends once the structure and the rules are set up, with the code in later runs, is a
reading of the user's words ("It's going to set everything up"), waiting for confirmation on list C (audit fix 9).*
