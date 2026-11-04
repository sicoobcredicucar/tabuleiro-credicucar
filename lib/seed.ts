import { calculate, aggregate, jobs, type State, type Row } from "./domain";
export function seed(): State {
  const pas = [
    ["PA00", "Santa Cruz das Palmeiras"],
    ["PA01", "Vargem Grande do Sul"],
    ["PA02", "Porto Ferreira"],
    ["PA03", "Casa Branca"],
    ["PA97", "Digital"],
  ].map(([id, name]) => ({ id, name, city: name, active: true }));
  const names = [
    "Aurora",
    "Davi",
    "Lívia",
    "Theo",
    "Cecília",
    "Bento",
    "Íris",
    "Caio",
    "Nina",
    "Otávio",
    "Flora",
    "Raul",
    "Maya",
    "Hugo",
    "Clara",
  ];
  const classes = [
    "Rainha",
    "Rei",
    "Arqueira",
    "Cavaleiro",
    "Bruxa",
    "Camponês",
    "Mago",
    "Vassalo",
    "Camponesa",
  ];
  const people = names.map((name, i) => ({
    id: `C${String(i + 1).padStart(3, "0")}`,
    name: `${name} Exemplo`,
    email: `pessoa${i + 1}@example.invalid`,
    job: jobs[Math.floor(i / 5)],
    pa: pas[i % 5].id,
    className: classes[i % classes.length],
    active: true,
    competitive: true,
  }));
  const state: State = {
    version: 4,
    people,
    pas,
    revisions: [],
    audit: [],
    theme: { name: "Conecta Reinos", houses: 51 },
    drafts: [],
  };
  for (const [i, ranking] of [
    "relacionamento",
    "agentes",
    "gerentes",
    "pas",
  ].entries()) {
    const selected =
      ranking === "pas" ? people : people.filter((p) => p.job === jobs[i]);
    const rows: Row[] = selected.map((p, j) => ({
      campanha_id: "jornada-2026",
      ranking_id: ranking,
      competencia: "2026-11-04",
      colaborador_id: p.id,
      indicador_id: "conexoes",
      meta: 100,
      realizado_acumulado: [112, 104, 96, 82, 82][j % 5],
    }));
    const entries =
      ranking === "pas" ? aggregate(rows, state) : calculate(rows, people);
    state.revisions.push({
      id: `initial-${ranking}`,
      version: i + 1,
      date: "2026-11-04",
      publishedAt: "2026-11-04T12:30:00Z",
      author: "Dados fictícios",
      reason: "Demonstração, sem regra comercial oficial",
      ranking,
      entries,
      rows,
      rule: 1,
      houses: 51,
    });
  }
  return state;
}
