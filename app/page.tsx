"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Castle,
  Map,
  Trophy,
  Compass,
  Users,
  Settings,
  ChevronDown,
  Bell,
  LogOut,
  ArrowUpRight,
  Target,
  Flag,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  Pause,
  Play,
  Upload,
  Shield,
  ScrollText,
  X,
  ArrowRight,
  Check,
  Info,
  Menu,
  Download,
} from "lucide-react";
import type { Role, State, Entry, Person, Row } from "@/lib/domain";
import { jobs, brNumber } from "@/lib/domain";
type Data = State & { role: Role };
const pct = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
const number = (v: number) => v.toLocaleString("pt-BR");
const titles: Record<string, string> = {
  relacionamento: "Gerentes de relacionamento",
  agentes: "Agentes de relacionamento",
  gerentes: "Gerentes de agência",
  pas: "Pontos de atendimento",
};
const sections = [
  ["board", "Tabuleiro", Map],
  ["ranking", "Ranking", Trophy],
  ["journey", "Minha jornada", Compass],
  ["performance", "Performance", ScrollText],
  ["admin", "Administração", Users],
  ["settings", "Configurações", Settings],
] as const;
function coord(i: number, total = 51) {
  const t = i / (total - 1);
  return { x: 16 + t * 67 + Math.sin(t * Math.PI * 4) * 18, y: 88 - t * 60 };
}
export default function Page() {
  const [data, setData] = useState<Data | null>(null),
    [role, setRole] = useState<Role>("usuario"),
    [tab, setTab] = useState("board"),
    [ranking, setRanking] = useState("relacionamento"),
    [pa, setPa] = useState("todos"),
    [query, setQuery] = useState(""),
    [paused, setPaused] = useState(false),
    [hidden, setHidden] = useState(false),
    [zoom, setZoom] = useState(1),
    [selected, setSelected] = useState<Entry | null>(null),
    [help, setHelp] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [raw, setRaw] = useState<Record<string, unknown>[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<{
      rows: Row[];
      errors: string[];
      version: number;
    } | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [historyId, setHistoryId] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Entry[] | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/demo", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setRole(d.role);
      } else if (res.status === 401) setData(null);
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const id = setInterval(() => void refresh(), 15000);
    const fn = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", fn);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
      document.removeEventListener("visibilitychange", fn);
    };
  }, [refresh]);
  useEffect(() => {
    if (!selected && !help && !expanded) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".modal");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setHelp(false);
        setExpanded(null);
      }
      if (event.key === "Tab" && dialog) {
        const elements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex="0"]',
          ),
        );
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [selected, help, expanded]);
  async function login() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(body: unknown) {
    setError("");
    setNotice("");
    const r = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw Error(j.error);
    return j;
  }
  async function submit(body: unknown) {
    setBusy(true);
    try {
      await action(body);
      setNotice("Alteração salva com sucesso.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const revision =
    data?.revisions
      .filter((r) => r.ranking === ranking)
      .find((r) => r.id === historyId) ??
    data?.revisions.filter((r) => r.ranking === ranking).at(-1);
  const houses = revision?.houses ?? 51;
  const entries = revision?.entries ?? [];
  const visible = entries.filter(
    (e) =>
      (pa === "todos" || e.person.pa === pa) &&
      e.person.name.toLowerCase().includes(query.toLowerCase()),
  );
  const mine = entries.find((e) => e.person.id === "C004");
  const groups: Entry[][] = [];
  for (const e of [...visible].sort((a, b) => a.house - b.house)) {
    const last = groups.at(-1);
    if (last && e.house - last.at(-1)!.house <= 3) last.push(e);
    else groups.push([e]);
  }
  const change = (e: Entry) =>
    e.previous === undefined
      ? "Primeira apuração"
      : e.previous === e.position
        ? "Manteve posição"
        : `${e.previous > e.position ? "↑" : "↓"} ${Math.abs(e.previous - e.position)} posições`;
  async function importFile(file: File) {
    setError("");
    setPreview(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw Error("Limite de 5 MB");
      let records: Record<string, unknown>[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const { parseCsv } = await import("@/lib/csv");
        records = parseCsv(await file.text());
      } else if (file.name.toLowerCase().endsWith(".xlsx")) {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const sheet = workbook.worksheets[0];
        if (!sheet) throw Error("Planilha vazia");
        const headers = (sheet.getRow(1).values as unknown[])
          .slice(1)
          .map(String);
        sheet.eachRow((r, i) => {
          if (i === 1) return;
          const row: Record<string, unknown> = {};
          headers.forEach((h, j) => {
            const v = r.getCell(j + 1).value;
            if (v && typeof v === "object")
              throw Error(
                `Linha ${i}: fórmulas e tipos complexos não são permitidos`,
              );
            row[h] = v;
          });
          records.push(row);
        });
      } else throw Error("Escolha CSV ou XLSX");
      if (records.length > 10000) throw Error("Máximo de 10.000 linhas");
      setRaw(records);
      const keys = Object.keys(records[0] ?? {});
      setMapping(
        Object.fromEntries(
          [
            "campanha_id",
            "ranking_id",
            "competencia",
            "colaborador_id",
            "indicador_id",
            "meta",
            "realizado_acumulado",
          ].map((k) => [k, keys.includes(k) ? k : ""]),
        ),
      );
      setNotice(
        `${records.length} linhas carregadas. Confira o mapeamento e valide.`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function validate() {
    setBusy(true);
    try {
      const rows = raw.map((r) =>
        Object.fromEntries(Object.entries(mapping).map(([k, v]) => [k, r[v]])),
      );
      const p = await action({ action: "preview", rows });
      setPreview(p);
      if (!p.errors.length)
        setNotice("Arquivo válido. Revise os resultados antes de publicar.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="loading">
        <Castle size={44} />
        <p>Preparando sua jornada…</p>
      </main>
    );
  if (!data)
    return (
      <main className="login">
        <div className="login-art">
          <span className="eyebrow">SICOOB CREDICUCAR</span>
          <h1>
            Grandes jornadas
            <br />
            começam com
            <br />
            <em>conexões.</em>
          </h1>
          <p>Seu próximo marco está mais perto do que você imagina.</p>
          <img
            src="/realm.svg"
            alt="Ilustração de um reino com vila, floresta e castelo"
          />
        </div>
        <section className="login-form">
          <Castle size={46} />
          <h2>Conecta Reinos</h2>
          <p>Jornada de Performance Comercial</p>
          <div className="demo-note">AMBIENTE DE DEMONSTRAÇÃO</div>
          <p className="muted">
            Explore com dados fictícios. A seleção de perfil é exclusiva desta
            demonstração e não representa autenticação corporativa.
          </p>
          <label>
            Explorar como
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="usuario">Usuário · acompanhar a jornada</option>
              <option value="performance">
                Performance · apurar resultados
              </option>
              <option value="administrador">
                Administrador · gerenciar o reino
              </option>
            </select>
          </label>
          <button className="primary" onClick={login} disabled={busy}>
            Entrar na demonstração <ArrowRight size={18} />
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <small>
            Acesso real por convite será habilitado após a configuração do
            Supabase. Recuperação de acesso indisponível na demonstração.
          </small>
        </section>
      </main>
    );
  return (
    <div className="app">
      <header className="header">
        <button
          className="mobile-menu icon"
          aria-label="Abrir navegação"
          onClick={() => setMobile(!mobile)}
        >
          <Menu />
        </button>
        <button className="brand" onClick={() => setTab("board")}>
          <span className="brand-mark">
            <Castle size={29} />
          </span>
          <span>
            <strong>{data.theme.name}</strong>
            <small>Jornada de Performance Comercial</small>
          </span>
        </button>
        <span className="brand-divider" />
        <span className="cooperative">
          Sicoob <b>Credicucar</b>
        </span>
        <nav className="top-nav">
          {sections.slice(0, 3).map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <button
            className="notification icon"
            aria-label="Ver última publicação"
            onClick={() => {
              setNotice(
                `Última publicação: ${revision ? new Date(revision.publishedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nenhuma"}. A consulta é atualizada a cada 15 segundos.`,
              );
            }}
          >
            <Bell size={21} />
            <i />
          </button>
          <span className="header-line" />
          <div className="user-avatar">TE</div>
          <div className="user-name">
            <b>Theo Exemplo</b>
            <small>
              {role === "usuario"
                ? "Participante"
                : role === "performance"
                  ? "Performance"
                  : "Administrador"}
            </small>
          </div>
          <button
            className="icon"
            aria-label="Sair"
            onClick={async () => {
              await fetch("/api/session", { method: "DELETE" });
              setData(null);
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="side-top">
          {sections
            .filter(
              ([id]) =>
                !(
                  (id === "performance" && role === "usuario") ||
                  (["admin", "settings"].includes(id) &&
                    role !== "administrador")
                ),
            )
            .map(([id, label, Icon]) => (
              <button
                key={id}
                title={label}
                aria-label={label}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => {
                  setTab(id);
                  setMobile(false);
                }}
              >
                <Icon size={23} />
                <span>{label}</span>
              </button>
            ))}
        </div>
        <button
          aria-label="Como funciona"
          title="Como funciona"
          onClick={() => setHelp(true)}
        >
          <Info size={23} />
        </button>
        <span className="side-label">CONECTA</span>
      </aside>
      <main className="main">
        <div className="demo-bar">
          <span>
            <i /> Ambiente de demonstração{" "}
            <span className="demo-description">
              · Dados fictícios, regras configuráveis
            </span>
          </span>
          <button onClick={() => setHelp(true)}>
            Conheça a jornada <ArrowUpRight size={13} />
          </button>
        </div>
        {(notice || error) && (
          <div
            className={error ? "toast error" : "toast"}
            role={error ? "alert" : "status"}
          >
            {error || notice}
            <button
              className="icon"
              aria-label="Fechar aviso"
              onClick={() => {
                setError("");
                setNotice("");
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="page-heading">
          <div>
            <div className="breadcrumb">
              Seu reino <span>/</span> {sections.find((s) => s[0] === tab)?.[1]}
            </div>
            <h1>
              {tab === "board"
                ? "Cada conquista, um passo adiante."
                : tab === "ranking"
                  ? "Quem está fazendo história"
                  : tab === "journey"
                    ? "Sua jornada tem valor."
                    : tab === "performance"
                      ? "Da produção à conquista."
                      : tab === "admin"
                        ? "Pessoas que movem o reino."
                        : "Um reino com a sua identidade."}
            </h1>
            <p>
              {tab === "board"
                ? "Acompanhe sua evolução e celebre cada conexão pelo caminho."
                : "Acompanhe, configure e construa a próxima etapa da jornada."}
            </p>
          </div>
          <div className="season-chip">
            <span className="live-dot" /> TEMPORADA 2026{" "}
            <ChevronDown size={14} />
          </div>
        </div>
        <section className="filters" aria-label="Filtros de apuração">
          <label>
            Campanha
            <select
              aria-label="Campanha"
              value="jornada-2026"
              onChange={() => {}}
            >
              <option value="jornada-2026">Jornada de conexões · 2026</option>
            </select>
          </label>
          <label>
            Ranking
            <select
              value={ranking}
              onChange={(e) => {
                setRanking(e.target.value);
                setHistoryId("");
                setSelected(null);
              }}
            >
              {Object.entries(titles).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ponto de atendimento
            <select value={pa} onChange={(e) => setPa(e.target.value)}>
              <option value="todos">Todos os PAs</option>
              {data.pas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="updated">
            <span className="live-dot" />{" "}
            <span>
              Última publicação
              <b>
                {revision
                  ? new Date(revision.publishedAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Sem apuração"}
              </b>
            </span>
          </div>
        </section>
        {pa !== "todos" && (
          <p className="filter-info">
            O filtro de PA restringe a consulta. A classificação e a liderança
            oficiais permanecem as mesmas.
          </p>
        )}
        {(tab === "board" || tab === "journey") && (
          <section className="metrics">
            {mine ? (
              <>
                <article>
                  <span className="metric-icon gold">
                    <Trophy />
                  </span>
                  <div>
                    <small>Sua posição</small>
                    <strong>
                      {mine.position}º <em>no ranking</em>
                    </strong>
                  </div>
                  <span className="metric-foot">{titles[ranking]}</span>
                </article>
                <article>
                  <span className="metric-icon teal">
                    <Target />
                  </span>
                  <div>
                    <small>Atingimento da meta</small>
                    <strong>{pct(mine.percent)}</strong>
                  </div>
                  <span className="metric-foot">
                    <span className="mini-bar">
                      <i style={{ width: Math.min(mine.percent, 100) + "%" }} />
                    </span>
                    Meta: {number(mine.target)} conexões
                  </span>
                </article>
                <article>
                  <span className="metric-icon lime">
                    <ArrowUpRight />
                  </span>
                  <div>
                    <small>Evolução no ranking</small>
                    <strong>
                      {mine.previous === undefined
                        ? "—"
                        : mine.previous > mine.position
                          ? `+${mine.previous - mine.position}`
                          : mine.previous - mine.position}{" "}
                      <em>posições</em>
                    </strong>
                  </div>
                  <span className="metric-foot">{change(mine)}</span>
                </article>
                <article>
                  <span className="metric-icon parchment">
                    <Flag />
                  </span>
                  <div>
                    <small>Distância até a meta</small>
                    <strong>
                      {number(Math.max(0, mine.target - mine.actual))}{" "}
                      <em>conexões</em>
                    </strong>
                  </div>
                  <span className="metric-foot">
                    Cada conexão faz a diferença.
                  </span>
                </article>
              </>
            ) : (
              <article className="overview">
                <Compass />
                <div>
                  <small>Visão geral do ranking</small>
                  <strong>{entries.length} participantes</strong>
                </div>
                <span>Sem participação pessoal neste recorte</span>
              </article>
            )}
          </section>
        )}
        {tab === "board" && (
          <div className="board-layout">
            <section className="board-card">
              <div className="board-heading">
                <div>
                  <span className="eyebrow">O SEU PRÓXIMO CAPÍTULO</span>
                  <h2>A jornada até o castelo</h2>
                </div>
                <span className="board-tag">
                  <Flag size={13} /> {houses} casas · uma jornada
                </span>
              </div>
              <div className="map-viewport" ref={mapRef}>
                <div
                  className={`realm ${paused || hidden ? "paused" : ""}`}
                  style={{
                    width: `${zoom * 100}%`,
                    minWidth: 700,
                    height: 610 * zoom,
                  }}
                >
                  <img
                    className="scenery"
                    src="/realm.svg"
                    alt="Reino ilustrado com vila de partida, floresta, ponte e castelo"
                  />
                  <div className="map-shade" />
                  <svg
                    className="path"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d={
                        "M" +
                        Array.from({ length: 201 }, (_, i) => {
                          const c = coord(i, 201);
                          return `${c.x * 10},${c.y * 10}`;
                        }).join(" L")
                      }
                      fill="none"
                      stroke="#294735"
                      strokeWidth="54"
                      opacity=".2"
                    />
                    {Array.from({ length: houses }, (_, i) => {
                      const c = coord(i, houses);
                      return (
                        <g key={i}>
                          <ellipse
                            cx={c.x * 10}
                            cy={c.y * 10 + 5}
                            rx="21"
                            ry="18"
                            fill="#8e8164"
                          />
                          <ellipse
                            cx={c.x * 10}
                            cy={c.y * 10}
                            rx="21"
                            ry="17"
                            fill={i % 5 === 0 ? "#f4e6ba" : "#ded4b4"}
                            stroke="#b3a17c"
                            strokeWidth="2"
                          />
                        </g>
                      );
                    })}
                  </svg>
                  {Array.from({ length: houses }, (_, i) => {
                    const c = coord(i, houses);
                    return i % 5 === 0 ? (
                      <span
                        className="house-number"
                        key={i}
                        style={{ left: c.x + "%", top: c.y + "%" }}
                      >
                        {i}
                      </span>
                    ) : null;
                  })}
                  {[25, 50, 75, 100].map((p) => {
                    const c = coord(
                      Math.floor((p / 100) * (houses - 1)),
                      houses,
                    );
                    return (
                      <div
                        key={p}
                        className="milestone"
                        style={{ left: c.x + "%", top: c.y - 8 + "%" }}
                      >
                        <Flag size={14} />
                        <b>{p}%</b>
                      </div>
                    );
                  })}
                  {visible.map((e, i) => {
                    const c = coord(e.house, houses),
                      peers = groups.find((group) =>
                        group.some((p) => p.person.id === e.person.id),
                      ) ?? [e],
                      offset =
                        peers.findIndex((p) => p.person.id === e.person.id) -
                        (peers.length - 1) / 2;
                    return (
                      <button
                        key={e.person.id}
                        className={`piece ${e.person.id === "C004" ? "my-piece" : ""}`}
                        style={{
                          left: `${Math.min(93, Math.max(7, coord(peers.reduce((sum, p) => sum + p.house, 0) / peers.length, houses).x + offset * 9))}%`,
                          top: `${c.y}%`,
                          zIndex: Math.round(c.y) + 5,
                        }}
                        onClick={() => setSelected(e)}
                        aria-label={`${e.person.name}, ${e.position}º lugar, ${pct(e.percent)}, casa ${e.house}${peers.length > 1 ? ", peças próximas; consulte também a lista do ranking" : ""}`}
                      >
                        <span
                          className="piece-shadow"
                          style={{ animationDelay: `-${i * 0.63}s` }}
                        />
                        <span
                          className="floating"
                          style={{ animationDelay: `-${i * 0.63}s` }}
                        >
                          <img
                            className="character"
                            src={
                              e.person.avatar
                                ? `/api/avatar?id=${encodeURIComponent(e.person.avatar)}`
                                : "/avatar.svg"
                            }
                            alt=""
                            style={{
                              height: 104 * (e.person.scale ?? 1),
                              transform: `translateY(${e.person.foot ?? 0}px)`,
                            }}
                          />
                          {e.position === 1 && !e.person.hasScepter && (
                            <img
                              className="scepter"
                              src="/scepter.svg"
                              alt="Cetro de liderança"
                              style={{
                                left: (e.person.handX ?? 72) + "%",
                                top: (e.person.handY ?? 32) + "%",
                              }}
                            />
                          )}
                          {e.position === 1 && <span className="crown">♛</span>}
                        </span>
                        <span className="piece-name">
                          {e.person.name.split(" ")[0]}
                          {e.person.id === "C004" && <i>Você</i>}
                          {peers.length > 1 && <sup>+{peers.length - 1}</sup>}
                        </span>
                      </button>
                    );
                  })}
                  {groups
                    .filter((group) => group.length > 1)
                    .map((group) => {
                      const c = coord(
                        group.reduce((sum, p) => sum + p.house, 0) /
                          group.length,
                        houses,
                      );
                      return (
                        <button
                          key={group[0].person.id}
                          className="group-button"
                          style={{ left: c.x + "%", top: c.y + 6 + "%" }}
                          onClick={() => setExpanded(group)}
                          aria-label={`Expandir grupo de ${group.length} personagens`}
                        >
                          {group.length} personagens · expandir
                        </button>
                      );
                    })}
                  <div className="village-label">
                    Vila das conexões <span>O começo de tudo</span>
                  </div>
                </div>
              </div>
              <div className="board-toolbar">
                <span>
                  <i className="live-dot" /> Avanço = atingimento da meta
                </span>
                <div>
                  <button
                    aria-label={
                      paused ? "Retomar animações" : "Pausar animações"
                    }
                    title="Pausar animações"
                    onClick={() => setPaused(!paused)}
                  >
                    {paused ? <Play size={16} /> : <Pause size={16} />}
                  </button>
                  <button
                    aria-label="Diminuir zoom"
                    onClick={() => setZoom(Math.max(1, zoom - 0.25))}
                  >
                    <ZoomOut size={17} />
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    aria-label="Aumentar zoom"
                    onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                  >
                    <ZoomIn size={17} />
                  </button>
                  <button
                    aria-label="Reenquadrar mapa"
                    onClick={() => {
                      setZoom(1);
                      mapRef.current?.scrollTo({
                        left: 0,
                        top: 0,
                        behavior: "smooth",
                      });
                    }}
                  >
                    <Maximize size={16} />
                  </button>
                </div>
              </div>
              <div className="map-caption">
                <span>
                  Competência: {revision?.date.split("-").reverse().join("/")} ·
                  Indicador: Conexões · Regra demonstrativa v1
                </span>
                <button
                  onClick={() => {
                    if (mine) {
                      const viewport = mapRef.current;
                      const c = coord(mine.house, houses);
                      viewport?.scrollTo({
                        left:
                          (c.x / 100) * viewport.scrollWidth -
                          viewport.clientWidth / 2,
                        top:
                          (c.y / 100) * viewport.scrollHeight -
                          viewport.clientHeight / 2,
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "instant"
                          : "smooth",
                      });
                      setSelected(mine);
                    } else setNotice("Você não participa deste ranking.");
                  }}
                >
                  <Compass size={15} /> Encontrar meu personagem
                </button>
              </div>
            </section>
            <aside className="ranking-panel">
              <div className="panel-title">
                <span className="metric-icon gold">
                  <Trophy size={22} />
                </span>
                <div>
                  <span className="eyebrow">CADA CONQUISTA CONTA</span>
                  <h2>Ranking da jornada</h2>
                </div>
              </div>
              <div className="ranking-subtitle">
                {titles[ranking]}
                <span>ATINGIMENTO</span>
              </div>
              <div className="rank-list">
                {visible.slice(0, 5).map((e) => (
                  <button
                    className={`rank-item ${e.person.id === "C004" ? "current" : ""}`}
                    key={e.person.id}
                    onClick={() => setSelected(e)}
                  >
                    <span className={`rank-pos pos-${e.position}`}>
                      {e.position <= 3 ? <Trophy size={19} /> : null}
                      {e.position}º
                    </span>
                    <span className="rank-avatar">
                      <img
                        src={
                          e.person.avatar
                            ? `/api/avatar?id=${encodeURIComponent(e.person.avatar)}`
                            : "/avatar.svg"
                        }
                        alt=""
                      />
                    </span>
                    <span className="rank-name">
                      <b>
                        {e.person.name.split(" ")[0]}{" "}
                        {e.person.id === "C004" && <i>Você</i>}
                      </b>
                      <small>
                        {e.person.pa} <span>· {change(e)}</span>
                      </small>
                    </span>
                    <strong>{pct(e.percent)}</strong>
                  </button>
                ))}
                {!visible.length && (
                  <p className="muted">Nenhum participante neste filtro.</p>
                )}
              </div>
              <button
                className="full-ranking"
                onClick={() => setTab("ranking")}
              >
                Ver ranking completo <ArrowRight size={16} />
              </button>
              <div className="next-achievement">
                <span className="flag-circle">
                  <Flag />
                </span>
                <span className="eyebrow">SEU PRÓXIMO MARCO</span>
                <h3>
                  {mine && mine.percent < 100
                    ? "O castelo espera por você!"
                    : "A jornada continua!"}
                </h3>
                <p>
                  {mine
                    ? `${number(Math.max(0, mine.target - mine.actual))} conexões para alcançar 100% da sua meta.`
                    : "Explore as conquistas deste reino."}
                </p>
                <div className="progress">
                  <i
                    style={{ width: Math.min(mine?.percent ?? 0, 100) + "%" }}
                  />
                </div>
                <div className="progress-label">
                  <span>Seu progresso</span>
                  <b>{pct(mine?.percent ?? 0)}</b>
                </div>
                <span className="achievement-note">
                  Passo a passo, construímos juntos.
                </span>
              </div>
              <div className="cooperation">
                <span>✦</span>
                <p>
                  O reino cresce quando
                  <br />
                  <b>todo mundo avança.</b>
                </p>
              </div>
            </aside>
          </div>
        )}
        {tab === "ranking" && (
          <section className="surface">
            <div className="section-heading">
              <div>
                <h2>Ranking completo</h2>
                <p>
                  Percentual exato em ordem decrescente. Empates compartilham a
                  posição.
                </p>
              </div>
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="Buscar participante"
                  placeholder="Buscar participante…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="history-filter">
              <label>
                Publicação
                <select
                  value={historyId}
                  onChange={(e) => setHistoryId(e.target.value)}
                >
                  <option value="">Mais recente</option>
                  {data.revisions
                    .filter((r) => r.ranking === ranking)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.date} · revisão {r.version}
                      </option>
                    ))}
                </select>
              </label>
              {role !== "usuario" && (
                <button
                  className="secondary"
                  onClick={() => {
                    const text =
                      "posicao;colaborador_id;nome;pa;atingimento\n" +
                      visible
                        .map((e) =>
                          [
                            e.position,
                            e.person.id,
                            e.person.name,
                            e.person.pa,
                            pct(e.percent),
                          ].join(";"),
                        )
                        .join("\n");
                    download(text, "ranking.csv");
                  }}
                >
                  <Download size={16} /> Exportar CSV
                </button>
              )}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Posição</th>
                    <th>Participante</th>
                    <th>PA</th>
                    <th>Meta</th>
                    <th>Realizado</th>
                    <th>Atingimento</th>
                    <th>Evolução</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.person.id}>
                      <td>{e.position}º</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setSelected(e)}
                        >
                          {e.person.name}
                        </button>
                        <small>{e.person.job}</small>
                      </td>
                      <td>{e.person.pa}</td>
                      <td>{number(e.target)}</td>
                      <td>{number(e.actual)}</td>
                      <td>
                        <b>{pct(e.percent)}</b>
                      </td>
                      <td>{change(e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              Acima de 100%, a peça permanece no castelo; a classificação
              continua considerando o percentual integral.
            </p>
          </section>
        )}
        {tab === "journey" && (
          <section className="surface">
            <h2>Uma conquista de cada vez</h2>
            {mine ? (
              <>
                <p>Marcos simbólicos baseados apenas na apuração publicada.</p>
                <div className="achievements">
                  {[25, 50, 75, 100].map((p) => (
                    <article
                      className={mine.percent >= p ? "earned" : ""}
                      key={p}
                    >
                      <Shield size={38} />
                      <h3>{p}% da meta</h3>
                      <p>
                        {mine.percent >= p
                          ? "Conquista alcançada"
                          : "Continue sua jornada"}
                      </p>
                    </article>
                  ))}
                </div>
                <h3>Histórico de publicações</h3>
                {data.revisions
                  .filter((r) => r.ranking === ranking)
                  .map((r) => {
                    const e = r.entries.find((e) => e.person.id === "C004");
                    return e ? (
                      <div className="history-row" key={r.id}>
                        <span>
                          {r.date.split("-").reverse().join("/")} · revisão{" "}
                          {r.version}
                        </span>
                        <b>
                          {pct(e.percent)} · {e.position}º lugar
                        </b>
                        <span>{e.house}ª casa</span>
                      </div>
                    ) : null;
                  })}
              </>
            ) : (
              <p>
                Você possui acesso de consulta neste ranking, sem participação
                competitiva.
              </p>
            )}
          </section>
        )}
        {tab === "performance" && role !== "usuario" && (
          <section className="surface">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  APURAÇÃO · JORNADA DE CONEXÕES 2026
                </span>
                <h2>Importar, revisar e publicar</h2>
                <p>
                  Uma competência e ranking por arquivo. Saldos acumulados nunca
                  são somados na reimportação.
                </p>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  download(
                    "campanha_id;ranking_id;competencia;colaborador_id;indicador_id;meta;realizado_acumulado\n" +
                      data.people
                        .filter(
                          (p) =>
                            p.job ===
                            jobs[
                              ["relacionamento", "agentes", "gerentes"].indexOf(
                                ranking,
                              )
                            ],
                        )
                        .map(
                          (p, i) =>
                            `jornada-2026;${ranking};2026-11-04;${p.id};conexoes;100;${[112, 104, 96, 82, 82][i % 5]}`,
                        )
                        .join("\n"),
                    "modelo-resultados.csv",
                  )
                }
              >
                <Download size={16} /> Baixar modelo
              </button>
            </div>
            <label className="upload-box">
              <Upload size={32} />
              <b>Escolha sua planilha de resultados</b>
              <span>CSV ou XLSX · até 5 MB · apenas dados agregados</span>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => {
                  if (e.target.files?.[0]) void importFile(e.target.files[0]);
                }}
              />
            </label>
            {raw.length > 0 && (
              <>
                <h3>Mapeamento de colunas</h3>
                <div className="mapping">
                  {Object.keys(mapping).map((k) => (
                    <label key={k}>
                      {k}
                      <select
                        value={mapping[k]}
                        onChange={(e) => {
                          setMapping({ ...mapping, [k]: e.target.value });
                          setPreview(null);
                        }}
                      >
                        <option value="">Selecione…</option>
                        {Object.keys(raw[0]).map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <button className="primary" disabled={busy} onClick={validate}>
                  <Check size={16} /> Validar e gerar prévia
                </button>
              </>
            )}
            {preview && (
              <div className="preview">
                <h3>
                  {preview.errors.length
                    ? "Pendências na importação"
                    : "Prévia da apuração"}
                </h3>
                {preview.errors.length ? (
                  <>
                    <ul className="error">
                      {preview.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          preview.errors.join("\n"),
                          "erros-importacao.txt",
                        )
                      }
                    >
                      Baixar relatório de erros
                    </button>
                  </>
                ) : (
                  <>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Colaborador</th>
                            <th>Competência</th>
                            <th>Meta</th>
                            <th>Acumulado</th>
                            <th>Atingimento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((r) => (
                            <tr key={r.colaborador_id}>
                              <td>
                                {
                                  data.people.find(
                                    (p) => p.id === r.colaborador_id,
                                  )?.name
                                }
                              </td>
                              <td>{r.competencia}</td>
                              <td>{number(r.meta)}</td>
                              <td>{number(r.realizado_acumulado)}</td>
                              <td>
                                {pct((r.realizado_acumulado / r.meta) * 100)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <label>
                      Justificativa da revisão
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Obrigatória para corrigir uma apuração existente"
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await action({
                            action: "publish",
                            rows: preview.rows,
                            version: preview.version,
                            reason,
                          });
                          if (r.errors?.length)
                            throw Error(r.errors.join("; "));
                          setPreview(null);
                          setRaw([]);
                          setNotice(
                            "Apuração publicada. Ranking, mapa e liderança atualizados.",
                          );
                          await refresh();
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Publicar apuração <ArrowRight size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
            <h3>Histórico operacional</h3>
            {data.audit
              ?.filter((a) => a.action === "publicar")
              .map((a, i) => (
                <div className="history-row" key={i}>
                  <span>
                    {new Date(a.at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </span>
                  <b>{a.author}</b>
                  <span>{a.reason}</span>
                </div>
              ))}
            <p className="muted">
              Demonstração: campanha anual fixa, indicador “Conexões”, fonte
              individual. Configuração de campanhas e atribuição de resultado de
              PA a gerentes aguardam integração real.
            </p>
          </section>
        )}
        {tab === "admin" && role === "administrador" && (
          <section className="surface">
            <h2>Cadastros do reino</h2>
            <p>
              Perfil de acesso, função profissional e classe medieval são
              conceitos independentes.
            </p>
            <div className="admin-grid">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void submit({
                    action: "person",
                    person: {
                      id: f.get("id"),
                      name: f.get("name"),
                      email: f.get("email"),
                      job: f.get("job"),
                      pa: f.get("pa"),
                      className: f.get("className"),
                      competitive: f.get("competitive") === "on",
                    },
                  });
                }}
              >
                <h3>Novo colaborador</h3>
                <label>
                  Identificador interno
                  <input name="id" required placeholder="C016" />
                </label>
                <label>
                  Nome de exibição
                  <input name="name" required />
                </label>
                <label>
                  E-mail corporativo
                  <input name="email" type="email" required />
                </label>
                <label>
                  Função
                  <select name="job">
                    {jobs.map((j) => (
                      <option key={j}>{j}</option>
                    ))}
                  </select>
                </label>
                <label>
                  PA
                  <select name="pa">
                    {data.pas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} · {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Classe medieval
                  <select name="className">
                    {[
                      "Rei",
                      "Rainha",
                      "Cavaleiro",
                      "Arqueira",
                      "Bruxo",
                      "Bruxa",
                      "Mago",
                      "Camponês",
                      "Camponesa",
                      "Vassalo",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="checkbox">
                  <input type="checkbox" name="competitive" defaultChecked />{" "}
                  Participa de rankings
                </label>
                <button className="primary" disabled={busy}>
                  Cadastrar colaborador
                </button>
              </form>
              <div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void submit({
                      action: "pa",
                      pa: {
                        id: f.get("id"),
                        name: f.get("name"),
                        city: f.get("city"),
                      },
                    });
                  }}
                >
                  <h3>Novo ponto de atendimento</h3>
                  <label>
                    Código
                    <input
                      name="id"
                      pattern="PA[0-9]{2}"
                      required
                      placeholder="PA04"
                    />
                  </label>
                  <label>
                    Nome
                    <input name="name" required />
                  </label>
                  <label>
                    Cidade
                    <input name="city" required />
                  </label>
                  <button className="primary" disabled={busy}>
                    Cadastrar PA
                  </button>
                </form>
                <div className="info-box">
                  <Shield />
                  <h3>Acessos protegidos</h3>
                  <p>
                    Convites, desativação de contas e alteração de papéis reais
                    dependem do Supabase. A demonstração não cria contas
                    corporativas.
                  </p>
                </div>
              </div>
            </div>
            <h3>Colaboradores e personagens</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>Função</th>
                    <th>PA</th>
                    <th>Personagem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.name}</td>
                      <td>{p.job}</td>
                      <td>{p.pa}</td>
                      <td>
                        <label className="upload-inline">
                          {p.avatar
                            ? "Substituir PNG / WebP"
                            : "Enviar PNG / WebP"}
                          <input
                            type="file"
                            accept="image/png,image/webp"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setError("");
                              try {
                                const f = new FormData();
                                f.set("file", file);
                                f.set("personId", p.id);
                                const r = await fetch("/api/avatar", {
                                  method: "POST",
                                  body: f,
                                });
                                const j = await r.json();
                                if (!r.ok) throw Error(j.error);
                                setNotice(
                                  "Avatar privado salvo. Publicações anteriores preservam a arte original.",
                                );
                                await refresh();
                              } catch (err) {
                                setError((err as Error).message);
                              }
                            }}
                          />
                        </label>
                        {p.avatar && (
                          <AvatarSettings
                            person={p}
                            onSave={async (values) => {
                              const r = await fetch("/api/avatar", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  personId: p.id,
                                  ...values,
                                }),
                              });
                              const j = await r.json();
                              if (!r.ok) {
                                setError(j.error);
                                return;
                              }
                              await refresh();
                              setNotice(
                                "Ancoragem salva para a próxima publicação.",
                              );
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Auditoria de cadastros e permissões</h3>
            {data.audit
              ?.filter((a) => a.action !== "publicar")
              .map((a, i) => (
                <details key={i}>
                  <summary>
                    {a.action} · {a.author} ·{" "}
                    {new Date(a.at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </summary>
                  <pre>
                    {JSON.stringify(
                      { antes: a.before, depois: a.after },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              ))}
          </section>
        )}
        {tab === "settings" && role === "administrador" && (
          <section className="surface">
            <h2>Identidade da jornada</h2>
            <form
              className="settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void submit({
                  action: "theme",
                  name: f.get("name"),
                  houses: Number(f.get("houses")),
                });
              }}
            >
              <label>
                Nome da plataforma
                <input name="name" defaultValue={data.theme.name} required />
              </label>
              <label>
                Quantidade de casas
                <input
                  type="number"
                  name="houses"
                  min="2"
                  max="101"
                  defaultValue={data.theme.houses}
                />
              </label>
              <p className="muted">
                A alteração vale para as próximas apurações. O cenário e o cetro
                SVG são assets locais substituíveis; não há logotipo oficial
                fornecido.
              </p>
              <button className="primary" disabled={busy}>
                Salvar configurações
              </button>
            </form>
          </section>
        )}
        <footer className="footer">
          <span>
            {data.theme.name} <i>✦</i> Juntos, vamos mais longe.
          </span>
          <button onClick={() => setHelp(true)}>
            Como funciona <Info size={14} />
          </button>
        </footer>
      </main>
      {expanded && (
        <div className="modal-backdrop" onClick={() => setExpanded(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Personagens próximos"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon"
              aria-label="Fechar grupo"
              autoFocus
              onClick={() => setExpanded(null)}
            >
              <X />
            </button>
            <h2>Companheiros de caminho</h2>
            <p>
              Deslocamentos visuais mantêm as peças acessíveis. O avanço oficial
              continua sendo a casa calculada.
            </p>
            {expanded.map((e) => (
              <button
                className="rank-item"
                key={e.person.id}
                onClick={() => {
                  setExpanded(null);
                  setSelected(e);
                }}
              >
                <b>{e.position}º</b>
                <span className="rank-name">
                  {e.person.name}
                  <small>
                    Casa {e.house} · {e.person.pa}
                  </small>
                </span>
                <strong>{pct(e.percent)}</strong>
              </button>
            ))}
          </section>
        </div>
      )}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do participante"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon"
              aria-label="Fechar detalhes"
              autoFocus
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <div className="profile-art">
              <img
                src={
                  selected.person.avatar
                    ? `/api/avatar?id=${encodeURIComponent(selected.person.avatar)}`
                    : "/avatar.svg"
                }
                alt={`Personagem de ${selected.person.name}`}
              />
              {selected.position === 1 && <span>♛ Liderança oficial</span>}
            </div>
            <div className="eyebrow">
              {selected.person.className} · {selected.person.pa}
            </div>
            <h2>{selected.person.name}</h2>
            <p>{selected.person.job}</p>
            <div className="detail-grid">
              <span>
                Posição<b>{selected.position}º</b>
              </span>
              <span>
                Atingimento<b>{pct(selected.percent)}</b>
              </span>
              <span>
                Meta<b>{number(selected.target)}</b>
              </span>
              <span>
                Realizado<b>{number(selected.actual)}</b>
              </span>
            </div>
            <p className="muted">
              Casa {selected.house} · {change(selected)}. Unidade: conexões.
            </p>
            <button
              className="primary"
              onClick={() => {
                setSelected(null);
                setTab("ranking");
              }}
            >
              Consultar histórico <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal help"
            role="dialog"
            aria-modal="true"
            aria-label="Como funciona"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon"
              aria-label="Fechar explicação"
              autoFocus
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <span className="metric-icon gold">
              <Castle />
            </span>
            <h2>Uma jornada feita de conexões.</h2>
            <p>
              Seu avanço corresponde ao atingimento da meta: realizado acumulado
              ÷ meta × 100.
            </p>
            <ol>
              <li>Uma trilha de 51 casas: de 0 a 50.</li>
              <li>
                O ranking usa o percentual integral. A peça para no castelo em
                100%.
              </li>
              <li>Empates reais compartilham a posição (1, 1, 3) e o cetro.</li>
              <li>O filtro de PA não muda a liderança oficial.</li>
              <li>
                Resultados ausentes não são considerados zero. Metas inválidas
                bloqueiam publicação.
              </li>
            </ol>
            <p>
              Classes e conquistas são cosméticas. Não há sorte, apostas ou
              recompensas materiais.
            </p>
            <div className="info-box">
              Demonstração com dados fictícios e sessões locais. Regras e metas
              aguardam validação da cooperativa. Supabase e acesso por convite
              ainda não estão conectados.
            </div>
            <button className="primary" onClick={() => setHelp(false)}>
              Vamos à jornada <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function AvatarSettings({
  person,
  onSave,
}: {
  person: Person;
  onSave: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <details>
      <summary>Ajustar ancoragem</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void onSave({
            scale: brNumber(f.get("scale")),
            foot: brNumber(f.get("foot")),
            handX: brNumber(f.get("handX")),
            handY: brNumber(f.get("handY")),
            hasScepter: f.get("hasScepter") === "on",
          });
        }}
      >
        <img
          src={`/api/avatar?id=${encodeURIComponent(person.avatar ?? "")}`}
          alt="Prévia do personagem"
          style={{ height: 150 }}
        />
        {[
          ["scale", "Escala", person.scale ?? 1],
          ["foot", "Deslocamento dos pés (px)", person.foot ?? 0],
          ["handX", "Mão horizontal (%)", person.handX ?? 72],
          ["handY", "Mão vertical (%)", person.handY ?? 32],
        ].map(([key, label, value]) => (
          <label key={key}>
            {label}
            <input
              name={String(key)}
              defaultValue={String(value).replace(".", ",")}
              required
            />
          </label>
        ))}
        <label className="checkbox">
          <input
            type="checkbox"
            name="hasScepter"
            defaultChecked={person.hasScepter}
          />{" "}
          Arte já contém cetro
        </label>
        <button className="secondary">Salvar ancoragem</button>
      </form>
    </details>
  );
}
