# Auditing a rule clause by clause (steps 7 and 12)

- **When:** Step 7 or step 12 audits a rule.
- **Check it runs:** a verdict for every clause in every folder it covers.
- **Detected by:** clause-table builder.

- **Scope**: every rule at every level is checked clause by clause, by Jev, one request per clause. That is: every
  specific rule, in its planned place; every general rule, in every folder it covers; every approved system rule
  (including the code-quality order, "only the latest version", "nothing duplicated without a purpose", and the
  rule that a check confirms every two-way tie); and every process rule, against the run's own record (for example
  "test first" against the saved red outputs; "long jobs show progress" against the status file; "send a phone
  push" against the recorded push calls). A process rule can be checked only for this run, and the record says so.
  - Build each rule's clause table (tools: coverage tables): the script makes the first cut; the reviewer may cut
    further, never join; the script checks the span coverage and the floor. Each clause gets its kind from the
    clause-kind question, a choice question: "Which kind is this clause: (a) a requirement: something the code must
    do or must never do; (b) a reason: why the rule is as it is; (c) an outside source: the code follows something
    outside the repo; or (d) user-only: only the user can check it?" A clause is a requirement unless Jev, at its
    pass threshold, and the Claude checker both name another kind (untestable-clause.md). Where a rule points to an
    outside standard with many requirements, its requirements are its clauses. Example: rules that say "meets OWASP
    ASVS 5.0 at Level 3" in conference-matching-api, whose catalogue lists 345 ASVS requirements (measured by the
    dry run). Where the repo already traces such requirements to tests, use the trace for the clause list and the
    named tests, and still prove each clause.

For each clause the code carries out, the reviewer gives:

- where it is carried out now: the file and the lines. These cited lines bound the clause's mutations and build the
  function-to-clause table (tools: coverage tables);
- every call site that sets or passes a value or choice the clause fixes (search output), and whether each one uses
  it. Made-up example: a clause fixes an edge value of 3 in one file, while another file calls it with 0;
- its named test. The mutation runner then generates the clause's single mutations and records the result (tools:
  coverage tables). A test that only touches the function, without failing when the clause breaks, does not count.
  A clause that is not carried out is a gap to implement. A clause carried out but not tested is a gap to check. A
  clause with no single mutation possible is "not testable here", with its cause (tools: mutation runner).

A clause that could be carried out in more than one way that would matter to the user is a conceptual finding, so
it is settled on the conceptual list instead of in the middle of a fix. Example from the simulation: "plotted",
with no way of plotting given; the code returned a string that nothing printed, and every checker accepted it
(measured).

A general rule's clauses are checked in every folder it covers, one request per clause per folder.

For each planned file of the map, build its function-to-clause table (tools: coverage tables). Run the rule-scope
chain on each (question-chain.md). Each ending becomes a finding for step 8.

Check the general and system rules across folders: no forbidden imports; only public names used across folders;
every import listed in the dependency file; forbidden tools absent; the code-quality order (a check per file,
designed by the doer); only the latest version, with no old copies, commented-out code or one-off scripts (a script
search, then a check per file found).

Look for real bugs: a run that cannot resume, wrong behaviour on an edge case, a result read from a cache where it
should be computed. Subtle bugs are the Claude reviewers' and checkers' job (tools: Claude-checker launcher).

Re-verify every existing two-way tie the same way, both ways. Never trust one because the check passes.

Write each finding with: where, what, measured or inferred, and its fix kind.

Audit again with the step-7 method, on the final code: every rule at every level, with the clause tables updated
for the approved changes, every clause in every folder it covers, and every planned file's function-to-clause table
built again.
