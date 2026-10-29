# Deploy com um repositório e um projeto Vercel

O `Dockerfile` na raiz compila React/Vite e Fastify na mesma imagem. A API serve o frontend na mesma origem e usa o Postgres já configurado no Neon. `vercel.json` seleciona o preset `container`; não crie projetos separados para `backend/` e `frontend/`.

## Vercel

1. Envie esta pasta inteira para **um repositório Git** no GitHub, GitLab ou Bitbucket. Não envie `.env.local`, `.env.test.local`, `.neon` ou `node_modules`.
2. Importe esse repositório em **um projeto Vercel**. Deixe **Root Directory na raiz (`.`)**. Use o preset **Container**, definido também no `vercel.json`. Remova overrides antigos de Build Command/Output Directory; o Dockerfile executa o build e serve os arquivos.
3. Em Settings → Environment Variables, configure:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL com pool do Neon; copie de `.env.local` |
| `DATABASE_URL_UNPOOLED` | URL direta do mesmo banco Neon; copie de `.env.local` |
| `PORT` | `3001` (a Vercel deve encaminhar para a porta usada pelo servidor) |
| `HOST` | `0.0.0.0` |
| `NODE_ENV` | `production` |
| `CRON_SECRET` | Segredo aleatório de pelo menos 32 bytes |
| `RECURRENCE_SCHEDULER` | `external` |
| `RUN_MIGRATIONS` | `true` |

Gere um segredo com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` e salve-o somente no painel. As URLs do banco também ficam nas variáveis da Vercel; não precisam ir ao repositório nem são embutidas na imagem.

4. Faça o deploy. Ao iniciar, o container executa `prisma migrate deploy` pela URL direta e inicia o Fastify. Migrations novas são aplicadas uma vez; instâncias posteriores verificam o histórico de migrations. Uma falha na migration impede que a instância sirva a aplicação. Esse passo aumenta o tempo de inicialização. Para pipelines com um release job separado, aplique `npm run db:migrate` nesse job e configure `RUN_MIGRATIONS=false` no container.
5. Abra `/api/health` na URL publicada. A resposta esperada é `{"data":{"status":"ok","database":"postgresql"}}`. Depois crie uma conta e confirme uma gravação financeira.

O cron de produção chama `GET /api/internal/recurrences` diariamente às 06:00 UTC (03:00 em São Paulo). A Vercel envia `Authorization: Bearer <CRON_SECRET>`; a rota rejeita chamadas sem esse segredo. A agenda diária funciona também no plano Hobby, cujo horário pode variar dentro da hora agendada. O botão de atualização manual continua disponível. O timer local não é usado na Vercel porque suas instâncias podem ser suspensas.

Use uma **branch Neon separada para Preview** e configure as URLs dessa branch no ambiente Preview da Vercel. Com `RUN_MIGRATIONS=true`, cada ambiente aplica as migrations ao banco apontado por suas próprias variáveis. Use a branch `production` apenas nas variáveis de Production.

O runtime Container da Vercel está em beta. A configuração foi preparada segundo a documentação atual; a publicação na conta Vercel ainda precisa ser executada. Um repositório Git e um projeto Vercel são recursos diferentes: a Vercel importa o repositório e publica suas alterações.

## Servidor com Docker Compose

Use o mesmo repositório e mantenha `.env.local` no servidor com as duas URLs Neon:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

O app fica na porta 3001. Para usar outra porta externa, defina `APP_PORT`. Em produção, coloque um proxy HTTPS na frente; o cookie de sessão usa `Secure` com `NODE_ENV=production`.

Para verificar localmente por HTTP, use temporariamente `NODE_ENV=development` no ambiente do Compose (no PowerShell: `$env:NODE_ENV='development'`). Depois remova essa variável antes de publicar.

O Postgres permanece no Neon; nenhum container de banco ou volume local é necessário. No servidor com processo contínuo, as recorrências executam na inicialização e a cada hora.

## Verificação local da imagem

```bash
docker build -t aurora-financas .
# Linux/macOS:
NODE_ENV=development APP_PORT=3002 docker compose up -d
# PowerShell:
$env:NODE_ENV='development'; $env:APP_PORT='3002'; docker compose up -d
```

Em outro terminal, configure `SMOKE_URL=http://127.0.0.1:3002` e execute `npm run test:neon`. O teste cria e remove apenas seus registros temporários. Em um container de produção, teste pelo domínio HTTPS para que o cookie seguro seja enviado.

Use Compose para ler `.env.local`: ele interpreta corretamente as aspas geradas pelo Neon. O `docker run --env-file` puro preserva essas aspas; se usar esse comando diretamente, forneça um arquivo com valores sem aspas ou passe as variáveis já carregadas no ambiente. No painel Vercel, cole as URLs sem as aspas externas.

## Referências

- [Docker na Vercel](https://vercel.com/kb/guide/docker)
- [Suporte a deploy de containers](https://vercel.com/kb/guide/does-vercel-support-docker-deployments)
- [Autenticação de Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Limites e precisão de Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
