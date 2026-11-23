# Budgets

- **When:** Step 0 asks for the budgets; a spend would go over a budget; any other cost decision.
- **Check it runs:** every spend checked first; going over stops and asks.
- **Detected by:** budget keeper.

- At the start of every run (step 0), before any paid call and before any long command, the doer asks the user for
  two budgets (kind b):
  - **money**: the total the run may spend, in dollars, on paid model calls such as Jev and on any other paid
    service;
  - **compute**: the number of Kaggle GPU hours, or the repo's own compute unit, where it has one. A repo that uses
    no compute service is not asked for this budget.

Without the budgets, the run stops.

- **The question names everything the budgets will cover**: each kind of spend and each outside service the run
  will use, such as Jev through its gateway, billed Claude use, the real before-and-after golden run, and the
  reruns of step 13. It also names each untraced result (a kept result whose record names no producing commit),
  with its rerun cost, and the user decides whether each one is rerun. That is a cost decision.

- The budgets count as the user's go for every run, call and service the question named, including the real
  before-and-after golden run (steps 6 and 14).
- The doer asks the user about any other decision about cost that comes up during the run (kind b). Example: a
  large download that the budgets do not cover.

- **Every check runs.** Within the budgets, the doer designs the check for every clause (untestable-clause.md), and
  every check runs. A check that cannot run because the user refused to raise a budget is an open item with the
  code `budget-refused`, and the user's refusal must be in the question log (open-items.md).
- Claude's own use (the doer, the Claude checkers, reviewers, step agents) counts against the money budget only
  where it is billed per call and its price can be read. The record says whether it was counted.
- (open: Claude usage) **Claude usage is reported, not capped.** The skill's agents also use the user's Claude
  plan, which has usage limits; the session in which these instructions were written hit one (measured). The
  proposal: the run keeps going until it is done. When a usage limit stops it, everything is already saved (tools:
  run folder and state), and the run resumes after the limit resets (resume.md). At the end, the report says how
  much Claude usage the run took: the number of agent and checker runs, their time, and their tokens where the
  session can read them. The other option, which is not followed unless the user chooses it, is a cap the user sets
  at the start, such as "at most N checker rounds".
