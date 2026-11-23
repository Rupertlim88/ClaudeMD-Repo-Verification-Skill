// A child process for the tests of writers running at the same time (see atOnce):
//   whole <file> <writer> <times>    writes the file whole, again and again, with this writer's own text
//   count <run folder> <times>       adds 1 to the state's round, again and again
//   append <run folder> <writer> <times>   appends entries naming this writer and their number
//   ask <run folder> <times>         logs questions
import { logQuestion } from "../../run/question-log.ts";
import { append } from "../../run/record.ts";
import { openRun, updateState, writeWhole } from "../../run/state.ts";

const [what, ...args] = process.argv.slice(2);

if (what === "whole") {
  const [file, writer, times] = args;
  for (let i = 0; i < Number(times); i++) writeWhole(file, `writer ${writer}\n`.repeat(20000));
}

if (what === "count") {
  const [root, times] = args;
  for (let i = 0; i < Number(times); i++) updateState(openRun(root), (s) => { s.round += 1; });
}

if (what === "append") {
  const [root, writer, times] = args;
  for (let i = 0; i < Number(times); i++) append(openRun(root), "note", { writer, i });
}

if (what === "ask") {
  const [root, times] = args;
  const question = { kind: "b", topic: "budgets", text: "What may this run spend?", recommendation: null, items: [] } as const;
  for (let i = 0; i < Number(times); i++) logQuestion(openRun(root), question);
}
