# Docker e Vercel — 29/10/2026

## Configuração

- `Dockerfile` com estágios de build/runtime em Node 24 Debian, Prisma gerado para Linux e dependências de desenvolvimento removidas do runtime.
- Frontend compilado servido pelo Fastify: um repositório, uma imagem e um projeto Vercel.
- Processo executado como usuário `node`, porta configurável, healthcheck com consulta real ao Neon, desligamento via SIGTERM.
- `.dockerignore` exclui arquivos de ambiente, bancos locais, credenciais de ferramentas e artefatos de desenvolvimento. Nenhum segredo é necessário durante o build.
- `docker-entrypoint.sh` valida as duas URLs Neon, executa migrations pela conexão direta e inicia o servidor. Prisma CLI é dependência de runtime para esse passo.
- `vercel.json` seleciona `framework: container` e agenda recorrências por um cron diário autenticado. Instâncias Vercel não dependem de um timer que pode ser suspenso.
- `compose.yaml` permite executar a mesma imagem em um servidor com Docker; `.gitattributes` preserva LF no script de entrada.
- `DEPLOY.md` descreve a importação de um único repositório, as variáveis da Vercel e a separação de bancos Production/Preview.

## Validações concluídas

```text
npm test
tests 32
pass 32
fail 0

npm run build
tsc
tsc -b && vite build
✓ built in 5.87s

docker compose config --quiet
exit code 0
```

O Docker Desktop local falhou ao iniciar o gerenciador de inferência com erro de acesso a `dockerInference`. Para testar o Dockerfile sem alterar essa instalação, foi iniciada a máquina Podman existente. A validação da imagem usa esse runtime compatível com Docker. A publicação na conta Vercel não foi executada.

```text
podman build --format docker -t aurora-financas:validation .
✓ built in 3.69s
Successfully tagged localhost/aurora-financas:validation
Image: f64d064618b71ea683526b4b8d07c8068fc49f51fccb5b8cc2bc256594319dc2

Verificação do filesystem e usuário da imagem:
PASS no credential files; uid=1000

Inicialização com URLs da branch temporária de testes:
Applying migration `202610290002_postgres_init`
All migrations have been successfully applied.
Server listening at http://127.0.0.1:3001

SMOKE_URL=http://127.0.0.1:3002
node --env-file=.env.test.local backend/scripts/smoke-neon.mjs
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

Verificações adicionais:
PASS container cron rejects unauthenticated requests and accepts its secret
PASS React Router fallback /dashboard

podman healthcheck run aurora-container-validation
exit code 0
```

A primeira tentativa de iniciar o container com `--env-file` bruto falhou porque as aspas externas do arquivo Neon foram preservadas na URL. A execução bem-sucedida carregou `.env.test.local` pelo Node e passou somente os nomes das variáveis ao runtime, sem imprimir seus valores. `DEPLOY.md` recomenda Compose, que interpreta essas aspas, ou URLs sem aspas externas no painel Vercel. A primeira imagem no formato OCI omitiu o healthcheck; a imagem final foi construída no formato Docker e seu healthcheck foi executado com sucesso.

Todos os dados do smoke test foram removidos. O container de validação foi encerrado após os testes. As seis vulnerabilidades altas de dependências já registradas em `neon-audit.json` continuam presentes; esta alteração não atualizou versões major.
