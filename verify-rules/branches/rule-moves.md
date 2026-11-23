# Moving, cutting, combining and naming rules

- **When:** A rule is to be moved, cut, combined, named, indented or renumbered.
- **Check it runs:** exact text only; the effect script and the same check.
- **Detected by:** mover.

A specific rule in a higher CLAUDE.md gets a planned move of its exact text, bold sentence unchanged, to the
lowest-level CLAUDE.md that covers its one planned file.

A rule that is two ideas gets a planned cut at a sentence boundary (tools: rule reader). A cut never falls inside a
fenced block, a table or a tag. Each part needs a bold sentence, in the repo's convention for split rules (for
example "<original>, continued: <part>", used in conference-matching-api; measured by the dry run). If the repo has
no convention, propose one form and use it for every cut. The cut and its new bold sentences go on the conceptual
list together.

A combine: the new bold sentence, with each combined rule kept word for word as a sub-rule under it. It goes on the
conceptual list.

An unnamed rule: propose a bold sentence for it (a conceptual item). An item that reads as a step of the rule above
it, not a rule of its own: propose indenting it as a sub-rule, as a conceptual item, because an indent can take
away a rule's need for a file (is-it-mechanical.md).

For each sub-rule, check that every clause is its parent file's job. A sub-rule that holds another file's job gets
a planned cut, as for a rule that is two ideas, above. Example from senior-thesis-research: a sub-rule under the
training rule also says how dots and outlines are made, which are other files' jobs (measured by the adversarial
review).

Numbering follows the repo's convention. If rules are numbered in one sequence across files (as in
conference-matching-api's engine; measured by the dry run), a moved rule keeps its number. If they are numbered per
file, it takes the next free number in its new CLAUDE.md. Renumberings are mechanical items. Every place that cites
an old number (from step 0) is listed for step 9.

For each planned change, write the clause tables of the text before and after (tools: coverage tables), and run the
effect script on it (is-it-mechanical.md). Its result decides the list: a change that keeps the same clauses, the
same covered files and the same rules that need a file can be mechanical; any other is conceptual, and its item
says what it would change, in the script's words.
