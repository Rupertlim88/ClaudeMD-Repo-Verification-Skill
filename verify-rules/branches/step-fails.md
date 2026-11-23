# A step fails

- **When:** A step's round fails.
- **Check it runs:** fix and check again; 3 rounds in all; then ask whether to continue.
- **Detected by:** gate.

- On a FAIL, the findings go back to the doer. The doer fixes them, never by weakening a check or a test. The gate
  rebuilds the pack. The checks run again, with fresh Jev requests and fresh Claude checkers.
- If the checkers disagree on any item, that counts as a FAIL. An unsure Jev answer is not a disagreement: it goes
  to the second Claude checker (jev-unsure.md).

- After 3 rounds that still fail, the run stops at that round and asks the user whether to continue (kind b), with
  the script-written message of asking-the-user.md. Rounds made void by a canary count too: the run stops at 3
  rounds in all per step (audit fix 12).

- While that question waits, only the failed step's own items that do not depend on the failure go on.
- If the cause is conceptual, the doer says so when it asks. Before step 9, the item goes on the conceptual list.
  After step 9, it goes on the follow-up lists (late-finding.md).
- If the user says to continue, the step is marked "failed, continued by user" in the record, and its open items
  carry the reason code `continued-by-user`. The final check's correct check for that step then fails, and the run
  can never end "done".
- A step whose evidence lists a test command as "not run" cannot pass. It is handled as a failed step, as above.
- A FAIL must name the id of the item it breaks (a "done when" item, or any item of the step's three checks) and
  show the evidence. The gate's parser treats any other remark as a note (tools: Claude-checker launcher). In the
  simulation the Claude checker added new demands every round, and some steps never passed (measured); this rule
  keeps each round to the step's own items, without letting the doer decide what counts as a note.
