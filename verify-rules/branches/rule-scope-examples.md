# Worked examples of rule-scope endings

- **When:** An ending is chosen and a worked example would help.
- **Check it runs:** none: examples only.
- **Detected by:** the doer, from file-does-more.md.

**From this session's real run on senior-thesis-research** (the rule texts are quoted from the CLAUDE.md files;
measured):

- **The split took ending (a): a new rule for a result of its own, with its own file.** One rule, "How every
  dataset is split.", sits in the split folder's CLAUDE.md, tied both ways to `split.py`. But each dataset needed
  its own code to describe its images for the split: the kinds of shape in each shapes picture, and the cell types
  on each malaria slide. That description is a result of its own for each dataset (question 8 yes; inferred). So
  each dataset gained its own rule: "The shapes pictures are split by the shared split." and "The malaria slides
  are split by the shared split.", each tied both ways to its own `train_test.py`. The two rule texts were written
  first, marked "needed", in the commit titled "Rules (user-approved): …; per-dataset split rules; …" (`b1b35aa`).
  The code and its two-way ties came after, in the commit titled "Datasets: fixes from the audit, and each
  dataset's split in its own file" (`5a4299a`) (both measured from the history).
- **Kaggle took ending (a), then (b).** Kaggle runs were carried out by two files: `kaggle.py` sends runs and
  fetches results, and `kaggle_run.py` runs on Kaggle. A run on Kaggle is a result of its own, so it got its own
  rule, and each file got one rule. The commit titled "Rules (user-approved): …; Kaggle runs keep the weights; …"
  (`b1b35aa`) then wrote both texts, worded so each states what its one file does: "Runs are sent to Kaggle and
  their results fetched back, on one account." and "A Kaggle run unpacks the code, installs the listed libraries,
  runs one experiment and keeps only its results and its trained weights." `kaggle_run.py`'s heading was changed to
  the new sentence in the next commit (`f8b674d`). The first rule was still marked "needed" when this example was
  written (measured), so under the "if and only if" it failed rule → file until `kaggle.py` passed its audit and
  was tied.
- **Keep took ending (b): the rule was broadened, with the user's approval.** FSCN's keep rule read "FSCN removes
  the dots it rejects." The file `keep.py` owns the whole decision of which dots are kept, including rejecting a
  dot with no outline under it (questions 4 and 5 yes; inferred). The rule was reworded to "FSCN decides which dots
  are kept.", with "a dot with no outline under it is rejected" added, in the same user-approved commit
  (`b1b35aa`), and marked "needed" until `keep.py` was tied both ways again after the audit (measured from the
  history).
- **A cut found by the rule-scope study.** `evaluate.py`, tied both ways to "How hits are counted.", also makes the
  counts the optimal threshold needs (measured by the study, at its lines 89 to 95). Question 1 is yes (the
  threshold rule needs counts on all the test images), and question 2 is no (a different result). So the counting
  moves into `optimal_threshold.py`, called from the same per-image pass.
- **A cut found by the live test.** `examples.py`'s `per_image` is also used by `evaluate.py`, and it does the
  pipeline rule's "saves as it goes" job. The per-piece question 1 confirmed this at 0.84 (measured). So the piece
  moves to the pipeline rule's file.

The approval in each case was given in the session's chat; the commits show the rule text was written before the
code that carries it out (measured from the history).

**From conference-matching-api** (measured by the rule-scope study):

- **Combine.** Rule 74 reads "Making an abstract's task, steps 2 and 4: is there a reasoning task, and choose the
  templates." `choose.py` makes one LLM call per abstract that returns both answers. Question 1 is yes (step 2's
  sentence), and question 2 is yes (the same answer).
- **Cut, by moving to the rule that asks for it.** Rule 72 asks Jev "that each finding of the review in step 7
  holds, and that its verdict follows from its findings". That code sat in `review.py`, which carries rule 73. A
  later change moved it into `checks.py`, and `review.py` now calls it there. Question 2 is no: the review's
  verdict is a different result.
- **Cut, to a shared owner.** Four steps each kept their own merge after a second turn. One shared helper
  (`merge_doubted`) is now the one copy, under the rule that the helpers every step uses are written once. Question
  6 is yes.
