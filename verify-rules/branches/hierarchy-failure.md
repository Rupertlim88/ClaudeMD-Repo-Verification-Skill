# A hierarchy check fails in the user's text

- **When:** A hierarchy check fails in text the user wrote.
- **Check it runs:** a conceptual item; never a fix by the doer.
- **Detected by:** hierarchy checks.

A failure in text the user wrote is put on the conceptual list with a proposed change, before step 9, or on the
follow-up lists, after it (late-finding.md). The doer never fixes it. Example: conference-matching-api's global
CLAUDE.md names files such as `.env` and `.gitignore` (measured by the dry run); those names sit inside the System
Rules block, so check 6 now skips them (measured by the empty-repo simulation).
