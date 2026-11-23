# Capturing the golden outputs

- **When:** Step 6 starts, or two golden captures differ.
- **Check it runs:** capture from the baseline; every normalisation proved.
- **Detected by:** golden harness.

Find any existing golden-output or replay mechanism, any trace from requirements to tests, and any dependency
check. Steps 6, 7 and 13 use them instead of building second ones.

List every kind of output the repo has (words.md): return values, files, database state, HTTP responses, generated
and built files, logs and other side effects, results tables and figures. For each, write how it is captured, or
why it is not.

Reuse the repo's own golden or replay mechanism where one exists (from step 0). Add only what it misses.

Capture on fixed inputs, from the baseline commit. Replay saved model answers where the repo has them, and use
existing weights or indexes. Follow the repo's rules on where heavy jobs run. Never train on the local machine
where the repo forbids it.

Capture into a fresh output folder in the run folder. It holds only copies of the existing weights and other
inputs, taken from the working tree whether git-ignored or not. Every resume cache starts empty. Record which
outputs were computed and which were read back from saved files. Read-back outputs are not golden.

Key every output by name, using the map's old public names. The harness reaches the code through one import
adapter, the only part of it that may change later (step 10); save a copy of the whole harness now. Choose the
inputs per rule, from its text, so that every rule's conditions and steps are exercised. Write which inputs
exercise which rule. Then measure the line coverage of every planned file under the golden inputs (tools: coverage
tables): every line no input runs is an item, closed by an input that runs it, or by a recorded reason that checker
1 judges.

A tiny full run (training included, where the repo has training) lives in the repo's test suite as a test, and runs
twice. It is a test, so it needs no budget beyond the test run.

The real end-to-end run on real data, with the weights the repo already has (nothing new is trained), is the
"before" half of the real before-and-after golden run. It runs only when step 8's lists hold a code change: a fix
of group A, B1 or B2, a move, or a deletion. Since steps 7 to 9 change no code, it then runs on the baseline commit
just before step 10 (step 10). When the run changes no code, both halves are skipped, and the record says so, with
step 8's counts as evidence. The budgets count as the user's go for it (budget.md). Its "after" half runs in step
14. If the repo keeps no trained weights or other saved inputs, the real run uses whatever the repo keeps; if it
keeps nothing, the real run is skipped, and the record says so.

Values that are random or time-based by design (tokens, ids, nonces, timestamps, "built at" lines) get a stated
normalisation, or a property check instead of an equality check. Capture everything twice. A normalisation may
touch only values that differed between the two captures, and the script proves, for each one, that it replaces
something that differed. For any difference left after normalisation, find its source. Nondeterminism in the code
is a finding. A tolerance for any difference is the user's decision: a conceptual item.

Write the comparison with the harness. It compares values, not shapes. It reports a deleted output, a new output
and a changed value each as a difference, with counts ("5 of 6 compared"). Prove it fails on a changed output: make
one deliberate change per kind of output, one deletion and one addition.
