# Very dangerous actions

- **When:** An action is on the very dangerous list, or the repo's rules say to ask first.
- **Check it runs:** stop and ask (kind b); the approval names the exact action.
- **Detected by:** action guard.

**Very dangerous actions.** The run stops and asks (kind b) before any of these:

1. Deleting anything that is not the run's own temporary files: data, files, branches, tags, git history, datasets,
   Kaggle kernels or outputs, cloud resources.
2. Rewriting history that others may have: force-pushing, or rebasing or resetting a pushed branch.
3. Putting work on the main branch, or on another person's branch, in a way the repo's own rules do not already
   allow.
4. Deploying to production, or switching a live system on or off.
5. Publishing or sending anything to people, or making anything public: emails, messages, posts, comments on pull
   requests or issues, changing a repo's or a file's visibility, sharing links.
6. Sending anything to an outside service that the secret stripper (tools: secret stripper) has not cleaned, or
   sending to any service other than those the budgets' go covers.
7. Spending beyond the budget, in money or GPU hours, or starting any paid service the budgets do not cover.
8. Changing settings or permissions: the session's permission settings, hooks, settings in the hosting service (CI
   and repository settings, not tracked workflow files changed on the run's branch), branch protection, the
   environment's network or secrets, account settings (audit fix 13).
9. Touching work that belongs to someone else: another person's or another session's uncommitted files, branches,
   pull requests or Kaggle kernels.
10. Writing to live databases, or to stored data that an app's users rely on.
11. Changing anything outside the repo and the run's temporary folder, such as installing tools globally or editing
    the user's personal Claude settings.

The approval names the exact action, and is logged word for word (tools: question log).

**A repo's own "ask first" rules.** Where a repo's own rules ask first before more actions (for example the "Always
ask me first" part of the personal System Rules block, system-rules-block.md), the CLAUDE.md wins. For runs,
downloads, paid calls and writes to the outside services the run uses, the budget question of step 0 is that
asking. It names each kind of spend and service it covers: Jev through its gateway, billed Claude use, the real
before-and-after run, and the reruns of step 13. The user's budgets are the go for them. Any other action the
repo's rules ask about first stops the run to ask, as a very dangerous action does.

How action 1 is read (inferred, so that the restructure can run): moving code between files, and removing a file on
the run's own branch as the step-10 map or a rule-scope ending (file-does-more.md) says, are not deletions in this
sense. The old file stays in git history and on the main branch, and each removal is listed in the end-of-run
report. Deleting anything git cannot bring back, or anything outside the run's branch, is action 1.

How action 3 is read (inferred, from the empty-repo simulation): in situation (A), the one empty start commit on
the main branch of a repo that has no commit at all is not action 3, because it changes no file and the worktree
needs a commit to start from (situation-a.md).
