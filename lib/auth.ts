import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { roles, type Role } from "./domain";
const dir = process.env.DEMO_DATA_DIR || path.join(process.cwd(), ".data");
mkdirSync(dir, { recursive: true });
const keyPath = path.join(dir, "session-key");
try {
  writeFileSync(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 });
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
}
const key = readFileSync(keyPath);
export const demoEnabled = () =>
  process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";
export function sign(role: Role) {
  const value = Buffer.from(
    JSON.stringify({ role, expires: Date.now() + 8 * 3600000 }),
  ).toString("base64url");
  return value + "." + createHmac("sha256", key).update(value).digest("hex");
}
export async function session(): Promise<Role | null> {
  if (!demoEnabled()) return null;
  const token = (await cookies()).get("reinos_demo")?.value;
  if (!token) return null;
  const [value, sig] = token.split(".");
  const expected = createHmac("sha256", key).update(value).digest("hex");
  if (
    !sig ||
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString());
    return data.expires > Date.now() && roles.includes(data.role)
      ? data.role
      : null;
  } catch {
    return null;
  }
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.host === req.headers.get("host")
    );
  } catch {
    return false;
  }
}
