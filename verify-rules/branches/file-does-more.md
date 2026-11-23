# A file that does more than its rule

- **When:** A piece maps to no clause of its rule, or a piece does another rule's job.
- **Check it runs:** the rule-scope chain, then the ending's item.
- **Detected by:** function-to-clause table builder.

This is the principle the rule-scope study found in conference-matching-api, generalised, with its decision
procedure. The user adopted it as the skill's mechanical method. In the user's words: "Whatever you learn from the
conference API, just generalise and adopt it. This is more of a technical aspect that you deal with." And, on a
file that does more than its rule: "you can create a new rule, or you can broaden it… This is more of a technical
aspect that you deal with." So the doer runs the method itself, and chooses the ending. Only the outcomes that
change what a rule says (a combine, a broadening, a new rule) go on the user's conceptual list, as the doer's one
proposed text, together with the cases the method cannot decide. duplicates.md applies the same idea of one owner
to duplicates.

- A **result** is one thing the code makes or keeps that a person can name in one sentence and check on its own.
  There are four kinds:
  - one step's settled answer, with its record;
  - one kept thing, with the code that reads and grows it;
  - one shared way of doing a job that several parts use;
  - one constraint that every file in a folder obeys (a whole-folder rule, that is, a general rule).
- Everything a rule says is about its one result. Its file holds all the code that makes that result, and none that
  makes another. A file may call another rule's file, but code belongs to the rule whose words require it, wherever
  it is called from.
- Pieces the user names separately stay two rules, unless together they make one result (one answer, one record,
  one kept thing). Then they are combined under one bold sentence that names the result, with every sentence of
  both kept.

- When a file does more than its rule:
  - broaden the rule only if the extra is part of the same result: made in the same call or pass, kept in the same
    answer or record, and needed for the result to be right;
  - otherwise cut: move the extra to the rule that already asks for it; or move it to one shared owner, if two or
    more rules need it; or delete it, if it goes against a rule or nothing uses it; or give it its own file and
    propose a new rule, if it is a result of its own.
- Nothing in this principle counts lines. The choice is never based on a file's size. (Background only, measured in
  conference-matching-api: its 28 files named in file lines are about 75 to 713 lines long, with a median of about
  300.)

- The clause audit cites, for each clause of the file's rule and of each general rule over its folder, the lines
  that carry it out (step 7).
- The script builds the function-to-clause table from those citations (tools: coverage tables). Every piece that
  maps to no clause is an extra piece: a function, a branch, a check, an AI call or a record write that no such
  sentence needs. The doer cannot answer "none"; the table decides.
- For each extra piece, a script gathers four things: the piece's code; what it writes; who calls it; and the
  sentences of other rules that mention its subject.
- Then the decision chain (question-chain.md) runs on that state, one question at a time.

Extra pieces are found in the clause audit (step 7, against the planned map) and by parts 3 and 4 of the tie-stage
check (tools: tie-stage check).

In the user's words: "the cases where maybe the file demands more rules within CLAUDE.md, you should also take into
account that situation". That is the case where a file does things no rule asks for, or its job really needs
several rules. It is caught by part 3 of the tie-stage check (does everything in the file serve its rule?) and by
part 4 (does the file do another rule's job?), and earlier by the clause audit (step 7).

It is never resolved silently: never by quietly deleting working behaviour, and never by quietly writing a rule
that describes the code.

- **Endings that change no rule** are mechanical, and the doer does them: moving a piece into the file of the rule
  that already asks for it; moving it into an existing shared owner; deleting a piece that goes against a rule (a
  test-first fix, because the rule wins); deleting a piece that nothing calls and nothing reads. Each one is
  listed, with its evidence, in the end-of-run report. None is silent.
- **Endings that add or change a rule** are conceptual: a combine, a broaden, a new rule for a result of its own,
  and a new "written once" rule for a shared owner. The user handed the choice between a new rule and a broadening
  to the doer, so the doer makes it, by the chain. For each extra piece of behaviour, the skill puts one conceptual
  item on the user's list:
  - it opens with the script-written diff of what the rule would gain (tools: list builder);
  - it shows the doer's chosen ending as one proposed rule text, with the CLAUDE.md it goes in, and the chain's
    questions and answers as its reason;
  - its one alternative is "remove this behaviour", with what removing it would change.
- **A (c) ending** is conceptual too. It shows the piece, the rule, and the two closest outcomes, each as exact
  rule text, with the doer's recommendation.
- Until the user answers, the file stays without a two-way tie, with the reason listed.

The simulation asked what to do when one guarantee, such as "every count is logged", is carried out by a call in
one file and a writer in another. It follows from the principle: the code belongs to the rule whose words require
it. The call sits in the file of the rule that states the guarantee, and a writer used by several rules is a shared
owner with its own rule.

When part 3 or part 4 finds that a file does more than its rule, or another rule's job, file-does-more.md decides
what happens. Until the user answers any conceptual item that follows, the file stays without a two-way tie, with
the reason listed.

- The user's words: "the cases where maybe the file demands more rules within CLAUDE.md, you should also take into
  account that situation", and, about how this session handled it, "Like what you did this time, actually."
