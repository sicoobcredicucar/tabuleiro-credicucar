import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { seed } from "./seed";
import type { State } from "./domain";
const dir = process.env.DEMO_DATA_DIR || path.join(process.cwd(), ".data");
let queue: Promise<unknown> = Promise.resolve();
export async function readState(): Promise<State> {
  try {
    return JSON.parse(await readFile(path.join(dir, "demo.json"), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return seed();
  }
}
export function mutate<T>(fn: (s: State) => T | Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const s = await readState();
    const result = await fn(s);
    await mkdir(dir, { recursive: true });
    const tmp = path.join(dir, "demo.tmp");
    await writeFile(tmp, JSON.stringify(s));
    await rename(tmp, path.join(dir, "demo.json"));
    return result;
  });
  queue = result.catch(() => {});
  return result;
}
