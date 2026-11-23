# A conflict between rules

- **When:** Two rules conflict; a proposed rule would create a conflict; two parts of these instructions cannot
  both be met.
- **Check it runs:** a conceptual item quoting both rules, or a stop at once.
- **Detected by:** item lister.

Step 1 also finds conflicts between rules the repo already has, not only missing system rules. Each conflict goes
on the conceptual list, quoting both rules, with a recommended resolution. It is never fixed by the doer. Kinds to
look for, each shown with an example of its kind (the quotes come from the system-rules study of
conference-matching-api):

- **Rules that make a CLAUDE.md follow the code**, such as "When the way a step is done changes, these files change
  with it", against the rule never to change a CLAUDE.md unless the user asks.
- **Rules that name a person**, such as "Rupert's go", where other rules say "the user".
- **Status text in a CLAUDE.md**, such as "For now…", against the rule that the CLAUDE.md files hold only rules.
- **Any two rules that cannot both be met.**

The user said there was no need to worry about conference-matching-api's own clashes for now. They are not settled:
when the skill runs on that repo, step 1 lists them like any others.

Give a verdict on every pair the script's conflict list holds (tools: coverage tables).

Each conflict a proposed rule would create gets a conceptual item that quotes both rules. Typical conflicts: with a
rule against naming implementations, a rule against file names, or references by number.

- **A conflict inside these instructions is not a round.** If a FAIL comes from two parts of these instructions
  that cannot both be met, stop at once, quote both sentences, and ask the user (kind b). In the simulation, one
  such conflict made a step fail every round (measured).

- A decision that is only about this run (its budgets, continuing past a failed step) is recorded in the question
  log. If the repo's rule that every decision is written into the CLAUDE.md files seems to require writing it
  there, while its rule against status in a CLAUDE.md forbids that, the doer raises the conflict with the user
  instead of choosing. In a repo set up by the skill, the model decision rule already keeps run-only decisions in
  the run's record (system-rules.md), so this clash does not arise there.

*Reading "No need to worry with the conference API's own rules and clashing there" as "for now", so that step 1
still lists those clashes when the skill runs on that repo, is a reading of the user's words, waiting for
confirmation on list C (audit fix 9).*
