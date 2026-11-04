import { z } from "zod";
export const roles = ["usuario", "performance", "administrador"] as const;
export type Role = (typeof roles)[number];
export const jobs = [
  "Gerente de relacionamento",
  "Agente de relacionamento",
  "Gerente de agência",
] as const;
export type Person = {
  id: string;
  name: string;
  email: string;
  job: string;
  pa: string;
  className: string;
  active: boolean;
  competitive: boolean;
  avatar?: string;
  scale?: number;
  foot?: number;
  handX?: number;
  handY?: number;
  hasScepter?: boolean;
};
export type PA = { id: string; name: string; city: string; active: boolean };
export type Row = {
  campanha_id: string;
  ranking_id: string;
  competencia: string;
  colaborador_id: string;
  indicador_id: string;
  meta: number;
  realizado_acumulado: number;
};
export type Entry = {
  person: Person;
  target: number;
  actual: number;
  percent: number;
  house: number;
  position: number;
  previous?: number;
};
export type Revision = {
  id: string;
  version: number;
  date: string;
  publishedAt: string;
  author: string;
  reason: string;
  ranking: string;
  entries: Entry[];
  rows: Row[];
  rule: 1;
  houses: number;
};
export type Audit = {
  at: string;
  author: string;
  action: string;
  before: unknown;
  after: unknown;
  reason: string;
};
export type State = {
  version: number;
  people: Person[];
  pas: PA[];
  revisions: Revision[];
  audit: Audit[];
  theme: { name: string; houses: number };
  drafts: Row[];
};
export const rankingIds = [
  "relacionamento",
  "agentes",
  "gerentes",
  "pas",
] as const;
export const rowSchema = z.object({
  campanha_id: z.literal("jornada-2026"),
  ranking_id: z.enum(rankingIds),
  competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  colaborador_id: z.string().min(1),
  indicador_id: z.literal("conexoes"),
  meta: z.number().positive(),
  realizado_acumulado: z.number().nonnegative(),
});
export function brNumber(v: unknown) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(s)) return NaN;
  return Number(s.replaceAll(".", "").replace(",", "."));
}
export function validateRows(raw: Record<string, unknown>[], state: State) {
  const errors: string[] = [];
  const rows: Row[] = [];
  const keys = new Set<string>();
  raw.forEach((r, i) => {
    const parsed = rowSchema.safeParse({
      ...r,
      meta: brNumber(r.meta),
      realizado_acumulado: brNumber(r.realizado_acumulado),
    });
    if (!parsed.success) {
      errors.push(
        `Linha ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`,
      );
      return;
    }
    const row = parsed.data;
    const p = state.people.find(
      (p) => p.id === row.colaborador_id && p.active && p.competitive,
    );
    const date = new Date(row.competencia + "T12:00:00Z");
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== row.competencia ||
      row.competencia < "2026-01-01" ||
      row.competencia > "2026-12-31"
    )
      errors.push(`Linha ${i + 2}: competência fora da campanha ou inválida`);
    if (!p)
      errors.push(`Linha ${i + 2}: colaborador desconhecido ou inelegível`);
    else if (
      row.ranking_id !== "pas" &&
      p.job !== jobs[rankingIds.indexOf(row.ranking_id)]
    )
      errors.push(`Linha ${i + 2}: função incompatível com ranking`);
    const key = [
      row.campanha_id,
      row.ranking_id,
      row.competencia,
      row.colaborador_id,
      row.indicador_id,
    ].join("|");
    if (keys.has(key)) errors.push(`Linha ${i + 2}: resultado duplicado`);
    keys.add(key);
    rows.push(row);
  });
  if (!rows.length) errors.push("Nenhum resultado válido");
  if (new Set(rows.map((r) => r.ranking_id + "|" + r.competencia)).size > 1)
    errors.push("Importe uma única competência e ranking por apuração");
  return { rows, errors };
}
export function calculate(rows: Row[], people: Person[], houses = 51): Entry[] {
  const entries = rows
    .map((r) => {
      const p = people.find((p) => p.id === r.colaborador_id);
      if (
        !p ||
        r.meta <= 0 ||
        !Number.isFinite(r.meta) ||
        r.realizado_acumulado < 0 ||
        !Number.isFinite(r.realizado_acumulado)
      )
        throw Error("Resultado inelegível");
      return {
        person: structuredClone(p),
        target: r.meta,
        actual: r.realizado_acumulado,
        percent: (r.realizado_acumulado / r.meta) * 100,
        house: Math.floor(
          (Math.max(0, Math.min(100, (r.realizado_acumulado / r.meta) * 100)) /
            100) *
            (houses - 1),
        ),
        position: 0,
      };
    })
    .sort(
      (a, b) =>
        b.percent - a.percent ||
        a.person.name.localeCompare(b.person.name, "pt-BR"),
    );
  entries.forEach(
    (e, i) =>
      (e.position =
        i && e.percent === entries[i - 1].percent
          ? entries[i - 1].position
          : i + 1),
  );
  return entries;
}
export function aggregate(rows: Row[], state: State) {
  const grouped = new Map<string, Row>();
  for (const row of rows) {
    const pa = state.people.find((p) => p.id === row.colaborador_id)?.pa;
    if (!pa) throw Error("Vínculo ausente");
    const old = grouped.get(pa);
    grouped.set(pa, {
      ...row,
      colaborador_id: pa,
      meta: (old?.meta ?? 0) + row.meta,
      realizado_acumulado:
        (old?.realizado_acumulado ?? 0) + row.realizado_acumulado,
    });
  }
  return calculate(
    [...grouped.values()],
    state.pas.map((p) => ({
      id: p.id,
      name: p.name,
      email: "",
      job: "Ponto de atendimento",
      pa: p.id,
      className: "Brasão",
      active: p.active,
      competitive: true,
    })),
    state.theme.houses,
  );
}
export function publish(
  state: State,
  rows: Row[],
  version: number,
  reason: string,
  author: string,
) {
  if (state.version !== version)
    throw Error("Conflito de versão. Atualize a prévia.");
  const ranking = rows[0]?.ranking_id;
  if (!ranking) throw Error("Sem resultados");
  const required = state.people.filter(
    (p) =>
      p.active &&
      p.competitive &&
      (ranking === "pas" ||
        p.job ===
          jobs[rankingIds.indexOf(ranking as (typeof rankingIds)[number])]),
  );
  if (required.some((p) => !rows.some((r) => r.colaborador_id === p.id)))
    throw Error(
      "Participantes sem meta ou resultado. Complete o grupo antes de publicar.",
    );
  const previous = state.revisions.filter((r) => r.ranking === ranking).at(-1);
  if (previous && JSON.stringify(previous.rows) === JSON.stringify(rows))
    return previous;
  if (previous && !reason.trim())
    throw Error("Justificativa obrigatória para nova revisão");
  const entries =
    ranking === "pas"
      ? aggregate(rows, state)
      : calculate(rows, state.people, state.theme.houses);
  for (const e of entries)
    e.previous = previous?.entries.find(
      (x) => x.person.id === e.person.id,
    )?.position;
  const revision: Revision = {
    id: crypto.randomUUID(),
    version: ++state.version,
    date: rows[0].competencia,
    publishedAt: new Date().toISOString(),
    author,
    reason,
    ranking,
    entries,
    rows: structuredClone(rows),
    rule: 1,
    houses: state.theme.houses,
  };
  state.revisions.push(revision);
  state.audit.push({
    at: revision.publishedAt,
    author,
    action: "publicar",
    before: previous?.id ?? null,
    after: revision.id,
    reason,
  });
  return revision;
}
