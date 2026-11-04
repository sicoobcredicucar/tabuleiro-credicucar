import { NextResponse } from "next/server";
import { demoEnabled, sameOrigin, sign } from "@/lib/auth";
import { roles } from "@/lib/domain";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Origem não permitida" },
      { status: 403 },
    );
  if (!demoEnabled())
    return NextResponse.json(
      { error: "Demonstração desativada. Configure autenticação real." },
      { status: 403 },
    );
  const { role } = await req.json();
  if (!roles.includes(role))
    return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("reinos_demo", sign(role), {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: 28800,
  });
  return res;
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("reinos_demo");
  return res;
}
