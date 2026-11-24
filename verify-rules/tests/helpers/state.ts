// A run state with every field filled, for tests to start from.
import type { RunState } from "../../run/state.ts";

export function sampleState(): RunState {
  return {
    repo: "/repos/r", scope: "models/lodestar", startCommit: "a".repeat(40), baseline: "b".repeat(40),
    baselineHow: "merge-base with main", branch: "verify-rules/run-1", doerModel: "claude-opus-5-5",
    step: "7", round: 2, stepStartCommit: "c".repeat(40), worktree: "/runs/r-1/worktree", runBranch: "verify-rules/run-1",
    items: { "7.clause:R1#c1": { status: "passed", answers: [{ check: "correct", by: "jev", verdict: "PASS", entry: "d".repeat(64) }] } },
    testCommands: [{ name: "all", command: "python -m pytest", exit: 0, outputFile: "evidence/all.txt" }],
    knownFailures: ["tests/test_x.py::test_slow"],
    budgets: { moneyUsd: 5, claudeRuns: 20, computeHours: null, questionId: "q1" },
    spend: { jevCalls: 3, jevInputTokens: 4000, jevOutputTokens: 60, jevUsd: 0.0042, claudeRuns: 1, claudeSeconds: 90,
      claudeListUsd: 1.2 },
    open: [{ item: "8.finding:f2", code: "doer-deferred", evidence: "", needsPutOffQuestion: true }],
    declined: [{ item: "C3", line: "C3. Keep the mark", userWords: "no to C3", step: "9", date: "2026-11-23" }],
    agents: [{ id: "a1", folder: "models/lodestar", started: "2026-11-23T06:00:00Z", reported: false, note: "agents/a1.md" }],
    mistakes: { "hand-typed fact": 1 },
    situation: { guess: "C", counts: { claudeMd: 3 } },
    steps: { "0": { result: "passed", rounds: 1 } },
  };
}
