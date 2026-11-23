# Mapping rules and files (step 5)

- **When:** Step 5 maps rules and files.
- **Check it runs:** the map, both ways, from the script's lists.
- **Detected by:** item lister.

Take every counted file from the two-way tie check's output (not only code files: images, PDFs and JSON count too,
unless exempt), and every planned specific rule from the step-4 table. Pair them both ways. The pairing is the
doer's proposal; the two lists it pairs are built by script.

Cut each file into pieces with the piece cutter (tools: piece cutter), private pieces included, and list for each
piece what it writes and who calls it, so that a file doing two rules' jobs shows up.

For each planned file, list its public names. For each old public name, write its new place, so the golden
comparison can follow every output (step 6). Mark as fixed every name that a live system, a contract, a build or CI
depends on (for example migration file names and database function signatures). Fixed names never change in step
10.

Plan existing two-way ties like the rest. They are verified again, both ways, in steps 7 and 12, never trusted.
