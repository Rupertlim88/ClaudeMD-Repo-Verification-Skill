# Working beside other people and sessions

- **When:** Uncommitted work, an ownership note, an open pull request, another branch, or main brought in.
- **Check it runs:** never touch it; folders left out carry `other-owner`.
- **Detected by:** gate.

- Work in a separate git worktree, on a branch made from a clean commit of the main branch (in situation A, the
  empty start commit; situation-a.md), unless the repo's rules say otherwise. Never work in a working tree that
  holds another person's or session's uncommitted work. Example: during the adversarial review, another session had
  12 modified files in senior-thesis-research's working tree (measured by the adversarial review).
- If the repo's working tree holds uncommitted work at the start, ask whose it is (kind c). Never commit, stash,
  move or discard it.
- Stage only the paths the step changed, each by name. Never use `git add -A`, `git add .` or `git commit -a`.
- Every checkpoint commit carries the record's hash as a trailer (tools: record).
- Follow the repo's rules on branches, draft pull requests, one piece of work per pull request, required checks,
  bringing main in, and merging (repo-rules.md). If the repo has no such rules, ask once at the start (kind b), and
  follow the answer for the whole run, to the end. Example from the empty-repo simulation: the user answered "Just
  commit to main", and the run left its work unmerged on its branch (measured), which did not follow the answer.
- Before starting, check open pull requests, other branches, and any note in the repo that says another session
  owns a folder. Example: conference-matching-api has a status note saying other sessions own the engines (measured
  by the dry run). Leave those folders out of steps 10 and 11, or ask. Items left out this way carry the reason
  code `other-owner` (open-items.md).
- When the run brings main into its branch and main has changed a CLAUDE.md, the change is checked against its own
  pull request (tools: question log). Steps 4 to 8 are redone for the rules it changed, if step 9 has not yet run.
  After step 9, those rules go on the follow-up lists (late-finding.md).

- Never touch another agent's or session's files, branches or jobs (for example kernels on a remote GPU service).

Check the working tree (`git status --porcelain`), open pull requests, other branches, and ownership notes. Ask
about uncommitted work (kind c). List the folders the run leaves out.

Create the worktree and the branch. In situation (A), if the repo has no commit, first make one empty commit on the
main branch; it changes no file, and it is the run's start commit (situation-a.md). The branch's first commit
message names the start commit and the baseline (tools: gate). Open a draft pull request first if the repo's rules
require one.
