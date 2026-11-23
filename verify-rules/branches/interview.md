# The interview (step 1A), and situation B

- **When:** Step 0 finds situation A or B, or a part of the repo that no CLAUDE.md describes.
- **Check it runs:** step 1A: one question at a time, every answer logged.
- **Detected by:** situation detector.

Ask the user conceptual questions, one at a time, in the user's own terms (kind b). They are about goals and what
each part must do, never about mechanical details (audit fix 3):

- what the project (or the part) is for, and what success looks like;
- its goals and its non-goals;
- its main parts;
- what each part must do;
- what folders they want, with the doer's proposed folder tree as the recommendation, so that "you decide" settles
  it.

In situation (B), show the existing code of a part as context, never as the answer: say what the code does now, and
ask what the part must do. Ask follow-up questions only where an answer leaves a part's job unclear. Log every
question and answer word for word (tools: question log).

Draft the user's specification of each part as rules, in the user's words, each with a bold sentence that states
its idea, and each classified general or specific without a label of the doer's (general-or-specific.md). Each
rule, each entry of the allowed-CLAUDE.md tree, and each new CLAUDE.md goes on the conceptual list, with the exact
text and the CLAUDE.md it would go in. In situation (B), a rule drafted from code alone, where the user's answer
leaves that part's job open, is a conceptual item that says so.

Write nothing.

**(B): the migration.** Step 0, then step 1A for every part of the repo that no CLAUDE.md describes. The user is
asked what each part is for, what it must do, and what folders they want, with the existing code shown as context,
never as the answer. Then steps 1 to 14, in order. A rule is drafted from code alone only where the user's answer
leaves that part's job open, and such a rule is a conceptual item that says so. (senior-thesis-research was in
situation (C) when these instructions were written: it had CLAUDE.md files and some system rules, but not the tie
rules; measured from its history.)

*Interviewing the user about each part that no CLAUDE.md describes, with the code shown as context and never as the
answer, is a reading of the user's words, waiting for confirmation on list C (audit fix 9).*
