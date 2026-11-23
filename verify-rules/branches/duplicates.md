# Duplicates

- **When:** The duplicate finder lists a candidate pair.
- **Check it runs:** a verdict per pair; a merge for each duplicate.
- **Detected by:** duplicate finder.

In the user's words: "you cannot have duplicate rules across like all the Claude MD files. So sometimes we're gonna
have two agents or more working on different parts of the repo. And when that happens, you may have a duplicate of
the Claude MD rule or a duplicate of the file. In that case, you need to actually merge them. There should never be
duplicates of something without the actual purpose of having duplicates. … It kind of is in the same spirit of the
idea that you can't just have like old files sitting around." This is a system rule (system-rules.md).

**What counts as a duplicate:**

- two rules, in one CLAUDE.md or in different ones, that require the same thing;
- one requirement stated by two rules (file-does-more.md);
- two files, or two pieces of code, that do the same job;
- two files that write the same output;
- one clause carried out twice in one file (untestable-clause.md, "not testable here").

**Duplicates with a purpose** stay, but only where a rule states that purpose:

- the copied opening that every lower CLAUDE.md holds (tools: rule reader);
- the personal System Rules block (system-rules-block.md);
- the versions a repo offers side by side (tools: rule reader).

Any other duplicate that should stay needs a rule that states its purpose. Proposing that rule is a conceptual
item.

- **One requirement stated by two rules** has two owners. It goes on the conceptual list: which rule keeps it.
  Until the user answers, its clause is checked in the file whose result it is. Example from the live test
  (measured): "showing LodeSTAR alone and LodeSTAR with FSCN" is both a clause of the experiments rule and a clause
  of the graph rule in senior-thesis-research.

Inside one version, a helper used by two files is a piece for the rule-scope chain (question-chain.md, question 6).

**The fix is a merge:**

- **Identical copies of a rule**: keep one, in the lowest CLAUDE.md that covers everything it touches, and remove
  the others. This is a mechanical item only when the script shows that the kept copy covers exactly the files that
  the copies covered together (is-it-mechanical.md); otherwise it is conceptual.
- **Copies that differ in wording or meaning**: a conceptual item. The doer proposes one merged text, with every
  requirement of each copy kept or its loss named, and the user picks the text.
- **One requirement in two rules**: a conceptual item, as file-does-more.md says.
- **Two different rules that share one bold sentence**: a name clash, not a duplicate. One of them gets a new bold
  sentence, through the conceptual list.
- **Duplicate code**: keep one owner, and make the callers use it, test-first, with the same check proving the
  behaviour unchanged. Where two rules need the code, it is a shared owner under a "written once" rule
  (question-chain.md, question 6). Code work that changes no rule needs no question.
- **Two files that write the same output**: one owner keeps the write, and the other file stops writing it. If both
  rules require the write, that is one requirement in two rules (conceptual).

Examples:

- conference-matching-api has "The steps, in order." as the bold sentence of two different rules in six places, and
  its copies disagree: a name clash (measured by the system-rules study). One rule stands in three of its CLAUDE.md
  files (measured by the dry run).
- In the live test on senior-thesis-research, the difficult-cells clause is carried out twice in `examples.py`, so
  its mutation changed nothing (measured).
