// A child process for the tests of writers running at the same time (see atOnce):
//   whole <file> <writer> <times>    writes the file whole, again and again, with this writer's own text
import { writeWhole } from "../../run/state.ts";

const [what, ...args] = process.argv.slice(2);

if (what === "whole") {
  const [file, writer, times] = args;
  for (let i = 0; i < Number(times); i++) writeWhole(file, `writer ${writer}\n`.repeat(20000));
}
