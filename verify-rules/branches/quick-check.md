# A quick check in situation D (not in use)

- **When:** Step 0 finds situation D and a quick check is asked for.
- **Check it runs:** none until the user approves C64: every run is a full run.
- **Detected by:** situation detector.

**Not in use until the user approves C64 (audit fix 1).** Until then, every run is a full run, and the paragraphs
below do not apply. They are kept so that the proposal is ready if the user approves it.

(open: quick check) **A quick check in situation (D).** The proposal: for a repo already set up, the full two-way
tie script always runs on the whole repo, but Jev and the Claude checkers go only over the rules and files changed
since the last run that fully passed, unless the user asks for a full run. The last fully passed run is found by
script, from the checkpoint trailers in git (tools: record). "Changed" is computed by script from `git diff <that
run's last commit> HEAD`:

- every rule whose text changed, and every file whose content changed;
- every rule tied to, or covering, a changed file, and every file tied to, or covered by, a changed rule;
- every file that imports or calls a changed file.

The duplicate finder (duplicates.md) still runs on the whole repo; Jev and the Claude checkers judge only the pairs
that hold a changed item. The record lists what the quick check left out, and the end-of-run report's first line
says "quick check". Situations (A), (B) and (C) always get a full run.

(open: quick check) In situation (D), also record whether this run is a quick check, and the commit of the last
fully passed run that it starts from.

A quick check adds "Quick check."

If the user approves it, the quick check works per scope: on the folder the run was started for, not the whole repo
(LodeSTAR test, top changes).
