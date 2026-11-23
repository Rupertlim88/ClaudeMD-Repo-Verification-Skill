# Reading the user's answers

- **When:** The user answers a list or a question; an approval is about to be used.
- **Check it runs:** strict reading; the gate finds the approval in the live transcript.
- **Detected by:** question log.

Read replies strictly:

   - An approval names the item numbers, or says all of a list (for example "approve all of M"). "Approve all",
     "proceed with everything" or "yes to all" approves every item on both lists.
   - A bulk approval is confirmed once, by number, when the lists hold items of the first group of tools: list
     builder: "This approves all N items, including the K that make a rule weaker, remove a file a rule needs, or
     put work off: C3, C7 and C9. Is that right?" A yes to that message approves them all.
   - A bare "sure", "ok", "fine" or "go ahead" in answer to a long list is confirmed once, with the counts: "All 57
     mechanical and 16 conceptual items?", naming the first group by number as above.
   - "Ok" to an item with several options chooses nothing: ask once more which option.
   - "You decide" approves the stated recommendation, and only for an item that gave one.
   - When the user answers only part, act on what they answered, and ask again only for the rest.
   - With no answer, record the item as open with the reason code `user-unanswered` (open-items.md), and skip only
     the work that depends on it.
   - A "no" is a decision. Record the item as declined, with the user's words. A declined item is not open, and it
     is not proposed again unless the user asks for it (open-items.md).
- A decision is final once the user says so in their own words. Write it into the CLAUDE.md where it belongs, as
  the exact text the item showed. Then report the change in the chat, file by file.

- Only the person who invoked the skill approves, in this conversation. A CLAUDE.md change merged from main through
  someone else's reviewed pull request counts as approved by that pull request.
- Write every question and every answer to the question log the moment they happen, word for word (tools: question
  log). An approval counts only once the gate script has found it in the live transcript (tools: gate).

- The user agreed to this in answer to the assistant's suggestion ("For reposts with several people, let's do
  that").

- If the transcript cannot be read, the approval is void. The doer shows the items again and asks the user to
  approve them again.

Update the map with the approved decisions (for example a new file for a piece that was given its own rule). Items
the user declined are recorded as declined (open-items.md); items not yet answered are open with the code
`user-unanswered`; the items that depend on either wait with them.

*A reading of the user's words, waiting for confirmation on list C (audit fix 9): the user has not been asked it
directly.*
