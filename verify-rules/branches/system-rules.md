# The system rules

- **When:** Step 1 finds a system rule missing, held in part, or worded to require something different.
- **Check it runs:** a mechanical item (missing) or a conceptual item (in part or different).
- **Detected by:** model text and structure check.

In the user's words, step 1 must "double-check that you have the structure of the Claude MDs and that the basic
rules that set up the Claude MD hierarchy within the conference matching API have to be there".

The repo's CLAUDE.md files must hold rules with these ideas. The user decided this list (the core). Match the rules
by idea: numbers and wording differ between repos.

- In every situation, a missing system rule, or a missing part of the structure, goes on the mechanical list, as
  the model text, because the user has already decided it.
- A system rule the repo holds only in part, or in words that require something different, goes on the conceptual
  list, and so does every conflict a system rule would create (step 1).
- A system rule the repo holds in other words with the same requirement needs nothing.
1. Never change a CLAUDE.md unless the user directly asks.
2. Report every CLAUDE.md change in the chat, file by file.
3. Keep the rules in categories. Reorganising categories never changes what a rule says, and is shown to the user.
4. When a new or changed rule conflicts with another rule, check, and the user decides.
5. No file paths or file names in a CLAUDE.md, with two exceptions: the single file that lists every dependency,
   and each lowest-level rule's own file.
6. Every decision of the user's is written into the CLAUDE.md files, once the user approves its exact wording.
7. Rules refer to each other by their idea, never by their number.
8. Rules sit as low as possible.
9. One rule ↔ one file, both ways: every counted file is tied to exactly one specific rule in a lowest-level
   CLAUDE.md, and every specific rule is tied to exactly one file (tools: tie-check template).
10. Each file states its rule's bold sentence, and each lowest-level rule names its file.
11. A two-way tie is written, both halves together, only once it is verified.
12. A check confirms every two-way tie, in both directions, at all times.
13. Code quality, in this order of priority: quality first, with no shortcuts; then speed; then low cost on
    average. Each repo's CLAUDE.md says what quality means there (audit fix 6).
14. Only the latest version of every file, and no one-off code lying around.
15. Scratch work stays scratch: anything designed or shown to work goes into the repo's code with its tests.
16. A rewrite never changes what the code does, and this is proven before the rewrite is used (the same check).
17. Fix at the root, inside the process, never by hand-editing results; a mistake made twice becomes a check.
18. Test first, always.
19. All tests pass before work is committed.
20. Done means proven on the real thing, with the evidence shown, as long as it fits within the run's budget.
    Otherwise the user is asked to raise the budget.
21. Honest claims: every claim Claude reports is labelled measured, inferred or a guess, and no number, link,
    citation or result is ever invented.
22. One file lists every dependency with its exact version, and the code uses nothing that file does not list.
23. Secrets never go in the repo: no keys, tokens or passwords in any tracked file, commit, pull request or chat.
24. Long jobs show progress, save as they go, and notify the user's phone when they end. This applies where a repo
    has long jobs.
25. Safe to stop and rerun: every save is written whole or not at all, and a stop plus a rerun ends in the same
    state as one clean run.
26. Runs, downloads and paid calls need the user's go. The run's budgets count as that go (budget.md).
27. Ask first only before very dangerous actions (dangerous-action.md). Everything else runs to the end without
    stopping. Questions are asked in batches, and work goes on with everything that does not depend on the answers.
    In the user's words: "only for the very dangerous actions, because usually what I ask it to do is just run.
    Don't stop until [it's] done."
28. The personal System Rules block travels with every repo, word for word (system-rules-block.md).
29. Nothing is duplicated without a purpose: no rule appears twice across all the CLAUDE.md files, and no two files
    or pieces of code do the same job, unless a rule states the purpose (duplicates.md).

Not on the list, by the user's decision: a rule saying who "the user" is.

Already covered: that the CLAUDE.md files outrank everything below them. It is in the copied summary that every
CLAUDE.md starts with (tools: model text and structure check), so step 1 checks it there.

How rule 1 is read: its only exception is reorganising the categories rules are grouped into. That the CLAUDE.md
files may name each lowest-level rule's file does not allow writing a file line without approval: every file line
goes on the mechanical list (tools: list builder).

How rules 1 and 6 fit together: rule 6's words "once the user approves its exact wording" remove the clash between
them. A decision reaches a CLAUDE.md only as an item the user approved by its number, with its exact text, and
approving it is the user directly asking for that change.

Example: in conference-matching-api, many of these ideas are present under other numbers, while the decision rule
and a phone-notification rule are missing (measured by the dry run and the system-rules study).

Run the rule reader on every CLAUDE.md; it skips the copied opening and the System Rules block. For each approved
system rule, find the rule that holds it, matching by idea. Build a table: system rule → its CLAUDE.md and bold
sentence; or "partly", with the difference quoted; or "missing".

In every situation, each missing system rule gets a mechanical item, with the model text (tools: model text and
structure check). Each system rule held only in part, or in words that require something different, gets a
conceptual item: its exact proposed text, in the repo's words; the CLAUDE.md it goes in; what it changes; why; and
which later steps cannot run if the user declines it.

- The user decided the list of system rules in system-rules.md ("Those look fine to me"), including the decision
  rule in the form "once the user approves its exact wording", which removes its clash with the rule never to
  change a CLAUDE.md, and including test first, long jobs, and runs that need the user's go (settled reading: the
  budgets are that go, and the phone push applies only where a repo has long jobs).

*That the run's budgets count as the go of the rule on runs, downloads and paid calls, and that the phone push
applies only where a repo has long jobs, are readings of the user's words, waiting for confirmation on list C
(audit fix 9).*
