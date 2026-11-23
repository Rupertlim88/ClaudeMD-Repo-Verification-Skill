# Version folders

- **When:** The repo's rules offer versions side by side.
- **Check it runs:** each version's own list and rules apply.
- **Detected by:** rule reader.

- **Version folder**: one version among several that the repo's rules offer side by side. Examples: matching
  engines, UIs, or app versions made for different customers. Its own CLAUDE.md may keep the list of CLAUDE.md
  files inside it. The rule to keep only the latest version does not apply between versions. Code copied between
  versions may be there by design.

Versions offered side by side may hold copies of the same code by design.

Inside a version folder, the version's own rules on what its CLAUDE.md files hold, and in what order, apply.
Example: in conference-matching-api's engine, the CLAUDE.md files are a guidebook in the order the work is done
(measured by the dry run).
