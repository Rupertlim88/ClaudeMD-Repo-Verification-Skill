# Kept results (step 13)

- **When:** A kept result is not current or is untraced; a file quotes a result.
- **Check it runs:** the freshness script; reruns within the budgets.
- **Detected by:** freshness script.

- **Kept results**: outputs the repo keeps and quotes: results tables, figures, generated files, saved model
  answers, and data stored or deployed outside the repo.

List the kept results: generated files, rebuilt with the repo's own commands; outputs of paid or long runs;
anything stored or deployed outside the repo.

Regenerate every result that is not current, and every untraced result the user chose to rerun. The budgets count
as the user's go for each run inside them (budget.md). Before each run, check accounts and free capacity as the
repo's rules say, and ask the user, at that moment, for anything only they can check. Follow the repo's rules on
long jobs (progress, saving, resuming, notifying). A rerun that would go over a budget stops and asks the user to
raise it. Deploy only when the repo's rules and the user say so.

If the user does not raise a budget that a needed rerun would go over, that result is an open item with the code
`budget-refused`, the step cannot pass, and the run asks whether to continue (step-fails.md).

Find everything that quotes the results, by script: search for the result file names and values, and list binary
files (slides, images) that may hold them. Update every text file. A binary file the doer cannot edit is a request
for the user (kind c), made once, with exactly what to change. Example: in senior-thesis-research, the poster is a
binary slide file (measured by the adversarial review).
