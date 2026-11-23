# Classifying a rule: general or specific

- **When:** A rule must be classified, or a whole-folder mark is proposed.
- **Check it runs:** blind classification; specific is the default.
- **Detected by:** rule reader.

General rules are not tied to a file. They must still be accounted for, in three ways.

**Every rule is classified, blind, and specific is the default.** Calling a rule general removes its need for a
file, so a wrong "general" is the costly mistake. In the loophole hunt, Jev classed three rules that
senior-thesis-research ties to single files as general, at 0.25 to 0.39 (measured). So:

- A script lists every rule in every CLAUDE.md. Jev gets one request per rule, without the doer's label: "Does this
  rule state what one specific piece of code does, rather than a requirement for a whole folder or the whole repo?"
  p is the probability of "specific". The provisional thresholds are 0.72 for specific and 0.27 for general (tools:
  thresholds and calibration).
- The Claude checker classifies each rule the same way, also without the doer's label.
- A rule is **general** only when all three hold: Jev's p is below 0.27; the Claude checker says general; and a
  script fact agrees: the rule's key nouns match code in two or more counted files, or in none (a rule about how
  Claude works). Otherwise the rule is **specific**.
- When Jev is unsure, the second Claude checker is asked too (tools: Claude-checker launcher), and the rule is
  general only if both Claude checkers say general and the script fact agrees.
- Any other disagreement, between Jev, the Claude checkers, the script fact and the doer's own reading, puts the
  rule on the conceptual list as the question "Is this a rule for one file, or for the whole folder?", with the
  doer's recommendation. Until the user answers, the rule is specific.
- The script compares the count of specific rules with the baseline (tools: gate). Every rule that stops being
  specific during the run needs its own approved conceptual item, by number.

**A general rule in a lowest-level CLAUDE.md is marked** ``*File:* the whole folder``. The repos' own rules allow
this one exception: a lowest-level rule that covers its whole folder and cannot be split is tied to no single file.
The skill keeps the exception, because a whole-folder rule is a general rule (my reading of the user's
clarification). Example: "Difficult cells are not detected" in senior-thesis-research (measured).

- Each mark gets one Jev request: "Does this rule state a requirement for its whole folder, and not the job of one
  file?" The provisional thresholds are 0.88 and 0.60. The answer must also agree with the class question.
- Writing a whole-folder mark removes a rule's need for a file, so it is always a conceptual item
  (is-it-mechanical.md). Measured in the loophole hunt: the whole-folder question passed the Kaggle-sender rule at
  0.90, although its text ("Before each run, the code checks that it is that account…") is plainly one file's job;
  marking it and blanking its file's heading left the tie check reporting 0 broken.
- A script refuses the mark, and the indent of a rule into a sub-rule, on any rule that has, or ever had in the git
  history, a file line or a "needed" mark, unless an approved conceptual item names that rule.

**Every general rule's clauses are checked**, clause by clause, in every folder the rule covers, under the complete
check (steps 7 and 12).

- **"the whole folder"**: the mark of a general rule in a lowest-level CLAUDE.md. It is never put on a specific
  rule to avoid giving it a file, and it is always written through an approved conceptual item.
