# /verify-rules

A Claude Code skill that brings a repo's CLAUDE.md rule system to its target state, one checked step at a time, and
proves it. The skill is the `verify-rules/` folder; `docs/tools.md` specifies its tools.

## Install

**(a) In a repo, in any session (a cloud session included).** From the repo's root:

```
mkdir -p .claude/skills
cp -R <this repo>/verify-rules .claude/skills/verify-rules
(cd .claude/skills/verify-rules && npm install)
```

The skill's own `.gitignore` keeps its `node_modules/` out of the repo.

**(b) On your Mac, for every project.** Clone this repo anywhere, then copy or link the skill into your skills folder
and install it there:

```
git clone https://github.com/Rupertlim88/ClaudeMD-Repo-Verification-Skill.git
mkdir -p ~/.claude/skills
ln -s "$PWD/ClaudeMD-Repo-Verification-Skill/verify-rules" ~/.claude/skills/verify-rules
(cd ~/.claude/skills/verify-rules && npm install)
```

**(c) What it needs.** Node 22.18 or later. For Jev, an `AI_GATEWAY_API_KEY` from Vercel's AI Gateway; in a cloud
session whose network proxy adds the key, set `AI_GATEWAY_API_KEY=proxy-injected NODE_USE_ENV_PROXY=1
NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` instead. For a Python repo, its interpreter with pytest: the repo's
`.venv` is used when it exists (for senior-thesis-research, its own `.venv`), or give `--python <path>`.

## Use

In Claude Code, type `/verify-rules` (only you can start it; Claude never starts it on its own). Claude then reads
`SKILL.md` and runs the workflow with one command-line tool, `node <skill>/bin/verify.ts <command>`: `start` makes
the run folder outside the repo and finds the situation; `rules`, `ties`, `clauses` and `items` read the CLAUDE.md
files, check the two-way ties, cut each rule into clauses and list the items of the four-part tie check; `jev` asks
Jev each fixed question; `checker-prompt` and `checker-answer` run the Claude checker; `status` shows where the run
is. SKILL.md's "How to run this version" says which command each step uses, and what is still done by hand.

## Develop

In `verify-rules/`: `npm test` and `npm run typecheck`.
