# Jev is unsure

- **When:** Jev's answer falls between a question type's two thresholds.
- **Check it runs:** a second Claude checker, never shown Jev's number.
- **Detected by:** Jev client.

How an answer is read:

- p at or above the pass threshold: PASS, where Jev's role allows a pass;
- p below the fail threshold: FAIL;
- p between the two: **unsure. Unsure is never a pass.** The item goes to the second Claude checker (tools:
  Claude-checker launcher), and it passes only if both Claude checkers pass it. For the classification question, an
  unsure item that the Claude checkers do not both call general stays specific (general-or-specific.md). In the
  rule-scope chain, question-chain.md says what an unsure answer does;
- where Jev's role is "may only fail", an answer at or above the fail threshold is recorded and decides nothing:
  the item's pass comes from the script and the Claude checker.

- **The second Claude checker.** Every item Jev left unsure goes to a second fresh Claude checker. The gate starts
  it like checker 1, on a model different from the doer's and, where one is available, different from checker 1's.
  It gets the item, its instructions and its evidence, and never Jev's number or checker 1's verdict. The item
  passes only if both Claude checkers pass it. Measured in the loophole hunt: of 12 wrong items, Jev failed 3,
  passed 3 and left 6 unsure, so a rule that let checker 1 decide unsure items alone, shown Jev's number, made
  checker 1 the only judge of half the wrong items. The second Claude checker also answers every item with no
  registered state builder (tools: gate), and the final whole-process question when Jev does not pass it (step 14).

The second Claude checker gets read access to the run's worktree, as checker 1 does. A pass it makes on less
evidence than checker 1 had counts as unsure (LodeSTAR test, problem 16: given only Jev's state, it passed items
that checker 1 failed from the repo).
