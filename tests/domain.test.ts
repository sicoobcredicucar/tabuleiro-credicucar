import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/seed";
import {
  calculate,
  publish,
  validateRows,
  aggregate,
  brNumber,
} from "../lib/domain";
import { parseCsv } from "../lib/csv";
const rows = () => structuredClone(seed().revisions[0].rows);
test("51 casas, percentuais acima de 100 e empate 1,1,3", () => {
  const s = seed(),
    r = rows();
  r[0].realizado_acumulado = 100;
  r[1].realizado_acumulado = 100;
  r[2].realizado_acumulado = 50;
  r[3].realizado_acumulado = 0;
  r[4].realizado_acumulado = 125;
  const e = calculate(r, s.people);
  assert.deepEqual(
    e.map((x) => x.position),
    [1, 2, 2, 4, 5],
  );
  assert.deepEqual(
    e.map((x) => x.house),
    [50, 50, 50, 25, 0],
  );
  assert.equal(e[0].percent, 125);
});
test("PA usa somas ponderadas", () => {
  const s = seed(),
    r = rows().slice(0, 2);
  s.people[1].pa = s.people[0].pa;
  r[0].meta = 100;
  r[0].realizado_acumulado = 100;
  r[1].meta = 300;
  r[1].realizado_acumulado = 0;
  assert.equal(aggregate(r, s)[0].percent, 25);
});
test("valida ausência, zero, negativos, IDs, datas e duplicação", () => {
  const s = seed();
  for (const value of [0, -1, undefined]) {
    const r = rows();
    r[0].meta = value as number;
    assert.ok(validateRows(r, s).errors.length);
  }
  const r = rows();
  r[0].realizado_acumulado = 0;
  assert.equal(validateRows(r, s).errors.length, 0);
  r[0].realizado_acumulado = -1;
  assert.ok(validateRows(r, s).errors.length);
  r[0].competencia = "2026-02-30";
  assert.ok(validateRows(r, s).errors.length);
  assert.ok(validateRows([...rows(), rows()[0]], s).errors.length);
  const u = rows();
  u[0].colaborador_id = "desconhecido";
  assert.ok(validateRows(u, s).errors.length);
});
test("publicação idempotente, conflito e snapshots imutáveis", () => {
  const s = seed(),
    r = rows();
  const old = structuredClone(s.revisions[0]);
  assert.equal(publish(s, r, 4, "", "performance").id, old.id);
  r[0].realizado_acumulado = 120;
  const revision = publish(s, r, 4, "Correção", "performance");
  assert.equal(s.revisions.length, 5);
  assert.equal(revision.version, 5);
  assert.throws(() => publish(s, r, 4, "Correção", "performance"), /Conflito/);
  s.people[0].pa = "PA97";
  s.people[0].job = "Outra função";
  assert.deepEqual(s.revisions[0], old);
  assert.equal(revision.entries[0].person.pa, "PA00");
});
test("grupo incompleto bloqueia e revisão exige motivo", () => {
  const s = seed();
  assert.throws(
    () => publish(s, rows().slice(1), 4, "Correção", "performance"),
    /sem meta/,
  );
  const r = rows();
  r[0].realizado_acumulado = 111;
  assert.throws(() => publish(s, r, 4, "", "performance"), /Justificativa/);
});
test("número brasileiro, CSV com aspas e recusa fórmulas", () => {
  assert.equal(brNumber("1.234,56"), 1234.56);
  assert.ok(Number.isNaN(brNumber("")));
  assert.ok(Number.isNaN(brNumber("1,2,3")));
  assert.deepEqual(parseCsv('nome;meta\n"Pessoa; exemplo";"1.234,56"'), [
    { nome: "Pessoa; exemplo", meta: "1.234,56" },
  ]);
  assert.throws(() => parseCsv("nome;meta\n=SUM(A1);1"), /fórmulas/);
});
