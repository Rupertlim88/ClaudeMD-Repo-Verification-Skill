# A checker cannot be used

- **When:** A checker cannot be used.
- **Check it runs:** 3 retries; then stop and ask; never a substitute.
- **Detected by:** gate.

A checker cannot be used when:

- a Jev request fails, the key is missing, or the gateway refuses or rate-limits;
- a Jev answer was served by a provider other than `typesafe-ai` (tools: Jev client);
- the Agent tool or `claude -p` rejects a Claude checker's model;
- a Claude checker reports a model id equal to the doer's, or different from the one asked for (tools: gate);
- a checker passes canaries in two rounds of one step (tools: canary builder).

The gate retries up to 3 times, waiting between tries. If it still fails, the step does not pass. The run stops,
tells the user exactly what failed, and asks whether to continue (kind b), or asks for what would fix it (kind c,
for example a missing key). The doer never substitutes another model for either checker, never counts a missing
answer as a pass, and never goes on with one checker. If the user says to continue, the step is marked "not
checked, continued by user", its items are open with the reason code `continued-by-user`, and the run can never end
"done".
