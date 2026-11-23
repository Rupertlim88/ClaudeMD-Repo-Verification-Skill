# The repo's rules that change how the run goes

- **When:** A repo rule changes how the run must go, or a CLAUDE.md disagrees with these instructions.
- **Check it runs:** every such rule listed, quoted and followed; the CLAUDE.md wins.
- **Detected by:** item lister.

When these instructions and a repo's CLAUDE.md files disagree, the CLAUDE.md files win. Stop and tell the user what
disagrees, quoting both.

If this is the session's first reply, do every start-of-session duty the CLAUDE.md files require before anything
else (for example, explaining how the CLAUDE.md system works, or saying the app's mode and checking a live switch).

List every repo rule of the kinds below, quoted, each with how the run will follow it. If the repo has no rule on
how finished work reaches the main branch, ask once (kind b, other-people.md), in the same message as any other
start question.

Many repos have rules that change how this skill must run. In step 0 the doer lists every such rule, quoting it,
and writes how the run follows it. The run follows them. Where one contradicts these instructions, the CLAUDE.md
wins: stop and tell the user. Look for at least these kinds. Conference-matching-api has every kind below (measured
by the dry run).

- **How work reaches the main branch**: a branch per person; a draft pull request opened before work starts; one
  piece of work per pull request; required checks; staying up to date with main; when merging is allowed, for
  example by a mode switch (in test mode finished work is merged; in production mode each merge needs the user's
  permission).
- **What needs the user's go, or must always be asked first**: experiments, downloads, paid model calls, writing to
  outside services, spending money, deploying, sending messages. The run's budgets count as the user's go for the
  runs, calls and services they name (dangerous-action.md; budget.md).
- **Start-of-session duties**: for example, explaining how the CLAUDE.md system works before anything else in the
  first reply, or saying the app's mode and whether a live service is switched on, checked at that moment.
- **What must pass before a commit**: for example "run all test suites", or a check for secrets.
- **Versions offered side by side**: which folders are versions (tools: rule reader).
- **Contracts that must change first**: a part's inputs and outputs fixed by a contract that is changed before the
  code on either side.
- **Who "the user" is** when several people work on the repo.
- **Long jobs**: progress lines, saving as they go, resuming, phone pushes; where heavy jobs must run (for example
  on a remote GPU service, never on the local machine) and under which accounts.
- **Required skills and tools**: for example a test-first skill that must be invoked before writing code, a project
  verification skill, or a fixed tool stack.
- **Where work may be written**: for example a scratch pad allowed only while experimenting.
