# The decision chain: eight fixed questions per piece

- **When:** An extra piece needs its ending.
- **Check it runs:** the eight fixed questions, one at a time.
- **Detected by:** function-to-clause table builder.

Each question is a fixed Jev template, in positive form, asked once per piece. Here, yes and no each lead
somewhere; neither answer is wrong. The chain ends in one of three endings: **(a) cut**, **(b) broaden or
combine**, or **(c) ask the user**.

| # | Question to Jev | Yes | No |
|---|---|---|---|
| 1 | "Does this sentence of another rule require what this piece of code does?" (one request per candidate sentence) | go to 2 | go to 3 |
| 2 | "Is that sentence about the same result as this file's rule: the same answer, the same record or the same kept thing?" | **(b) combine**: propose one rule, with a new bold sentence for the result and every sentence of both kept | **(a) cut**: move the piece into that rule's file; this file calls it there, in the same pass if needed |
| 3 | "Does this piece refuse, drop or change something that a sentence of some rule allows or requires?" | **(a) cut**: delete it, test-first; the rule wins | go to 4 |
| 4 | "Is this piece made in the same call or pass as this rule's result, and kept in the same answer or record?" (a script can often answer this exactly; then Jev confirms) | go to 5 | go to 6 |
| 5 | "Without this piece, would the result named by this rule's bold sentence be wrong or incomplete?" | **(b) broaden**: propose one sentence for this rule that says what the piece does | go to 6 |
| 6 | "Do files tied to two or more different rules use this piece, or keep copies of it?" | **(a) cut**: move it to one shared owner under a "written once" rule; propose that rule if none exists | go to 7 |
| 7 | "Is it true that nothing calls this piece and nothing reads what it writes?" | **(a) cut**: delete it (ask first where deleting needs the user's go) | go to 8 |
| 8 | "Does this piece make a result of its own, one that can be named in one sentence and checked without reading this rule?" | **(a) cut**: give it its own file, and propose a new rule | **(c) ask the user**: show the piece, the rule and the two closest outcomes |

- **Thresholds.** Question 1 uses 0.75 and 0.45 (measured in the live test, 8 of 8 separated; provisional).
  Questions 2 to 8 use 0.8 and 0.5 until they are calibrated (tools: thresholds and calibration).
- **An unsure answer goes to both Claude checkers**, neither shown Jev's number (tools: Claude-checker launcher).
  If they agree on yes or no, the chain follows that answer. If they disagree, the chain ends in (c). The
  conference engine notes that Jev's unsure answers were wrong about 3 times in 4 on its pilots (measured by the
  rule-scope study).
- Questions 1 and 2 come first. Code is moved to the rule that states it even when it runs inside another step's
  pass.
- The Claude checker re-judges each ending (the checker map).
