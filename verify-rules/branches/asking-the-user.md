# Asking the user anything

- **When:** The doer is about to ask the user anything.
- **Check it runs:** only kinds (a), (b) and (c); batched; with a recommendation.
- **Detected by:** question log.

Every message that asks the user something is one of these three kinds. Nothing else is ever asked.

- **(a) The run's numbered lists** (late-finding.md): the mechanical changes and the conceptual changes, shown
  together in step 9, and any follow-up pair of lists after it; and the one confirmation of a bulk approval of them
  (reading-approvals.md).
- **(b) A conceptual question asked outside the lists**, about goals, trade-offs, risk, or how the work should be
  done at the level of method (audit fix 3): the interview of a new repo, or of the parts of a repo no CLAUDE.md
  describes (step 1A); the two budgets at the start, with each untraced result and its rerun cost (budget.md);
  raising a budget; any other decision about cost that comes up during the run; the approval of a very dangerous
  action (dangerous-action.md); whether to continue after a step still fails after three rounds (rule-conflict.md);
  a conflict between two parts of these instructions (rule-conflict.md); a choice the repo's rules leave open about
  how work reaches the main branch; using a Claude checker ranked below the doer's model (tools: Claude-checker
  launcher).
- **(c) A request for something only the user can do or tell**: a login; a credential; a fact only they know (whose
  the uncommitted work is, a figure on a site the doer cannot reach); a change to a binary file the doer cannot
  edit; a check of a clause that only the user can make.

Messages that only tell are not questions: reports of CLAUDE.md changes, stop reports, the start-of-session
explanation, progress lines, the note that tests already failed at the start (step 0), the end-of-run report.

"The user was asked only conceptual questions", in the final check, means: every message that asked the user
something was of kind (a), (b) or (c). None asked about a mechanical detail, or for something the doer could check
by running it (audit fix 3). The mechanical list is shown because the user decided every run shows it (the core).

- Ask only when the answer changes what gets built and the CLAUDE.md files do not already answer it.
- Never ask the user to do something mechanical, to choose between implementation details, or to confirm something
  the doer can check by running it.
- Use plain words and short sentences. Never use internal words ("tie", "golden", "canary", "A/B/C") without
  explaining them in the same message.
- Kind-(b) and kind-(c) messages are sent when they are needed, once, with exactly what is needed. Questions are
  asked in batches: those that arise close together share one message, each numbered. While a question waits, the
  doer keeps working on everything that does not depend on its answer; only the work that depends on it waits. The
  interview (step 1A) is the one exception: its questions are asked one at a time. Credentials go through the
  session's credential flow, never pasted into the chat. Every question carries the doer's recommendation where one
  exists. A "continue?" question is written by script: the failing item ids, each checker's FAIL lines word for
  word, and the sentence "If you continue, this step stays unchecked."
