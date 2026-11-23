# A checker passed a canary

- **When:** A checker passes a canary.
- **Check it runs:** the round is void and repeated with new canaries.
- **Detected by:** gate.

- **A checker that passes a canary** (Jev at or above the fail threshold, or a Claude checker with PASS) fails the
  round. The round is void and is repeated with new canaries. If the same checker passes a canary in two rounds of
  one step, it counts as a checker that cannot be used (checker-unusable.md). Void rounds count toward the cap on
  rounds (step-fails.md).

- A canary a checker passes is saved for the next calibration (tools: thresholds and calibration).
