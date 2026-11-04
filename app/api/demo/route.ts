import { NextResponse } from "next/server";
import { session, sameOrigin } from "@/lib/auth";
import { readState, mutate } from "@/lib/store";
import { publish, validateRows, jobs, type Person } from "@/lib/domain";
export async function GET() {
  const role = await session();
  if (!role)
    return NextResponse.json({ error: "Sessão necessária" }, { status: 401 });
  const s = await readState();
  return NextResponse.json(
    {
      role,
      version: s.version,
      pas: s.pas,
      people:
        role === "usuario"
          ? [
              ...new Map(
                s.revisions
                  .flatMap((r) => r.entries)
                  .map((e) => [e.person.id, e.person]),
              ).values(),
            ]
          : s.people,
      theme: s.theme,
      revisions: s.revisions,
      ...(role !== "usuario"
        ? {
            audit:
              role === "administrador"
                ? s.audit
                : s.audit.filter((a) => a.action === "publicar"),
            drafts: s.drafts,
          }
        : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Origem não permitida" },
      { status: 403 },
    );
  const role = await session();
  if (!role || role === "usuario")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  try {
    const body = await req.json();
    const result = await mutate((s) => {
      const before = structuredClone({
        people: s.people,
        pas: s.pas,
        theme: s.theme,
      });
      if (body.action === "preview" || body.action === "publish") {
        const checked = validateRows(body.rows, s);
        if (checked.errors.length) return checked;
        if (body.action === "preview")
          return { ...checked, version: s.version };
        return {
          revision: publish(
            s,
            checked.rows,
            body.version,
            body.reason ?? "",
            role,
          ),
        };
      }
      if (role !== "administrador")
        throw Error(
          "Apenas administradores podem alterar cadastros e configurações",
        );
      if (body.action === "person") {
        const p = body.person as Person;
        if (
          !p.id ||
          !p.name ||
          !jobs.includes(p.job as (typeof jobs)[number]) ||
          !s.pas.some((pa) => pa.id === p.pa) ||
          !p.email ||
          !p.className
        )
          throw Error("Cadastro inválido");
        if (s.people.some((x) => x.id === p.id))
          throw Error("Identificador já cadastrado");
        s.people.push({ ...p, active: true, competitive: !!p.competitive });
      } else if (body.action === "pa") {
        if (
          !/^PA\d{2}$/.test(body.pa.id) ||
          !body.pa.name ||
          s.pas.some((p) => p.id === body.pa.id)
        )
          throw Error("PA inválido ou duplicado");
        s.pas.push({ ...body.pa, active: true });
      } else if (body.action === "theme") {
        if (
          !body.name?.trim() ||
          !Number.isInteger(body.houses) ||
          body.houses < 2 ||
          body.houses > 101
        )
          throw Error("Configuração inválida");
        s.theme = { name: body.name.trim(), houses: body.houses };
      } else throw Error("Ação desconhecida");
      s.audit.push({
        at: new Date().toISOString(),
        author: role,
        action: body.action,
        before,
        after: { people: s.people, pas: s.pas, theme: s.theme },
        reason: body.reason ?? "Cadastro demonstrativo",
      });
      return { ok: true };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
