# Something in the final check fails

- **When:** A final-check item fails, the whole-process question is not passed, or the shortcut audit finds
  something.
- **Check it runs:** the item goes back to the step that owns it.
- **Detected by:** gate.

A yes never passes an item that failed. An answer that is not a pass sends the same summary to both Claude
checkers, and the final check passes only if each of them passes it, or names the step at fault, which then goes
back to that step (step 14).

Every failed item goes back to the step that owns it. A failure the doer can fix is fixed there, and that step's
checks run again; a conceptual one goes on the follow-up lists (late-finding.md). Then the final check runs again.

Each finding goes back to the step that owns it; then that step's checks and the final check run again.

Step 14 passes only with no open item. When everything else holds and open items remain, the step is recorded as
"checked, open items remain", and the run ends "incomplete: <list>".
