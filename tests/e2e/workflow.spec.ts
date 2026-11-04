import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("fluxo completo: cadastro, apuração, publicação e consulta protegida", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Explorar como").selectOption("administrador");
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "A jornada até o castelo" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Administração", exact: true })
    .click();
  const form = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Novo ponto de atendimento" }),
  });
  const code = "PA98";
  await form.getByLabel("Código").fill(code);
  await form.getByLabel("Nome", { exact: true }).fill("PA de teste");
  await form.getByLabel("Cidade").fill("Cidade fictícia");
  await form.getByRole("button", { name: "Cadastrar PA" }).click();
  await expect(page.getByRole("status")).toContainText("salva");
  await page.reload();
  await expect(
    page.getByRole("option", { name: "PA98 · PA de teste" }).first(),
  ).toBeAttached();
  // Authenticated upload, content validation, private read and historical persistence.
  await page
    .getByRole("button", { name: "Administração", exact: true })
    .click();
  const avatar = await sharp({
    create: {
      width: 100,
      height: 200,
      channels: 4,
      background: { r: 0, g: 100, b: 80, alpha: 0.7 },
    },
  })
    .png()
    .toBuffer();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "C001", exact: true }) });
  await row
    .locator("input[type=file]")
    .setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: avatar,
    });
  await expect(page.getByRole("status")).toContainText("Avatar privado salvo");
  const profile = await (await page.request.get("/api/demo")).json();
  expect(profile.people[0].avatar).toMatch(/webp$/);
  expect(
    (
      await page.request.get("/api/avatar?id=" + profile.people[0].avatar)
    ).status(),
  ).toBe(200);
  expect(
    (await request.get("/api/avatar?id=" + profile.people[0].avatar)).status(),
  ).toBe(401);
  await page.reload();
  const persisted = await (await page.request.get("/api/demo")).json();
  expect(persisted.people[0].avatar).toBe(profile.people[0].avatar);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.getByLabel("Explorar como").selectOption("performance");
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await page.getByRole("button", { name: "Performance", exact: true }).click();
  const csv =
    "campanha_id;ranking_id;competencia;colaborador_id;indicador_id;meta;realizado_acumulado\n" +
    [120, 105, 97, 84, 82]
      .map(
        (v, i) =>
          `jornada-2026;relacionamento;2026-11-04;C00${i + 1};conexoes;100;${v}`,
      )
      .join("\n");
  await page.locator("input[type=file]").setInputFiles({
    name: "resultados.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Validar e gerar prévia" }).click();
  await expect(
    page.getByRole("heading", { name: "Prévia da apuração" }),
  ).toBeVisible();
  await page
    .getByLabel("Justificativa da revisão")
    .fill("Correção fictícia validada por teste");
  await page.getByRole("button", { name: "Publicar apuração" }).click();
  await expect(page.getByRole("status")).toContainText("Apuração publicada");
  const denied = await page.request.post("/api/demo", {
    data: { action: "pa", pa: { id: "PA96", name: "Negado", city: "Teste" } },
    headers: { origin: "http://localhost:3000" },
  });
  expect(denied.status()).toBe(400);
  await page
    .getByRole("button", { name: "Tabuleiro", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /Aurora Exemplo, 1º lugar, 120%/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Theo Exemplo, 4º lugar, 84%/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("84%");
  await page.getByRole("button", { name: "Fechar detalhes" }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.getByLabel("Explorar como").selectOption("usuario");
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  const forbidden = await page.request.post("/api/demo", {
    data: { action: "publish", rows: [] },
    headers: { origin: "http://localhost:3000" },
  });
  expect(forbidden.status()).toBe(403);
  const response = await page.request.get("/api/demo");
  const json = await response.json();
  expect(json.audit).toBeUndefined();
  expect(json.drafts).toBeUndefined();
  expect(json.revisions.at(-1).entries[0].percent).toBe(120);
  expect((await request.get("/api/demo")).status()).toBe(401);
});
for (const width of [390, 1366, 1920])
  test(`tabuleiro e consulta acessíveis em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "Entrar na demonstração" }).click();
    await expect(
      page.getByRole("heading", { name: "A jornada até o castelo" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page
      .getByRole("button", { name: "Encontrar meu personagem" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Fechar detalhes" }).press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `/tmp/conecta-${width}.png`,
      fullPage: true,
    });
  });
