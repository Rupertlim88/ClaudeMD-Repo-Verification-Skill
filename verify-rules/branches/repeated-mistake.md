# A mistake made twice becomes a check

- **When:** A mistake kind reaches two.
- **Check it runs:** the mistake becomes a check, test-first.
- **Detected by:** mistakes list.

When the same kind of mistake happens twice, in one run or across runs, the skill turns it into a check: a script,
a test or a fixed Jev question. Never another sentence of instructions. (This is the one idea taken from the pstack
plugin.)

- A **mistake** is any item a checker failed, any canary a checker passed, any rule a check caught broken, and any
  step-7 miss the lateness script found (tools: lateness script).
- Its **kind** is the "watch for" entry, or the check, it matches. If none matches, the doer names the kind in one
  line.
- Within a run, the record counts mistakes by kind (tools: record).
- Across runs, the list in tools: mistakes list, which ships with the skill, is the memory of earlier runs. A
  mistake whose kind is already on it has been seen before.
- When a mistake kind reaches two, the doer turns it into a check in the same run, test-first. Where the check
  belongs to the repo, it is a test or a lint in the repo's suite. A check that needs a new rule goes on the
  follow-up lists. A check that belongs to the skill (a script, a test or a fixed Jev question in the skill's
  tools) is written up as an item for the skill repo, and the end-of-run report gives it. The report also lists
  every mistake kind not yet in tools: mistakes list, as an item to add there, so that a second occurrence in a
  later run is recognised.
