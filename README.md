# Aurora — finanças pessoais

PWA mobile-first com múltiplos usuários e espaços financeiros isolados (multi-tenant). Frontend React + TypeScript + Vite + Tailwind, componentes Shadcn baseados em Radix, Lucide, Recharts, TanStack Query e React Router. Backend em Node.js + TypeScript + Fastify, Zod, Prisma 6 e **PostgreSQL no Neon**. Não utiliza localStorage ou sessionStorage.

## Executar

Para publicar frontend e API juntos, usando um repositório Git e um projeto Vercel com Docker, veja [DEPLOY.md](DEPLOY.md). O banco permanece no Neon.

Requisitos: Node.js **22 ou 24 LTS**, npm 10+, Linux/macOS/Windows e acesso ao projeto Neon.

```bash
npm ci
neon init -y --org-id org-royal-breeze-87377904 --project-id green-tree-96137932 --branch production --services postgres
neon deploy
npm run setup
npm run dev
```

- Aplicativo: http://localhost:5173
- API: http://localhost:3001/api
- Na tela de acesso, escolha **Criar conta** e informe nome, e-mail, senha (mínimo de 10 caracteres) e confirmação. Depois, use **Entrar** com e-mail e senha.
- O cadastro fica disponível para novas pessoas. Cada cadastro cria um tenant próprio e categorias editáveis, sem valores financeiros de outros usuários.
- Para explorar, clique em **Explorar demonstração** no dashboard ou em Configurações → Carregar demonstração. Essa opção exige uma base financeira vazia.

O `neon deploy` configura os serviços de `neon.ts` e grava `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `NEON_BRANCH` em `.env.local` na raiz (ou `.env`, se existir). O backend e os comandos Prisma carregam esses arquivos automaticamente, preservando variáveis já definidas no ambiente. Credenciais nunca são enviadas ao frontend.

O `setup` gera o Prisma Client e aplica migrations PostgreSQL versionadas. A aplicação usa a URL com pool; Prisma Migrate usa `directUrl = env("DATABASE_URL_UNPOOLED")`. O cliente Prisma tradicional atende o processo Fastify de longa duração e suas transações interativas. As operações financeiras usam isolamento `Serializable`; conflitos retornam HTTP 409 para uma nova tentativa.

### Produção no servidor

```bash
npm ci
neon env pull
npm run setup
npm run build
npm start
```

Acesse http://localhost:3001. O Fastify serve a API e o frontend compilado na mesma origem, incluindo as rotas do React Router. Use um proxy HTTPS para acesso remoto e configure `NODE_ENV=production` em `.env.local` ou no ambiente do host para ativar cookies seguros. Em produção, use exclusivamente a URL HTTPS; o cookie seguro não será enviado por HTTP.

O banco fica no Neon e independe do filesystem do servidor. O backend ainda precisa de um host que execute o processo Node/Fastify e seu job de recorrências; `neon deploy` provisiona o banco, mas não hospeda este frontend/backend. `npm start` serve o frontend compilado e a API na mesma origem.

```bash
npm test        # regras, integração PostgreSQL isolada e migração SQLite legada
npm run build   # TypeScript backend + frontend e compilação Vite
npm start       # http://localhost:3001
npm run test:neon # HTTP real -> Fastify -> Neon; limpa apenas o tenant criado no teste
```

## Funcionalidades

- Cadastro público com confirmação de senha, login/logout por e-mail e senha, sessão protegida e isolamento financeiro por tenant.
- Dashboard com oito indicadores, filtro mensal, gráficos reais de seis meses, últimas movimentações, contas, faturas, orçamento e investimentos.
- Contas: cadastro, cores/ícones, edição, arquivo, saldo inicial, transferências e ajustes com motivo no histórico.
- Transações: receitas/despesas, edição/exclusão, notas, previsto/efetivado, recorrência mensal, pesquisa, filtros por período/valor/conta/categoria e paginação.
- Categorias/subcategorias: CRUD, cores/ícones e orçamento mensal individual com alerta de limite ultrapassado.
- Cartões: limite utilizado/disponível, compras parceladas, edição em ciclos abertos, faturas passadas/futuras e pagamentos parciais/integrais com conta de origem.
- Investimentos: ativos, quantidade opcional, aportes/resgates vinculados a contas, atualização manual de valor, custo proporcional, lucro, rentabilidade, histórico e distribuição por classe.
- Relatórios: períodos de até cinco anos, receitas/despesas, patrimônio, investimentos, categorias, cartões, maiores despesas, fixas/variáveis e comprometimento da renda com a dívida de cartão.
- Configurações: perfil, aparência clara/escura salva no banco, exportação JSON, demonstração removível, instruções de instalação e logout.
- PWA: manifest, ícones PNG de 192/512 px e maskable, service worker exclusivo para interface estática, aviso offline, telas responsivas, sidebar e navegação inferior.

## Regras financeiras

**Dinheiro:** todos os valores financeiros na API e no banco são inteiros em centavos. Uma entrada `12345` representa R$ 123,45. Cada valor persistido tem limite de 2.000.000.000 centavos (R$ 20 milhões), compatível com os inteiros do Prisma. Quantidades de ativos podem ser fracionárias; valores monetários não são floats.

**Saldo:** saldo inicial representa a abertura do dia de referência. Somam-se somente movimentações efetivadas com data igual ou posterior a essa referência e até hoje. Movimentações previstas não alteram disponibilidade. Uma conta com histórico não permite mudar saldo inicial/data; use um ajuste auditável. Saldos negativos são permitidos. Arquivar preserva histórico e patrimônio; não zera o saldo.

**Transferência:** duas movimentações com o mesmo identificador de grupo são gravadas na mesma transação do banco. Não alteram receitas ou despesas e não podem ser apagadas individualmente. Contas de origem/destino precisam ser distintas e ativas.

**Cartão:** o total da compra é despesa na data da compra, sem afetar o banco. Parcelas criam obrigações mensais; o limite usado inclui todas as parcelas em aberto. O pagamento cria uma saída `INVOICE_PAYMENT`, reduzindo banco e obrigação em igual valor, sem uma nova despesa. O total das parcelas sempre é igual ao total da compra; centavos residuais são distribuídos nas primeiras parcelas.

**Ciclo da fatura:** o mês da fatura corresponde ao mês do fechamento. Compras **no dia de fechamento ou após ele** entram no próximo ciclo. Vencimento no mesmo dia ou antes do fechamento ocorre no mês seguinte. Dias 29/30/31 são ajustados ao último dia válido do mês. Exemplo: corte 25 e vencimento 5, compra em 24/10 vai para a fatura 10 com vencimento 05/11; compra em 25/10 vai para a fatura 11 com vencimento 05/12. Faturas mudam de situação pela data e pelos pagamentos, sem depender de um job. Não há juros, multas ou rotativo automáticos nesta versão.

**Histórico de cartão:** compras de faturas fechadas ou com pagamentos não podem ser alteradas/excluídas. Datas de corte/vencimento ficam preservadas após o cartão ter compras, para evitar recalcular histórico. Pagamentos não podem superar o saldo da fatura nem anteceder uma compra dela. Compras não podem ultrapassar o limite disponível. Pagamentos parciais são exibidos como vencidos após o vencimento.

**Investimentos:** após cadastrar o ativo, registre um aporte para transferir dinheiro de uma conta. Aportes e resgates não são consumo. Cada valorização informa o valor total da posição, não o lucro. Resgates reduzem o custo de aquisição proporcionalmente ao valor resgatado. A rentabilidade mostrada é nominal da posição remanescente (valor atual menos custo), sem anualização. Operações e valorizações exigem ordem cronológica; isso preserva o custo e a evolução histórica. Um contador sequencial relaciona valorizações às operações já incluídas, evitando duplicidade mesmo no mesmo instante. Operações vinculadas são preservadas para auditoria.

**Patrimônio:** disponibilidade de todas as contas + valor atual dos investimentos − todas as obrigações de cartão em aberto. A evolução mensal usa registros históricos até o fechamento de cada mês; meses ainda não encerrados usam a data de hoje. Os relatórios reconhecem compras integralmente na data de aquisição, não a cada parcela.

**Recorrências:** um lançamento pode ser modelo mensal. O servidor gera as ocorrências vencidas até hoje como **previstas**, na inicialização e a cada hora. Também há o botão Atualizar recorrências. A combinação modelo/data é única, portanto rodar o processo novamente não duplica ocorrências. Contas arquivadas não geram novas ocorrências. Remover/desativar a recorrência do modelo interrompe geração futura; ocorrências existentes permanecem para conferência. Confirme cada ocorrência após verificar seu pagamento. O dia é ajustado ao fim do mês sem perder o dia original do modelo.

**Orçamentos:** o limite pertence à categoria exata e ao mês escolhido. Subcategorias têm limites independentes; não são somadas ao orçamento da categoria principal. Zero remove um limite.

## Multi-tenancy e acesso

Nesta versão básica, **cada novo cadastro cria um tenant independente e seu proprietário**. Não há convite de membros, painel de administrador, escolha de organização ou compartilhamento entre usuários. O modelo Tenant é separado de User para permitir essa evolução no futuro.

- `Tenant` possui nome, ID e data de criação. `User`, contas, categorias, cartões e investimentos têm `tenantId` com chave estrangeira e índice.
- Transações, orçamentos, compras, parcelas, faturas, pagamentos, operações e valorizações herdam o espaço de seus pais. A API valida todos os IDs de origem/destino antes de gravar.
- Triggers PostgreSQL impedem vínculos entre tenants e transferência de histórico para outro tenant, mesmo em uma escrita direta no banco. CHECKs preservam as restrições financeiras anteriores.
- O cadastro cria tenant, usuário, categorias e sessão na mesma transação. E-mails são normalizados e únicos globalmente. Um cadastro inválido ou duplicado não deixa espaços órfãos.
- Dashboard, relatórios, exportações, recorrências e demonstrações são limitados ao tenant autenticado.
- O cache em memória do TanStack Query usa o tenant na chave e é limpo ao trocar de acesso. A interface envia `X-Aurora-Tenant` para detectar troca de sessão em outra aba; esse cabeçalho **não concede acesso** nem permite selecionar o tenant. Se não corresponder à sessão, a API exige novo acesso.
- `GET /api/me` retorna perfil, `tenantId` e `{ id, name }` do tenant. `GET /api/auth/status` retorna apenas `{ registrationEnabled: true }`, sem expor quantidade de usuários.
- `POST /api/auth/register` recebe `{ name, email, password }`, opcionalmente `tenantName`, e retorna HTTP **201** com o perfil e o cookie de sessão. Login recebe `{ email, password }` e retorna HTTP **200**. A confirmação de senha é validada na interface; a senha continua validada pelo backend.

### Instalações SQLite anteriores

O schema e as migrations SQLite foram preservados em `backend/prisma/sqlite/`, com teste de migração legado separado. O aplicativo agora usa exclusivamente PostgreSQL. Nenhum arquivo SQLite é apagado ou importado automaticamente. Para uma instalação com dados anteriores, faça backup e planeje uma importação explícita antes da troca de banco; não execute SQL SQLite no Neon.
## Persistência, autenticação e segurança

`DATABASE_URL` aponta para PostgreSQL com pool e TLS; `DATABASE_URL_UNPOOLED` aponta para o mesmo banco sem pool para migrations. Ambas ficam apenas no ambiente do servidor. `.env.local`, `.env` e `.neon` são ignorados pelo Git.

- Senha com scrypt e salt aleatório por usuário; nunca persistida em texto puro.
- Sessão com token aleatório de 256 bits; somente seu SHA-256 é armazenado no PostgreSQL.
- Cookie HttpOnly, SameSite Strict, Secure em produção; sessão de sete dias.
- Dados financeiros exigem sessão. O tenant é obtido no servidor a partir do usuário da sessão, nunca do corpo da requisição ou de um parâmetro de URL.
- Validação Zod, verificação de origem, limitação de tentativas de login, erros centralizados e respostas financeiras `Cache-Control: no-store`.
- Chaves estrangeiras, índices, unicidade de fatura/ciclo e parcelas, restrições de valores via CHECKs PostgreSQL e transações atômicas nas operações compostas.
- Transações PostgreSQL com isolamento Serializable; conflitos de escrita retornam HTTP 409. Atualize e tente novamente se houver conflito.
- Não existe sincronização financeira offline. O cache do service worker contém somente a interface estática. As consultas do TanStack Query ficam apenas na memória da aba.

Não há recuperação de senha por e-mail, autenticação multifator, integração bancária, importação de extratos, leitura de notas, cotações em tempo real ou cálculo fiscal nesta versão.

### Backup

Use `pg_dump` com `DATABASE_URL_UNPOOLED` para backups completos, e valide a restauração em outra branch. O Neon também oferece restauração dentro da janela de histórico do projeto. A exportação JSON pela interface facilita inspeção e portabilidade, mas não oferece restauração automática.
### Demonstração

Nenhum usuário ou senha padrão é criado. Dados de exemplo só são gravados quando solicitados, no mesmo PostgreSQL, com `demo=true` nas contas, cartões e ativos. Configurações → Remover demonstração remove esses registros e seu histórico, inclusive novas movimentações adicionadas neles. Havendo vínculo desses registros com ativos/cartões/transferências reais, a remoção é bloqueada para preservar consistência; arquive os exemplos. Registros reais separados são preservados.

## API REST

Sucesso: `{ "data": ... }`. Listagem de transações inclui `meta: { page, limit, total }`. Erro: `{ "error": { "message": "..." } }` com HTTP 400/401/403/404/409/429/500. Datas financeiras `YYYY-MM-DD`, meses `YYYY-MM`. Envie JSON e mantenha o cookie de sessão.

| Módulo | Endpoints |
| --- | --- |
| Acesso | `GET /api/auth/status`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` |
| Perfil | `GET/PATCH /api/me` |
| Contas | `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/:id`, `POST /api/accounts/:id/adjust` |
| Movimentações | `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/:id`, `POST /api/transfers` |
| Recorrências | `POST /api/recurrences/generate` |
| Categorias | `GET/POST /api/categories`, `PATCH/DELETE /api/categories/:id`, `PUT /api/categories/:id/budget` |
| Cartões | `GET/POST /api/cards`, `GET/PATCH/DELETE /api/cards/:id`, `POST /api/cards/:id/purchases` |
| Compras | `PATCH/DELETE /api/purchases/:id` |
| Faturas | `GET /api/invoices/:id`, `POST /api/invoices/:id/payments` |
| Investimentos | `GET/POST /api/investments`, `GET/PATCH/DELETE /api/investments/:id`, `POST /api/investments/:id/operations`, `POST /api/investments/:id/valuations` |
| Análises | `GET /api/dashboard?month=2026-10`, `GET /api/reports?from=2026-01&to=2026-10` |
| Dados | `GET /api/export`, `POST/DELETE /api/demo` |
| Saúde | `GET /api/health` |

`DELETE` arquiva contas/cartões/investimentos. Ajustes, transferências, operações e pagamentos são imutáveis para auditoria. Categorias com vínculos não podem ser removidas.

Filtros de transações: `page`, `limit` (1–100, padrão 20), `search`, `type`, `accountId`, `categoryId`, `from`, `to`, `min`, `max` (centavos) e `status`. Os demais cadastros são listados integralmente dentro do tenant autenticado.

Exemplo de despesa (IDs de conta/categoria retornados nos seus cadastros):

```json
{
  "description": "Supermercado",
  "amount": 15890,
  "type": "EXPENSE",
  "accountId": "id-da-conta",
  "categoryId": "id-da-categoria",
  "date": "2026-10-28",
  "status": "CONFIRMED",
  "fixed": false,
  "recurrence": null,
  "note": "Compras da semana"
}
```

## Estrutura

```text
backend/
  prisma/schema.prisma       # entidades e relacionamentos
  prisma/migrations/         # migrations SQL versionadas
  scripts/prisma.mjs         # carrega env da raiz para comandos Prisma
  src/app.ts                 # Fastify, segurança e tratamento de erros
  src/server.ts              # execução e job de recorrências
  src/finance.ts             # regras e cálculos puros
  src/validation.ts          # schemas Zod
  src/modules/               # auth, contas, cartões, investimentos, dashboard, demo
  src/*.test.ts              # testes unitários e integração real PostgreSQL
frontend/
  src/components/ui/         # Button e Dialog baseados em Shadcn/Radix
  src/context.tsx            # TanStack Query e contexto da interface
  src/forms.tsx              # formulários validados pela API
  src/dashboard.tsx          # visão consolidada
  src/*                      # telas de cada módulo, gráficos e estilos
  public/                    # manifest, service worker e ícones
```

## Verificação no Neon

Antes de `npm test`, crie uma branch dedicada e puxe suas credenciais:

```bash
neon branch create --name aurora-tests --parent production --no-secrets
neon env pull --branch aurora-tests --file .env.test.local --services postgres
npm test
```

Cada suíte cria e remove um schema aleatório nessa branch. Os testes rejeitam o endpoint de produção. Em CI, use `TEST_DATABASE_URL` e `TEST_DATABASE_URL_UNPOOLED` em vez do arquivo. A suíte cobre autenticação, isolamento, gravações, persistência, concorrência em pagamentos, cartões, investimentos, recorrências e demonstrações, além das regras puras e da migração SQLite legada.

`npm run test:neon` exige o app iniciado em `http://127.0.0.1:3001` (ou `SMOKE_URL`). Testa o frontend compilado por HTTP, saúde com consulta real, cadastro, sessão, despesa, saldo, leitura direta no Neon, persistência após reconexão, login, dashboard e exportação. Cria um tenant temporário e remove somente seus registros ao terminar.

