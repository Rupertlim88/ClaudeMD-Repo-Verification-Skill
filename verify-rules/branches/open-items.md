# Open items and declined items

- **When:** An item cannot be closed in its step, or the user declines an item.
- **Check it runs:** a reason code the script accepts; the put-off question.
- **Detected by:** open items.

**A declined item is not an open item.** When the user turns an item down, that is the user's decision. It is
recorded as declined, with the user's words, and it is not proposed again unless the user asks for it (tools:
end-of-run report). If a declined item leaves part of the target state unmet (for example, a file stays without a
tie because the user declined the new rule for it), the doer offers, once, on the follow-up lists
(late-finding.md), the other ways to meet the target state (for example, removing that code). What the user
declines again is recorded as declined. The end-of-run report's first line counts the declined items, and the
report lists each one with the part of the target state it leaves unmet.

**Every item the doer put off is checked by both checkers.** Each `doer-deferred` item gets Jev's question and the
Claude checker's, in positive form: "Can this item be closed only with a new decision from the user, or with
something outside this run?" A yes means it was rightly put off. A no from either checker means it could have been
closed now: the item goes back to its step, and that step fails until it is closed.

**A declined item is not an open item.** It is recorded on its own list with the code `user-declined` and the
user's words. The item lister of every later step, and of every later run, leaves it out by matching its text and
its target, and lists each item it left out. It is proposed again only if the user asks for it. The end-of-run
report names each declined item, with the part of the target state it leaves unmet (SKILL.md: the target state). So
that the list outlives the temporary run folder, each declined item is also written, as a one-line trailer
(`Verify-Rules-Declined: <the item's one line>`), into the message of the checkpoint commit of the step where it
was declined; a later run's item lister reads these trailers from the git history. Where the history no longer
holds them (for example after a merge that dropped the commit messages), the item may be shown once more, marked
with the date the user declined it (inferred).
