# A clause no code test can decide

- **When:** A clause is not a requirement, or no single mutation is possible inside its lines.
- **Check it runs:** the check its kind needs; never counted as tested.
- **Detected by:** mutation runner.

- **How a clause is checked**: the doer designs a check for every clause, and every check runs within the budgets
  (budget.md); a check that a budget cannot pay for is an open item only when the user has refused to raise that
  budget (open-items.md). The doer may choose how: a code test, an AI-written test, or a Jev check on evidence
  built by script. Each clause has one kind, from the clause-kind question (step 7):
  - **requirement**: something the code must do, or must never do. Its check is a test in the repo's suite. A
    "never" or "only" clause can be tested by a search that fails when the forbidden thing appears. Such a search
    test is the only test that may read the repo's source files.
  - **reason**: says why the rule is as it is. Example from senior-thesis-research: "64 pixels is chosen to hold
    even the largest malaria cells". Its check tests that the reason holds where that can be measured (here, a test
    that the largest cell fits in 64 pixels). Otherwise it is a Jev check that the code follows the stated reason.
  - **outside-source**: says the code follows something outside the repo. Examples from senior-thesis-research:
    "the same way as in the earlier research", "the paper's settings". Its check quotes the source's page and
    figure (or table, or section) in the run record, beside the code lines that follow it, and asks Jev whether
    they match.
  - **user-only**: only the user can check it. Example from senior-thesis-research: GPU hours read on a site the
    doer cannot reach. It is asked of the user at the moment it is needed (asking-the-user.md, kind c). It counts
    as checked only when the user's answer is in the question log.

Every kind other than "requirement" needs Jev at its pass threshold and the Claude checker's pass on the
clause-kind question. So a hard clause cannot be relabelled to escape its test.

- **Not testable here**: a clause for which no single mutation inside its tied file is possible. Three causes are
  known: the clause's code lives in another file, or the clause is carried out twice, so one mutation changes
  nothing (both measured in the live test); or no fixed operator reaches it (LodeSTAR test, problem 6). A clause no
  operator reaches gets a check of another kind, which the doer designs as for a clause no code test can decide,
  above. The script lists it as "not testable here", with its cause. Code that lives elsewhere is checked in the
  file whose result it is (file-does-more.md). Code carried out twice is a duplicate (duplicates.md). None is ever
  counted as tested.
