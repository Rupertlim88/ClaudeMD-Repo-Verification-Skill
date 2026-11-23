# The test commands, and tests that already fail

- **When:** Step 0 fixes the test commands, or a test command fails before the run changed anything.
- **Check it runs:** known failures recorded, reported, and fixed by step 14.
- **Detected by:** gate.

Run them in the run's worktree, which other-people.md makes first, never in a working tree that holds other
people's changes (LodeSTAR test, problem 12).

Find the repo's languages and file types, its test runners, and every test command its CI runs. Example:
conference-matching-api's CI runs at least 7 test commands, some needing a database or other services (measured by
the dry run). Fix the exact full test commands for the run, and save the full test list. Run each command once on
the unchanged code, and save the outputs: they are the "before" of every later same check. If any fails before the
run has changed anything, record those failures as known failures, tell the user in the next progress report, and
go on. Known failures become findings for step 8. The run can end "done" only if they are fixed by step 14. In
situation (A), with no test command yet, the script records "none: 0 items".
