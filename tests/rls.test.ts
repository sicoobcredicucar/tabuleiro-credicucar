import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("PostgreSQL: migration, RLS e publicação transacional", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create schema auth; create schema storage; create role authenticated; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key,bucket_id text); alter table storage.objects enable row level security;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/001_reinos.sql", import.meta.url),
        "utf8",
      ),
    );
    const admin = "00000000-0000-0000-0000-000000000001",
      perf = "00000000-0000-0000-0000-000000000002",
      user = "00000000-0000-0000-0000-000000000003";
    await db.exec(
      `insert into auth.users values('${admin}'),('${perf}'),('${user}');insert into access_profiles values('${admin}','administrador',true),('${perf}','performance',true),('${user}','usuario',true);`,
    );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${user}';`,
    );
    assert.equal((await db.query("select * from imports")).rows.length, 0);
    await assert.rejects(
      db.exec(
        "insert into pas values('PA99','Negado','Negado',true,null,null)",
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(
        `update access_profiles set role='administrador' where user_id='${user}'`,
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(
        "select publish_import('00000000-0000-0000-0000-000000000000',0,'Teste')",
      ),
      /Sem permissão/,
    );
    await db.exec(`set request.jwt.claim.sub='${perf}';`);
    await assert.rejects(
      db.exec(
        "insert into people(id,name,email) values('C1','Nome','p@example.invalid')",
      ),
      /row-level security/,
    );
    await db.exec(
      `reset role;insert into people(id,name,email,class_id) values('C1','Pessoa fictícia','p@example.invalid','mago');insert into affiliations(person_id,pa_id,job,valid_from) values('C1','PA00','Gerente de relacionamento','2026-01-01');insert into indicators values('conexoes','Conexões','quantidade');`,
    );
    const season = (
      await db.query<{ id: string }>(
        "insert into seasons(title,starts,ends) values('Temporada teste','2026-01-01','2026-12-31') returning id",
      )
    ).rows[0].id;
    const campaign = (
      await db.query<{ id: string }>(
        `insert into campaigns(season_id,title,starts,ends) values('${season}','Teste','2026-01-01','2026-12-31') returning id`,
      )
    ).rows[0].id;
    const ranking = (
      await db.query<{ id: string }>(
        `insert into rankings(campaign_id,title,job,indicator_id) values('${campaign}','Teste','Gerente de relacionamento','conexoes') returning id`,
      )
    ).rows[0].id;
    await db.exec(
      `insert into eligibility values('${ranking}','C1',null);set role authenticated;set request.jwt.claim.sub='${perf}';`,
    );
    const imp = (
      await db.query<{ id: string }>(
        `insert into imports(ranking_id,competency,status) values('${ranking}','2026-11-04','validated') returning id`,
      )
    ).rows[0].id;
    await db.exec(
      `insert into result_revisions(import_id,person_id,target,actual) values('${imp}','C1',100,120)`,
    );
    const pub = (
      await db.query<{ id: string }>(
        `select publish_import('${imp}',0,'Primeira publicação') as id`,
      )
    ).rows[0].id;
    assert.ok(pub);
    assert.equal(
      (
        await db.query<{ percentage: string }>(
          "select percentage from ranking_entries",
        )
      ).rows[0].percentage,
      "120.0000000000000000",
    );
    await assert.rejects(
      db.exec(`select publish_import('${imp}',0,'Conflito')`),
      /Conflito/,
    );
    assert.equal(
      (
        await db.query<{ id: string }>(
          `select publish_import('${imp}',1,'Idempotente') as id`,
        )
      ).rows[0].id,
      pub,
    );
    await db.exec(`set request.jwt.claim.sub='${user}';`);
    assert.equal(
      (await db.query("select * from ranking_entries")).rows.length,
      1,
    );
    assert.equal((await db.query("select * from imports")).rows.length, 0);
    assert.equal((await db.query("select * from audit")).rows.length, 0);
    await assert.rejects(
      db.exec("delete from ranking_entries"),
      /permission denied/,
    );
    await db.exec(
      `reset role;update people set name='Nome atualizado' where id='C1'`,
    );
    const snap = (
      await db.query<{ snapshot: { person: { name: string } } }>(
        "select snapshot from ranking_entries",
      )
    ).rows[0].snapshot;
    assert.equal(snap.person.name, "Pessoa fictícia");
  } finally {
    await db.close();
  }
});
