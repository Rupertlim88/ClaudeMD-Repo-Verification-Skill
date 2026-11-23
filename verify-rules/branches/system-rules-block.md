# The personal System Rules block

- **When:** The System Rules block is missing, different, or met by a reader.
- **Check it runs:** the block is one skipped unit, copied word for word with its skills.
- **Detected by:** model text and structure check.

In the user's words, about this block: "definitely include that". It is the block headed "System Rules" in
conference-matching-api's global CLAUDE.md, with these parts (measured from that file): Developer Persona; My
stack, with the pstack triggers; Good code means five things; How every task runs; Where Superpowers and pstack
disagree; Always ask me first; New repositories; Writing; and the Pre-Commit Checklist.

- Every repo carries the block word for word, in its global CLAUDE.md.

- The reference copy is the user's personal CLAUDE.md when the session can read it; otherwise, the newest copy in
  the user's repos. The record says which copy was used, with its path and its commit or date.
- A missing or different block goes on the mechanical list: copying it word for word is mechanical.
- The block says that `/setup` also copies in the skills it needs (Superpowers and pstack). So the skill also
  checks that those skills are present in the repo, and puts copying any missing one on the mechanical list. They
  are copied from the same place as the reference copy of the block: the user's personal skills folder when the
  session can read it; otherwise the `.claude/` folder of the repo that holds the newest copy of the block. The
  record names the source and every skill copied. In the empty-repo simulation, that came to 17 items: 16
  Superpowers skills, pstack, and the Superpowers licence (measured). They sit under `.claude/` as copies from
  elsewhere, which the exempt list does not count (tools: exempt-list builder).
- The block's "Always ask me first" is followed as dangerous-action.md says: the budget question of step 0 is that
  asking for runs, downloads, paid calls and the outside services the run uses.
- Any clash between the block and the repo's own rules goes on the conceptual list, as any clash does
  (rule-conflict.md).
