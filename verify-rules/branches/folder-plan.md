# Planning the folders (step 3)

- **When:** Step 3 plans the folders.
- **Check it runs:** one folder per unit of work; everything wired to a moved path.
- **Detected by:** item lister.

From the rules and the code, and in situations (A) and (B) from the interview's drafted rules and its folders
answer, list the units of work (tools: rule reader). Never one folder per rule.

Propose the folders. Data gets folders of its own, each tied as a whole, both ways, to one specific rule.

Each new CLAUDE.md, and each other change to an allowed list, gets a conceptual item, because it changes what the
allowed-list rule requires. The item shows the exact list entry and the new file's exact opening. It is proposed to
the CLAUDE.md that keeps that list: the global one, or a version folder's own. Example: in conference-matching-api,
changes inside the engine belong in the engine's own list (measured by the dry run). In situation (A), the item
quotes the interview's folders answer as its reason.

Plan the code moves; move no code now, because the golden outputs (step 6) must be captured first. For each folder
that will move, list by search everything wired to its path: workspace lists, build and task-runner configs,
container files, deploy configs, CI change filters, import-lint configs, and programs with hard-coded CLAUDE.md
paths (from step 0). Step 10 updates them in the same commit as the move.
