// The question log: every message that asks the user something, written the moment it is asked, and the user's
// answer word for word, with its transcript message id. Kept as JSON lines, rewritten whole on every change.
import fs from "node:fs";
import { isOneOf, utcSeconds, writeWhole, type RunPaths } from "./state.ts";

// (a) the numbered lists; (b) a conceptual question outside them; (c) something only the user can do or tell.
export const MESSAGE_KINDS = ["a", "b", "c"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export interface LoggedQuestion {
  id: string; kind: MessageKind; topic: string; text: string; recommendation: string | null;
  askedAt: string; answer: string | null; answerMessageId: string | null; answeredAt: string | null;
  idNote: string | null; report: string | null;
}

export function questions(p: RunPaths): LoggedQuestion[] {
  return fs.readFileSync(p.questions, "utf8").split("\n").filter((line) => line !== "").map((line) => JSON.parse(line));
}

function save(p: RunPaths, all: LoggedQuestion[]): void {
  writeWhole(p.questions, all.map((q) => JSON.stringify(q) + "\n").join(""));
}

export function logQuestion(p: RunPaths, q: { kind: MessageKind; topic: string; text: string; recommendation: string | null },
  now = new Date()): LoggedQuestion {
  if (!isOneOf(MESSAGE_KINDS, q.kind)) throw new Error(`a message to the user must be of kind a, b or c, not "${q.kind}"`);
  const all = questions(p);
  const logged: LoggedQuestion = {
    id: `q${all.length + 1}`, ...q, askedAt: utcSeconds(now),
    answer: null, answerMessageId: null, answeredAt: null, idNote: null, report: null,
  };
  save(p, [...all, logged]);
  return logged;
}

// Records the user's answer exactly as typed. A question is answered once; a later answer is a new question.
export function recordAnswer(p: RunPaths, id: string, answer: string, messageId: string | null, at: string): LoggedQuestion {
  const all = questions(p);
  const q = all.find((x) => x.id === id);
  if (q === undefined) throw new Error(`there is no question ${id} in the log`);
  if (q.answer !== null) throw new Error(`question ${id} is already answered`);
  q.answer = answer;
  q.answerMessageId = messageId;
  q.answeredAt = at;
  q.idNote = messageId === null ? "the message id could not be read" : null;
  save(p, all);
  return q;
}
