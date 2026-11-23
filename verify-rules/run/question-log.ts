// The question log: every message that asks the user something, the moment it is asked, with the items it covers;
// the id of the transcript message that sent it, which the gate reads; the user's answer word for word, with its
// message id; and the chat report that followed. Each change is chained into the record as the question's new
// version, and the log file is written whole from the record, so a log edited by hand is refused.
import fs from "node:fs";
import { append, canonicalJson, entries } from "./record.ts";
import { isOneOf, utcSeconds, withLock, writeWhole, type RunPaths } from "./state.ts";

// (a) the numbered lists; (b) a conceptual question outside them; (c) something only the user can do or tell.
export const MESSAGE_KINDS = ["a", "b", "c"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export interface LoggedQuestion {
  id: string; kind: MessageKind; topic: string; text: string; recommendation: string | null; items: string[];
  askedAt: string; askedMessageId: string | null;
  answer: string | null; answerMessageId: string | null; answeredAt: string | null; idNote: string | null;
  report: string | null;
}

// Every logged question as the record last holds it. Each line of the log file must be a version of a question the
// record holds: one that is not was edited, and is refused; an older version is what a stop between the two writes
// leaves, and is read past.
export function questions(p: RunPaths): LoggedQuestion[] {
  const versions = entries(p).filter((e) => e.kind === "question").map((e) => e.question as LoggedQuestion);
  const recorded = new Set(versions.map((q) => canonicalJson(q)));
  for (const [i, line] of fs.readFileSync(p.questions, "utf8").split("\n").filter((l) => l !== "").entries()) {
    const version = canonicalLine(line);
    if (version === null || !recorded.has(version)) throw new Error(`the question log does not match the record: line ${i + 1}`);
  }
  return [...new Map(versions.map((q) => [q.id, q])).values()];
}

function canonicalLine(line: string): string | null {
  try {
    return canonicalJson(JSON.parse(line));
  } catch {
    return null;
  }
}

// Chains the question's new version into the record, then writes the whole log from the record.
function save(p: RunPaths, q: LoggedQuestion, now: Date): LoggedQuestion {
  append(p, "question", { question: q }, now);
  writeWhole(p.questions, questions(p).map((x) => JSON.stringify(x) + "\n").join(""));
  return q;
}

export function logQuestion(p: RunPaths,
  q: { kind: MessageKind; topic: string; text: string; recommendation: string | null; items: readonly string[] },
  now = new Date()): LoggedQuestion {
  if (!isOneOf(MESSAGE_KINDS, q.kind)) throw new Error(`a message to the user must be of kind a, b or c, not "${q.kind}"`);
  return withLock(p, () => save(p, {
    id: `q${questions(p).length + 1}`, ...q, items: [...q.items], askedAt: utcSeconds(now), askedMessageId: null,
    answer: null, answerMessageId: null, answeredAt: null, idNote: null, report: null,
  }, now));
}

// What each one-time change of a question sets, and how its refusal names it.
const ONCE = { askedMessageId: "message id", answer: "answer", report: "report" } as const;

// Sets a field of a logged question that is set only once; a later answer is a new question.
function setOnce(p: RunPaths, id: string, field: keyof typeof ONCE, change: Partial<LoggedQuestion>): LoggedQuestion {
  return withLock(p, () => {
    const q = questions(p).find((x) => x.id === id);
    if (q === undefined) throw new Error(`there is no question ${id} in the log`);
    if (q[field] !== null) throw new Error(`question ${id} already has its ${ONCE[field]}`);
    return save(p, { ...q, ...change }, new Date());
  });
}

// The id of the transcript message the question was sent in, as the gate reads it.
export function setAskedMessageId(p: RunPaths, id: string, messageId: string): LoggedQuestion {
  return setOnce(p, id, "askedMessageId", { askedMessageId: messageId });
}

// The user's answer exactly as typed, with its message id and the time it was sent.
export function recordAnswer(p: RunPaths, id: string, answer: string, messageId: string | null, at: Date): LoggedQuestion {
  return setOnce(p, id, "answer", { answer, answerMessageId: messageId, answeredAt: utcSeconds(at),
    idNote: messageId === null ? "the message id could not be read" : null });
}

// The chat report that followed the answer.
export function recordReport(p: RunPaths, id: string, report: string): LoggedQuestion {
  return setOnce(p, id, "report", { report });
}
