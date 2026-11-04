# Evidências de validação — 4 de novembro de 2026

Executado no ambiente em `/workspace/tabuleiro-credicucar`, com Node 24.22.1 e npm 11.9.0.

| Verificação | Resultado |
| --- | --- |
| Instalação `npm ci --no-audit --no-fund` | Passou, usando package-lock.json |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm run build` | Passou, 4 rotas dinâmicas/estáticas da aplicação e páginas Next |
| `npm test` | 7 testes passaram: 6 de domínio/importação e 1 de integração PostgreSQL/RLS |
| `npm run test:e2e` | 4 testes passaram em Chromium: fluxo completo e 3 larguras |

## O que os testes exercitaram

- Ranking com teto visual de 100%, percentual acima de 100%, casa 0/25/50, empate compartilhado e soma ponderada de PAs.
- Metas ausentes, zero e negativas; realizado negativo; IDs desconhecidos; duplicação e competência inválida.
- CSV brasileiro com aspas, números e rejeição de fórmulas.
- Idempotência da publicação, conflito de versão, motivo de correção, bloqueio de grupo incompleto e snapshots preservados após alteração cadastral.
- Migration completa aplicada em PostgreSQL embarcado PGlite; usuário sem escrita, sem auditoria e sem leitura de importações; Performance sem cadastro administrativo; publicação transacional por RPC e snapshot imutável.
- Navegador: administrador cadastra PA, recarrega e encontra o cadastro; envia PNG com conteúdo validado, recupera imagem por sessão autorizada e confirma negativa sem sessão; Performance importa CSV, revisa e publica; mapa e tabela recebem o mesmo resultado; usuário comum tem escrita por API negada e não recebe rascunhos/auditoria.
- Larguras de 390, 1366 e 1920 px sem transbordamento horizontal da página; mapa com rolagem própria; movimento reduzido; abertura de detalhes e fechamento por teclado.

## Limites da evidência

Não houve conexão com Supabase real, envio de convite, recuperação de acesso, teste de Storage remoto, implantação externa ou validação das regras comerciais pela cooperativa. As sessões e a persistência da aplicação executada são demonstrativas. O PostgreSQL embarcado simula somente os schemas mínimos de Auth/Storage para testar SQL e RLS; isso não certifica a integração hospedada.

O fluxo de criação de contas corporativas, o editor completo de campanhas e os demais itens ainda ausentes estão documentados em README.md. Os 11 testes aprovados não significam que todos os critérios do prompt estejam integralmente entregues. Não utilizar esta versão com dados reais.
