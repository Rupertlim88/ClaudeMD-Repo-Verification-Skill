# Is a CLAUDE.md change mechanical or conceptual?

- **When:** Any CLAUDE.md change is planned.
- **Check it runs:** the effect script decides which list it goes on.
- **Detected by:** effect script.

Every CLAUDE.md change, mechanical ones included, is still shown to the user for approval, because of the rule
never to change a CLAUDE.md unless the user directly asks. Mechanical changes are shown as one line each (tools:
list builder).

- **Conceptual**: changes what the work does, how it should be done, how it is judged, or what its goals are. Any
  change to what a rule requires is conceptual, even when the code already does the new thing. That means: a clause
  added, removed, loosened or tightened; a number, condition or scope changed; any new rule, including one that
  only describes what existing code does, because writing it declares that behaviour wanted. These are also
  conceptual:
  - every new bold sentence (for an unnamed rule, for a part cut off a rule, for combined rules, or to end a name
    clash), because a bold sentence states a rule's idea. A cut or a combine that needs one goes on the conceptual
    list together with it;
  - a system rule the repo holds only in part, or in words that require something different, and every conflict
    between rules (step 1);
  - a new CLAUDE.md, or any other change to an allowed list (steps 3 and 5), apart from the one mechanical case
    below;
  - moving a rule to another repo (tools: exempt-list builder);
  - a rule classified general where the checkers disagree, and every whole-folder mark (general-or-specific.md);
  - indenting an item into a sub-rule, because it can take away a rule's need for a file;
  - every move that changes which files a rule covers;
  - merging copies of a rule that differ, and choosing which rule keeps a requirement two rules state
    (duplicates.md);
  - every rule-scope ending that adds or changes a rule, and every "ask the user" ending (file-does-more.md);
  - a code change that a part's callers can see (step 8, group B2);
  - a code fix of group B1 that changes a kept result or a number quoted in the docs (step 8);
  - putting off a gap whose fix is a whole new feature, needs an outside service, or would outlast the run (step
    8);
  - a clause that could be carried out in more than one way that would matter to the user (step 7);
  - a tolerance for any difference between two runs of the same code (step 6);
  - a failure of a hierarchy check in text the user wrote (tools: hierarchy checks);
  - changing what a version folder's list says one of its CLAUDE.md files covers;
  - examples from senior-thesis-research: which threshold a results table uses; whether models are fitted on
    training data only; whether a run keeps its trained weights; any trade-off between result quality and something
    else.

- **Mechanical CLAUDE.md changes are only these**, and each must also pass the effect script, unless it is marked
  "by the user's decision":
  - moving a rule's exact text, with its bold sentence unchanged, to another place or another CLAUDE.md, where its
    covered files stay the same. A specific rule moved down into the lowest-level CLAUDE.md that covers its one
    planned file keeps the same covered file;
  - writing or removing the file line of a two-way tie (the other half, the file's heading, is code, and is written
    or removed in the same commit), or a "needed" mark;
  - reorganising categories;
  - replacing a reference to another rule by its number with that rule's idea, in the words of its own bold
    sentence;
  - renumbering a moved rule;
  - removing identical copies of a rule and keeping one, where the kept copy covers exactly the files the copies
    covered together (duplicates.md);
  - writing the rule that lists the allowed CLAUDE.md files, where it lists exactly the CLAUDE.md files that
    already exist;
  - adding one of the exempt groups of tools: exempt-list builder to a repo's rule on what is not counted (by the
    user's decision);
  - copying the personal System Rules block word for word, or a skill it needs (system-rules-block.md; by the
    user's decision);
  - writing a missing system rule or a missing part of the structure from the model text, in every situation
    (system-rules.md; by the user's decision).
- Moving a rule to another CLAUDE.md is never the reorganising exception of the rule never to change a CLAUDE.md.
  It always goes on a list.
- **Mechanical work that is not a CLAUDE.md change** needs no question at all: code, tests, scripts, moving code
  files, names, the order of work, and the rule-scope endings that change no rule. The doer does it.
