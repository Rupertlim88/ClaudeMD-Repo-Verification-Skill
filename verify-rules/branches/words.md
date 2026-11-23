# Words used in this skill

- **When:** A term in these instructions is unclear.
- **Check it runs:** none: it only defines words.
- **Detected by:** the doer, at any step.

**Kinds of rule.**

There are two kinds. Every rule in every CLAUDE.md is one or the other (general-or-specific.md).

- **Specific rule**: states what one specific piece of code does. Example from senior-thesis-research: "How
  LodeSTAR's outline is made". It sits in a lowest-level CLAUDE.md, as low as it can, and it is tied to exactly one
  file, both ways (tools: tie-check template). When the class is in doubt, a rule is specific
  (general-or-specific.md).
- **General rule**: states a requirement for a whole folder or the whole repo, not the job of one file. Examples
  from senior-thesis-research: "test first", "no Cellpose", "long jobs show progress", "A model never depends on a
  dataset". It is tied to no file, but it is accounted for (general-or-specific.md). Its clauses are checked in
  every folder it covers.
  - A **process rule** is a general rule about how Claude works, not what code does. Examples: test first; explain
    the system at the start of a session; send a phone push when a long job ends. Its clauses are checked against
    the run's own record, not by tests (steps 7 and 12).

**CLAUDE.md files.**

- **Global CLAUDE.md**: the one at the repo root. **Lower CLAUDE.md**: any other one.
- **Lowest-level CLAUDE.md**: a CLAUDE.md with no other CLAUDE.md in any folder below its own folder.
- **Covers**: a CLAUDE.md covers every file and folder in its own folder and below. A file's **nearest CLAUDE.md**
  is the one closest above it: in its own folder, or else in the closest folder above that has one. A rule's
  **covered files** are the counted files it applies to, listed by script: for a general rule, every counted file
  its CLAUDE.md covers; for a specific rule, its one file, or its planned file (is-it-mechanical.md).
- **Allowed list**: the list of CLAUDE.md files the repo allows. It is the global CLAUDE.md's list together with
  every list kept by a version folder's own CLAUDE.md. Example: in conference-matching-api, the engine
  `commonkads_v1` keeps its own list (measured by the dry run).

**The work.**

- **Unit of work**: one part of the repo that the CLAUDE.md files describe as a part, such as a model, a dataset, a
  backend, an engine or a UI. Its rules are about the same code, and its files are used together. A unit of work is
  never one rule. A folder is proposed for a unit of work only when the CLAUDE.md files describe that part, or, in
  situations (A) and (B), when the interview's drafted rules describe it (step 1A).

- **Item**: one unit of a step's work, checked on its own: one rule, one clause, one file, one piece, one moved
  piece, one list item, one test command, one message. Every step lists its items by script.

- **Gap**: a clause that is not carried out (a **gap to implement**), or that is carried out but not tested (a
  **gap to check**).
- **Finding**: anything the audit reports: a gap, code that does more than its rule says, a bug, a broken general
  rule, a duplicate. Each finding has a location, what it is, a label (measured or inferred), and its fix kind: its
  group in step 8 (A, B1, B2 or C).

- **Open item**, **declined item** and **follow-up lists**: open-items.md; late-finding.md.

Rule, rule text, bold sentence, sub-rule and copied opening: tools: rule reader. Clause: tools: clause-table
builder. Piece: tools: piece cutter. Tested: tools: mutation runner. Golden outputs: tools: golden harness. Code
file: tools: exempt-list builder. Kept results: kept-results.md.

- **Doer**: the agent running the skill and doing the work.
- **Step agents**: agents the doer starts for one folder each, in steps 10 and 11.
- **Reviewers**: read-only agents the doer starts for the clause audits (steps 7 and 12).
- **Checkers**: checker 1, a fresh Claude checker on a different Claude model from the doer's (tools:
  Claude-checker launcher); checker 2, Jev (jev-unsure.md); and the second Claude checker, which judges every item
  Jev left unsure (tools: Claude-checker launcher). Scripts decide what is exact (the checker map). Only the gate
  script starts a checker.
- **Gate script**: the one script that runs every check, builds every state, starts every checker and keeps the
  record (tools: gate).
- **Baseline**: the commit every "same" check and every approval check compares with (tools: gate).
- **User**: the person whose intent the CLAUDE.md files hold. When several people work on the repo, only the person
  who invoked the skill approves, in this conversation (reading-approvals.md).
- **Evidence pack**, **canary** and **record**: SKILL.md: the checkpoint. **Run folder**, **state**, **question
  log** and **status file**: tools: run folder and state.
