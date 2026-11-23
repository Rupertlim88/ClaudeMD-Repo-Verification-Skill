// The language interface: what the tools read from a file in its own language (its heading, pieces, references,
// writes and names), and the lookup of a file's language by its file type.
import path from "node:path";

export interface Piece {
  id: string; kind: "heading" | "import" | "function" | "class" | "method" | "statement" | "branch" | "block";
  name: string; start: number; end: number;
}

export interface Reference {
  kind: "import" | "dynamic import" | "module runner" | "exec" | "subprocess" | "import path"; target: string; line: number;
}

// pieces is null for a file its language cannot parse. writes and names are keyed by piece id: the piece's lines
// that write a file, and the names an import binds or the piece's lines use.
export interface FileFacts {
  parses: boolean; heading: string | null; pieces: Piece[] | null; references: Reference[];
  writes: Record<string, string[]>; names: Record<string, string[]>; definesTest: boolean; emptyPackage: boolean;
}

export interface Language {
  readonly name: string;
  readonly extensions: readonly string[];
  facts(files: { path: string; text: string }[]): Map<string, FileFacts>;
}

export function languageFor(file: string, languages: readonly Language[]): Language | null {
  return languages.find((language) => language.extensions.includes(path.posix.extname(file))) ?? null;
}

// The cut for a file no language parses: each block of lines between blank lines is a piece.
export function blankLineBlocks(text: string): Piece[] {
  const blocks: Piece[] = [];
  let open: Piece | null = null;
  for (const [i, line] of text.split(/\r\n|\r|\n/).entries()) {
    if (line.trim() === "") open = null;
    else if (open !== null) open.end = i + 1;
    else {
      open = { id: `P${blocks.length + 1}`, kind: "block", name: line.trim(), start: i + 1, end: i + 1 };
      blocks.push(open);
    }
  }
  return blocks;
}
