# Sorting and making the fixes (steps 8 and 11)

- **When:** A finding is sorted (step 8) or fixed (step 11).
- **Check it runs:** the group question; each group's proof.
- **Detected by:** state-builder registry.

Sort every finding into exactly one group, with a reason, by the group question: "Which group is this finding in:
(A) a code fix that cannot change any output; (B1) a code fix that makes the code do what its rule says, and so
changes internal results; (B2) a code fix that changes what a part's callers see; or (C) a change to what a rule
requires, or to the method?"

- **(A)** needs its proof that outputs stay identical;
- **(B1)** needs its own test, a measured before and after, and usually a rerun. A (B1) fix that changes a kept
  result or a number quoted in the docs also gets a conceptual item: "This changes a number in your results: before
  X, after Y";
- **(B2)** follows the repo's contract and versioning rules (contract first, perhaps a new version), and goes on
  the conceptual list;
- **(C)** goes on the conceptual list.

A finding with a conceptual part is split: the conceptual part goes on the conceptual list, and the code part is
sorted on its own. Example from the simulation: a median that took the upper middle value was both a question
(which median does the user mean?) and a code fix (measured). Adding a clause, or moving a guarantee from one rule
to another, is conceptual even when no output changes.

Label each (B) gap "fits this run" or "needs scheduling". A whole new feature, an outside service, or work that
would outlast the run needs scheduling, and needs the repo's planning process (for example brainstorming first)
before it is built. Each one that needs scheduling gets the put-off question of open-items.md from both checkers;
if it passes, it gets a conceptual item in the first group of the list. Example: in conference-matching-api,
closing every security clause would mean building whole features such as multi-factor sign-in (inferred by the dry
run).

Add each tolerance question from step 6, and each conceptual finding from step 7, as a conceptual item.

Close every gap scheduled for this run. If the code does not do something its rule asks, the code is made to do it.
The rule is never weakened to match the code, unless the user decided so. Every clause without a test gets one,
proven by the mutation runner's generated single mutation (tools: coverage tables).

(A): prove that outputs stay identical, against the golden record.

(B1): write one test per fix that fails before the fix. Measure the change on the golden inputs, and show before
and after side by side. The script first lists every difference; then the golden record is updated for exactly the
outputs that fix was meant to change, keeping the before and after in the record. A (B1) fix that changes a kept
result or a number quoted in the docs is made only after its conceptual item was approved (step 8).

(B2): change the contract first, with its tests passing, then each side, as the repo's rules say.

The approved rule-scope decisions: a piece given its own rule moves into its own file; a broadened or combined
rule's file stays as it is; a piece the user chose to remove is removed, test-first. A piece that goes against a
rule is deleted, test-first, because the rule wins.
