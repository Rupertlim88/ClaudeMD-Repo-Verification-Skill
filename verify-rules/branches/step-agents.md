# Step agents and reviewers

- **When:** Steps 7, 10 or 11 start agents.
- **Check it runs:** each agent in its own folder, with a progress note.
- **Detected by:** run folder and state.

Start fresh read-only reviewers: Claude agents on a model different from the doer's, of a read-only agent type.
Start one reviewer per CLAUDE.md in scope, with at most 40 clauses each; split larger sets. Each keeps a progress
note (tools: run folder and state). The doer does not use Jev in the audit itself; Jev checks the audit's items, so
the check stays independent.

Give each folder to its own step agent, all with one fixed map of files and public names. Folders that do not
depend on each other run in parallel; folders that use others go last. Use one agent per language, each with its
own test command. In a repo with one folder, the doer may act as the step agent, under the same rules. Leave out
the folders others own (other-people.md).

Each step agent:

- invokes the repo's test-first skill before writing code, as the repo's test-first rule asks;
- works only in its own folder of the run's worktree, and never commits;
- keeps its progress note (tools: run folder and state);
- first creates each new file with every public name from the map as a stub that raises a "not implemented" error;
- moves the tests first, and watches them fail on that error or on an assertion. A failure from a missing import, a
  missing file or a syntax error is not a valid red;
- moves the code, then watches the tests pass;
- carries out the rule-scope endings planned as code moves, and the planned merges of duplicate code, and deletes
  code that nothing calls and nothing reads (file-does-more.md; duplicates.md), each listed;
- keeps every name the map marks as fixed; where the repo's rules say a contract changes first, changes the
  contract first;
- updates, in the same change, everything wired to a moved path (step 3);
- deletes every file that is not in the map, apart from versions offered side by side;
- writes no heading that states a rule's bold sentence;
- reports any gap between rule and code to the doer, without changing any rule.

For each folder, the doer runs every test command the repo's rules require before a commit (for example "all test
suites"), and the golden comparison. Then it commits that folder, staging by path.

- Each step agent and each reviewer keeps a progress note in the run folder: the items done, with their saved
  evidence; the item in progress; and the items left. It rewrites the note whole after every item. In the user's
  words: "make sure you don't lose what you're doing in all the subagents."

- Step agents work only inside their own folder of the run's worktree, and never commit. The doer commits after the
  folder's checks pass, staging by path.

Reviewers get a fixed prompt file that ships with the skill, and answer in a fixed form, one line per clause:
`<clause id> | CARRIED <file>:<lines> or GAP | TEST <test id> or NONE | CALL SITES <file>:<line>, …` (LodeSTAR
test, problem 16: without them, the test's doer wrote both).
