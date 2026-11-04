# Conecta Reinos

Jornada de Performance Comercial para Sicoob Credicucar. Implementação inicial com **demonstração navegável e persistente**, regras no servidor, tabuleiro 2.5D e migrations PostgreSQL/Supabase. Interface e dados fictícios em português. Não está pronta para produção.

## Executar

Requisitos: Node.js 24 e npm 11 (validados: 24.22.1 / 11.9.0).

```sh
npm ci
npm run dev
```

Acesse a aplicação na porta 3000 no seu ambiente local. A tela de entrada permite explorar os três perfis **somente na demonstração**. Não há contas ou senhas fixas. Em build de produção, o modo demonstrativo fica desligado por padrão:

```sh
npm run build
DEMO_MODE=true npm start
```

O código não realiza publicação externa. `DEMO_MODE=true` não deve ser utilizado em uma implantação com dados reais.

## Implementado e verificado

- Tabuleiro SVG com cenário próprio, percurso calculado, 51 casas, zoom, área navegável, peças HTML acessíveis, flutuação, pausa e movimento reduzido. Assets SVG individuais e cetro independente. As referências visuais não são usadas como captura de interface ou como avatar individual.
- Ranking calculado no servidor, por função e PA; percentuais acima de 100, empate com posições compartilhadas, casas compartilhadas e liderança oficial preservada ao filtrar PA.
- Rankings de PA somam produções e metas do mesmo indicador, sem média de percentuais; fonte demonstrativa individual única.
- Sessões demonstrativas assinadas em cookie HttpOnly/SameSite, autorização de rotas no servidor e verificação de origem nas escritas. Seleção de papel é intencional na demonstração. Isso **não é autenticação corporativa**.
- Cadastros de PA e colaborador, importação CSV/XLSX com mapeamento, validação, relatório de erros, prévia e publicação. Fonte: campanha anual 2026, indicador Conexões. Valores brasileiros e competência local.
- Saldo acumulado substitui revisão; grupo incompleto bloqueia publicação; correção exige justificativa; reenvio idêntico não duplica; versão esperada detecta conflitos. Snapshot de participante, vínculo e arte é copiado na publicação. Consulta periódica a cada 15 s.
- Upload privado PNG/WebP com verificação do conteúdo por Sharp, dimensões, canal alfa e limite de 5 MB. Prévia e ajuste de escala, pés e mão; imagem antiga preservada nas revisões. A presença de corpo inteiro e transparência visual efetiva ainda exige revisão humana.
- Jornada com marcos simbólicos e histórico, exportação CSV para perfis operacionais, auditoria e configurações básicas.

A persistência demonstrativa fica em `.data/demo.json`, com substituição atômica e fila de escritas no processo. Imagens e chave de assinatura ficam em `.data/`; não são versionadas. Requer **uma única instância Node** e disco persistente, não usar em serverless ou múltiplos workers. Reiniciar o servidor preserva cadastros e publicações. Para reiniciar os dados fictícios, pare o servidor e remova somente `.data/` após salvar qualquer trabalho que deseja manter.

## Testes

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

O E2E usa Chromium em `/usr/bin/chromium` e inicia o build de produção com demonstração habilitada. Ajuste `playwright.config.ts` se seu navegador estiver em outro local. O E2E usa `DEMO_DATA_DIR` em um diretório temporário exclusivo e não modifica os dados navegáveis da demonstração. A suíte cria PA98 nessa base isolada.

`tests/domain.test.ts`: fórmulas, casas, empate, PA ponderado, metas, duplicatas, competências, CSV, idempotência e snapshots. `tests/rls.test.ts`: aplica migration em PostgreSQL embarcado (PGlite) com schemas mínimos de Auth/Storage e verifica RLS, papéis, snapshots e publicação. **Não substitui teste em um projeto Supabase real**. `tests/e2e`: cadastro persistente, importação, prévia, publicação, consulta e escrita negada; layouts 390, 1366 e 1920 px.

## Supabase: base entregue, integração pendente

A migration `supabase/migrations/001_reinos.sql` contém cadastro, histórico de vínculos, assets versionados, temporadas, campanhas, indicadores, elegibilidade, importações, resultados, snapshots, conquistas, auditoria, RLS e bucket privado. A função `publish_import` faz publicação transacional com `numeric`, rank compartilhado e controle de versão.

Para integração real, a cooperativa deve fornecer um projeto Supabase, URL e chave pública e definir domínios autorizados. Configure Auth por convite e URLs de redirecionamento, crie a primeira conta administrativa por operação controlada no servidor e aplique a migration com a CLI do Supabase. Nunca atribua papéis por `user_metadata`, nem disponibilize service-role no navegador. A tabela protegida `access_profiles` é a fonte dos papéis. Usuários operacionais não podem promover contas nem alterar auditoria.

Antes de substituir a demonstração: implementar adaptador com sessão Supabase SSR, convite/recuperação/encerramento, operações com JWT do usuário e RLS, upload validado no servidor e URLs assinadas; ligar os componentes ao banco e testar Auth/Storage reais. O cliente Supabase está declarado como dependência, mas **a aplicação não está conectada ao Supabase e não anuncia essa conexão**. Não basta preencher as variáveis comentadas em `.env.example`.

### Limitações concretas desta primeira entrega

- Campanha, calendário anual e indicador únicos e demonstrativos; editor completo de temporadas, campanhas, critérios de elegibilidade e indicadores ainda não implementado.
- Cadastros permitem inclusão; edição/desativação e transferências com vigência têm modelo SQL, mas ainda não possuem fluxo na interface.
- Convites, permissões reais e recuperação de acesso dependem da integração Auth; não existe cadastro público.
- Fonte agregada de PA via planilha e atribuição a gerentes requerem implementação; a RPC recusa explicitamente fonte PA. O ranking PA da demonstração é derivado das somas individuais, sem dupla contagem.
- Movimento entre revisões usa transição das coordenadas até a casa nova; não percorre cada segmento intermediário. Peças próximas usam deslocamentos, contador e lista expansível, sem modificar a casa oficial.
- Arraste do mapa é substituído por rolagem nativa. Celebração de marcos e editor de cenários/cetro não implementados.
- Não foram fornecidos arquivos individuais de personagens ou logotipo oficial. O cenário, avatar neutro e cetro locais são SVG originais; a prancha de referência não foi recortada.
- RLS foi testada em PGlite, mas Auth, Storage e integração de rede Supabase não foram executados.
- Regras comerciais, nomenclatura final e identidade visual precisam ser aprovadas pela cooperativa antes de uso com resultados reais.

## Deploy futuro

Use Node com HTTPS, domínio corporativo, integração Supabase completa, segredos em configuração segura e demonstração desligada. Revise dependências e políticas, teste os três perfis com usuários reais de teste, configure observabilidade sem dados pessoais e retenção de assets históricos. Não carregue CPF, contratos ou dados de clientes: somente resultados agregados da competição.
