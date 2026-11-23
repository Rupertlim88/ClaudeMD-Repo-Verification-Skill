# Resuming after a stop

- **When:** A context summary, a usage limit, a crash or a restart; a new session; a branch with earlier run
  commits.
- **Check it runs:** the record's chain against the commit trailers; re-approval; recapture from the start commit.
- **Detected by:** gate.

- After any context summary, or whenever unsure what has been done: re-read these instructions and the whole state.
  Check that no agent in the state's list of running agents is still working, and that no uncommitted change in the
  worktree belongs to one. Wait for running agents; never commit their work. Then resume at the first item that has
  not passed, in the first step without a recorded pass by both checkers.
- An agent that no longer runs, after a usage limit, a crash or a restart, is replaced by a fresh agent on the same
  folder. The fresh agent reads the old agent's progress note and goes on from the first item not done. Uncommitted
  changes the old agent left are kept only where they match a done item that then passes its three checks.
  Everything else is redone. Nothing is committed unchecked.
- (open: Claude usage) When a usage limit stops the run, everything finished is already saved. After the limit
  resets, the run resumes as above, and a push notification says it has resumed (long-job-duties.md).
- In a new session: if the user points the skill to an earlier run folder that still exists (its path was printed
  in the chat), resume from it, as above, after the gate has verified the record's chain against the branch's
  commit trailers (tools: record).
- Otherwise, start a new run from step 0, with the old run's start commit as its start. That commit is named in the
  run branch's first commit message (tools: gate). The baseline is the merge-base with the default branch (tools:
  gate). The new run's "before" test outputs and golden outputs are captured again from that commit, never from the
  run's branch. Every CLAUDE.md line changed since the baseline is shown to the user again on the lists, and
  approved again. Every step's checks run again on the branch's work. If the start commit cannot be found, the run
  stops and tells the user that the before-and-after proof is lost (kind b).
- Never act on a remembered approval. Only an approval the gate confirms counts. If the log has no quote for an
  approval the doer remembers, the approval does not exist.
- Never re-ask a question the log already answers, except an approval the gate cannot confirm (tools: gate).
