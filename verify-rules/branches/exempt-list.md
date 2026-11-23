# A file the exempt list refuses, and repo rules on exemption

- **When:** The exempt-list builder refuses a file, or a repo rule lists the exempt groups differently.
- **Check it runs:** the file is counted; the repo rule is followed or an item proposed.
- **Detected by:** exempt-list builder.

A file the exempt-list builder refuses is counted, like any other code: it needs its two-way tie
(untied-file-or-rule.md), and it is never made exempt by its name or by a new pattern.

- **A repo rule that does not list a group yet**: when a repo's own rule on what is not counted does not yet list
  one of the groups above, the skill proposes the addition on the mechanical list, because the user decided this is
  mechanical. The same holds for a file that another rule makes and that the repo's rule leaves out. Example:
  conference-matching-api's generated dependency list is listed as "not yet tied", and it can never be tied both
  ways, because its rule sits in the global CLAUDE.md (measured by the dry run and the system-rules study).
- **A repo rule that exempts more**: where a repo's own rule exempts a group this list does not name, the CLAUDE.md
  wins and the group stays exempt. The exempt list records the repo's rule as its reason, and the import and call
  test still applies to it.
