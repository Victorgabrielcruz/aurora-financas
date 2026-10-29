# Configuração Neon — 29/10/2026

Projeto `green-tree-96137932`, organização `org-royal-breeze-87377904`, branch `production` (`br-spring-credit-b5zw8tny`). Serviço solicitado: Postgres.

## Configuração executada

```text
npm i -g neon@latest
added 161 packages in 12s

neon init -y --org-id org-royal-breeze-87377904 --project-id green-tree-96137932 --branch production --services postgres
Linked .neon
Project green-tree-96137932
Branch production
Org org-royal-breeze-87377904

neon deploy
Auth complete (profile DEFAULT)
Applying to branch production (br-spring-credit-b5zw8tny)
No changes — branch production already matches the policy.
Utilized services: Postgres
Pulled 3 Neon variables into .env.local
Postgres DATABASE_URL, DATABASE_URL_UNPOOLED
Branch NEON_BRANCH

neon inspect db table-sizes --branch production
No user tables found.
```

## Alterações

- Prisma 6 preservado, com provider PostgreSQL, URL com pool para tráfego do app e URL direta para migrations, conforme o [guia de conexões Neon](https://neon.com/docs/connect/choose-connection).
- Carregamento de `.env.local`/`.env` da raiz independente do diretório usado pelo npm workspace. Variáveis explícitas do ambiente têm prioridade. Nenhuma credencial foi adicionada ao frontend.
- Migration inicial PostgreSQL com 15 tabelas, 10 CHECKs financeiros, chaves estrangeiras, índices e 27 triggers de isolamento/imutabilidade do histórico.
- Transações financeiras com isolamento Serializable; health check consulta o banco real. Removidos PRAGMAs SQLite da inicialização.
- Demonstração usa gravação em lote para reduzir idas ao banco remoto.
- Schema/migrations SQLite legados arquivados em `backend/prisma/sqlite/`, com cliente separado para manter o teste de migração antiga. Nenhum arquivo SQLite foi encontrado na instalação e nenhum dado SQLite foi importado.
- Testes PostgreSQL criam schemas aleatórios somente em uma branch de testes. `npm run test:neon` testa a aplicação por HTTP e verifica persistência diretamente no Neon; remove somente o tenant criado por essa execução.
- README, exemplo de ambiente e texto de persistência na interface atualizados.

## Ambiente de testes

Branch temporária `aurora-neon-validation-20261029` (`br-frosty-salad-b5cdjkk1`), criada a partir de `production` antes da migration. Expira em 30/10/2026 às 13:00, horário de São Paulo. Credenciais em `.env.test.local`, ignorado pelo Git. Cada suíte remove seu schema ao terminar.

## Falhas encontradas e resolvidas

- A primeira instalação dentro do sandbox falhou com `ENOTFOUND registry.npmjs.org`; a instalação com acesso de rede foi concluída. `npm ci` dentro do sandbox também falhou com `EPERM` ao criar links dos workspaces; a repetição fora dele instalou as dependências.
- O download inicial do engine Prisma foi bloqueado pelo DNS do sandbox; foi concluído com acesso de rede.
- Os primeiros testes expuseram resolução incorreta do schema em triggers usando pool: corrigida com `SET search_path FROM CURRENT` nas funções PostgreSQL.
- Prisma 6 não mapeava o erro PostgreSQL `23001` de RESTRICT para HTTP 409: as FKs usam NO ACTION imediato, preservando a proteção de histórico e o mapeamento P2003.
- O limite de 15 segundos da demonstração era insuficiente para gravações sequenciais remotas: gravação em lote e limite de 30 segundos.

## Pendência de dependências

`npm audit` retorna seis vulnerabilidades de severidade alta e zero críticas. O relatório completo está em `verification/neon-audit.json`. Afeta `@fastify/static`, `prisma`/dependências transitivas e `zod`; as correções propostas pelo npm exigem versões major. Essas atualizações não foram aplicadas nesta configuração do Neon.

## Resultados finais

Todos os comandos abaixo terminaram com código de saída 0.

```text
npm test
✔ API financeira integrada ao PostgreSQL
✔ Migração multi-tenant preserva usuários, sessões, saldos e histórico existentes
✔ Cadastro multi-tenant e isolamento de dados em PostgreSQL
ℹ tests 31
ℹ pass 31
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 160245.2358

npm run build
> npm run build -w backend && npm run build -w frontend
> tsc
> tsc -b && vite build
vite v6.4.5 building for production...
✓ 2325 modules transformed.
✓ built in 11.74s

node backend/scripts/prisma.mjs validate
The schema at prisma\schema.prisma is valid

npm run db:migrate
Datasource "db": PostgreSQL database "neondb", schema "public"
1 migration found in prisma/migrations
Applying migration `202610290002_postgres_init`
All migrations have been successfully applied.

npm start
> node dist/server.js
Server listening at http://127.0.0.1:3001

npm run test:neon
PASS HTTP 200 GET / (built React app)
PASS HTTP 200 GET /api/health
PASS HTTP 401 GET /api/accounts
PASS HTTP 201 POST /api/auth/register
PASS HTTP 201 POST /api/accounts
PASS HTTP 200 GET /api/categories
PASS HTTP 201 POST /api/transactions
PASS HTTP 200 GET /api/accounts
PASS real Neon PostgreSQL write/read: expense=1234, balance=8766
PASS persistence after database reconnect
PASS HTTP 200 POST /api/auth/logout
PASS HTTP 200 POST /api/auth/login
PASS HTTP 200 GET /api/me
PASS HTTP 200 GET /api/dashboard?month=2026-10
PASS HTTP 200 GET /api/export
PASS Neon Postgres service end to end
PASS test tenant cleaned up
```

As primeiras execuções do smoke test também corrigiram expectativas do próprio script: criação de conta retorna HTTP 201 e requisições sem corpo não devem declarar JSON. Os tenants de todas as tentativas foram removidos. Não houve falha pendente na configuração, no build ou nos testes finais. A verificação de interface foi o carregamento HTTP do frontend compilado; não incluiu interação visual automatizada em navegador.

## Hospedagem

O Postgres está no Neon. Este app preserva seu processo Fastify, que serve API e frontend compilado. `neon deploy` não publica esse processo Node nem fornece uma URL pública para a interface.
