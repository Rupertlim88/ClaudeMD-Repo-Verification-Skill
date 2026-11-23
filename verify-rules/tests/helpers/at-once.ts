// Starts one child process of race.ts per argument list, all at once, and returns each one's exit code and errors.
import { spawn } from "node:child_process";
import path from "node:path";

const race = path.join(import.meta.dirname, "race.ts");

export function atOnce(argLists: string[][]): Promise<{ code: number | null; stderr: string }[]> {
  return Promise.all(argLists.map((args) => new Promise<{ code: number | null; stderr: string }>((done) => {
    const child = spawn(process.execPath, [race, ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("exit", (code) => done({ code, stderr }));
  })));
}
