# A file or a rule that cannot be tied yet

- **When:** A counted file has no rule or no lowest-level CLAUDE.md, or cannot carry a heading; a specific rule has
  no file.
- **Check it runs:** a planned fix on a list, or an open item.
- **Detected by:** tie-check template.

A file whose nearest CLAUDE.md is not lowest-level fails. It is fixed in one of two ways:

- a new lowest-level CLAUDE.md for its folder. That is a change to the allowed-CLAUDE.md list, so it goes on the
  conceptual list (tools: list builder);
- a move of the file into a folder whose nearest CLAUDE.md is lowest-level.

It is never fixed by an exemption.

Other cases:

- **Code under a CLAUDE.md that is not lowest-level**: the skill proposes a new lowest-level CLAUDE.md for it (a
  change to the allowed-CLAUDE.md list, so it goes on the conceptual list), or a move. Never an exemption.
- **A rule whose code lives in another repo**: the skill proposes moving the rule to that repo, on the conceptual
  list.

For each counted file whose nearest CLAUDE.md is not lowest-level (it fails file → rule, tools: tie-check
template), plan the fix: a new lowest-level CLAUDE.md (a conceptual item), or a move into a folder whose nearest
CLAUDE.md is lowest-level (code work, done in step 10). Never an exemption. Example: in conference-matching-api, 83
of 253 non-test code files sit under a CLAUDE.md that is not lowest-level (measured by the dry run).

A rule whose code lives in another repo gets a conceptual item: move the rule to that repo.

A counted file with no rule: plan to move its code into the file of a rule that covers it, or propose a new rule (a
conceptual item, even when the rule only describes what the code already does). Example: conference-matching-api
has an engine with 12 code files and no rules; writing its rules from its code would make the code the source of
the specification (measured by the dry run). Data goes into a folder of data, tied as a whole, both ways.

A planned specific rule with no file: plan its file. A rule with no code yet is planned for step 11, which builds
its file test-first; step 10 leaves it out. "Needed" is never planned as an end state (apart from situation A,
where this step does not run): a specific rule left "needed" fails rule → file. If no file can be planned in this
run, the rule is an open item with its reason code (open-items.md); a `doer-deferred` one gets the put-off
question.

A rule that no file in this repo can carry out: if its code is in another repo, a conceptual item to move the rule
there; if it describes a way of working, it may be a general rule (words.md): classify it again as
general-or-specific.md says.
