# The run's own long-job duties

- **When:** The run, a step or a long job starts, waits, stops, resumes or ends.
- **Check it runs:** live progress; saving as it goes; the phone push.
- **Detected by:** status writer.

A run of the skill is itself a long job, so it does what system rule 24 asks of long jobs, and what the repo's own
long-job rules ask:

- it shows live progress (tools: status writer);
- it saves as it goes, and a rerun resumes rather than restarts (tools: run folder and state; resume.md);
- it sends a push notification to the user's phone when the run ends ("done" or "incomplete"), when it stops at a
  step, when it waits on the user, when it resumes after a usage limit, and when any long background job it started
  ends or fails. The push says what happened and where to look. It never holds a secret. If no push tool is
  available, or Remote Control is not connected so the push cannot reach the phone, the doer records that and says
  so in the chat.

The push events above stand as decided: the proposal's question Q6 was technical, so it is settled this way, and
only Q1 to Q4 wait for the user (audit fix 10).
