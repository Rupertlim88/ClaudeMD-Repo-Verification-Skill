# References to a rule by its number

- **When:** The number search finds a hit.
- **Check it runs:** a verdict per hit; every reference replaced by its idea.
- **Detected by:** number search.

Run the number search on every CLAUDE.md. Judge each hit on its own:

- a reference to another rule by its number gets a mechanical item: replace it with that rule's idea, in the words
  of its bold sentence. If the rule it points to does not exist, it gets a conceptual item instead, because the
  reference points at nothing;
- a rule citing its own numbered steps together with its own idea, or an ID from an outside standard (such as a
  NIST or OWASP number), is allowed; list it;
- the same reference inside every copied opening gets one mechanical item that covers the global CLAUDE.md and
  every copy, so the copies stay word for word the same.

List every program that reads CLAUDE.md files, and every code file and doc that cites a rule by number. Examples
from conference-matching-api (measured by the dry run): a security-checklist script reads five named CLAUDE.md
files and identifies some rules by file and number; 238 files outside the CLAUDE.md files cite rules by number.
Step 9 keeps them working.

Run every program that reads CLAUDE.md files (from step 0) before and after. Each must find the same set of
requirements, with the same ids where it has ids, apart from the approved changes. If a program finds rules by file
and number, update it in the same commit, test-first.

Update every rule-number citation in code and docs (from step 0) to the rule's idea. A rule's own numbered steps
are cited together with the rule's idea. Citations that cannot be updated are listed.
