import { NextResponse } from "next/server";
import { session, sameOrigin } from "@/lib/auth";
import { mutate, readState } from "@/lib/store";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
export async function GET(req: Request) {
  if (!(await session())) return new Response(null, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[a-f0-9-]+\.webp$/.test(id))
    return new Response(null, { status: 400 });
  const s = await readState();
  if (
    !s.people.some((p) => p.avatar === id) &&
    !s.revisions.some((r) => r.entries.some((e) => e.person.avatar === id))
  )
    return new Response(null, { status: 404 });
  try {
    return new Response(
      await readFile(
        path.join(
          process.env.DEMO_DATA_DIR || path.join(process.cwd(), ".data"),
          "avatars",
          id,
        ),
      ),
      {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return new Response(null, { status: 404 });
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req) || (await session()) !== "administrador")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    const personId = String(form.get("personId"));
    if (
      !(file instanceof File) ||
      file.size > 5 * 1024 * 1024 ||
      !["image/png", "image/webp"].includes(file.type)
    )
      throw Error("Use PNG ou WebP de até 5 MB");
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, { limitInputPixels: 16000000 });
    const metadata = await image.metadata();
    if (
      !["png", "webp"].includes(metadata.format ?? "") ||
      !metadata.hasAlpha ||
      !metadata.width ||
      !metadata.height ||
      metadata.width < 64 ||
      metadata.height < 128 ||
      metadata.width > 4096 ||
      metadata.height > 4096
    )
      throw Error(
        "Imagem deve ser PNG/WebP transparente, entre 64×128 e 4096×4096 px",
      );
    const id = crypto.randomUUID() + ".webp";
    await mutate(async (s) => {
      const p = s.people.find((p) => p.id === personId);
      if (!p) throw Error("Colaborador não encontrado");
      const dir = path.join(
        process.env.DEMO_DATA_DIR || path.join(process.cwd(), ".data"),
        "avatars",
      );
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, id), await image.webp().toBuffer());
      const before = p.avatar;
      p.avatar = id;
      s.audit.push({
        at: new Date().toISOString(),
        author: "administrador",
        action: "avatar",
        before: before ?? null,
        after: id,
        reason: "Nova arte; referências históricas preservadas",
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
export async function PATCH(req: Request) {
  if (!sameOrigin(req) || (await session()) !== "administrador")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  try {
    const b = await req.json();
    if (
      !Number.isFinite(b.scale) ||
      b.scale < 0.3 ||
      b.scale > 2 ||
      !Number.isFinite(b.foot) ||
      Math.abs(b.foot) > 100 ||
      ![b.handX, b.handY].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)
    )
      throw Error("Escala: 0,3–2; pés: -100–100; mão: 0–100");
    await mutate((s) => {
      const p = s.people.find((p) => p.id === b.personId);
      if (!p) throw Error("Colaborador inexistente");
      const before = structuredClone(p);
      Object.assign(p, {
        scale: b.scale,
        foot: b.foot,
        handX: b.handX,
        handY: b.handY,
        hasScepter: !!b.hasScepter,
      });
      s.audit.push({
        at: new Date().toISOString(),
        author: "administrador",
        action: "ancoragem",
        before,
        after: p,
        reason: "Ajuste visual",
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
