# indicacao

SaaS White Label privado para indicacoes juridicas com Next.js (App Router), PostgreSQL e Docker.

## Requisitos

- Docker e Docker Compose
- Node.js 20+

## Configuracao de Ambiente

1. Use [.env.example](.env.example) como referencia.
2. Preencha somente o arquivo do cenario que sera executado.
3. Defina a chave mestre `DB_CONNECTION_MODE` (`local` ou `supabase`).
4. `PRIMARY_DB` segue aceito apenas por compatibilidade.
5. Valide antes de subir:

```bash
npm run env:validate:dev
npm run env:validate:prod-local
npm run env:validate:supabase
npm run env:validate:supabase-cloud
```

## Fluxo de Execucao e Deploy

### 1) Desenvolvimento (Windows + Docker local apenas para Postgres)

1. Configure [.env.dev](.env.dev) com os dados locais.
2. Suba somente o banco:

```bash
npm run dev:up
```

3. Rode o Next.js no host:

```bash
npm run dev
```

App em http://localhost:3000 e Postgres em localhost:5432.

### 2) Producao Linux (Next.js + Postgres em containers)

1. Configure [.env.prod.local](.env.prod.local).
2. Suba os containers:

```bash
npm run prod:up
```

3. Para redeploy completo com rebuild da imagem do Next.js:

```bash
npm run prod:deploy
```

### 3) Deploy com Supabase

#### 3.1 Linux com container Next.js + banco no Supabase

1. Configure [.env.prod.supabase](.env.prod.supabase) com DB_CONNECTION_MODE=supabase e SUPABASE_DATABASE_URL(_SCHEMA).
2. Suba o container do Next.js:

```bash
npm run supa:up
```

3. Para redeploy com rebuild:

```bash
npm run supa:deploy
```

#### 3.2 Vercel + Supabase

No projeto da Vercel, configure as variaveis:
- DB_CONNECTION_MODE=supabase
- SUPABASE_DATABASE_URL
- SUPER_ADMIN_KEY
- NEXT_PUBLIC_APP_URL

Opcionalmente valide as variaveis no ambiente local antes de publicar:

```bash
npm run env:validate:vercel
```

Neste modo nao e necessario Docker para a aplicacao.

#### 3.3 Acesso direto ao banco no site da Supabase (Cloud)

Para manter os cenarios atuais e tambem abrir o banco no dashboard web da Supabase:

1. Defina na `.env.prod.supabase`:
- `DB_CONNECTION_MODE=supabase`
- `SUPABASE_DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres`
- `SUPABASE_PROJECT_REF=<ref-do-projeto>`
2. Valide o ambiente:

```bash
npm run env:validate:supabase-cloud
```

3. Abra o SQL Editor no navegador:

```bash
npm run supa:cloud:open
```

Se quiser somente a URL (sem abrir navegador):

```bash
npm run supa:cloud:url
```

## Init (Supabase)

Use este fluxo para inicializar a base no Supabase com o schema `indicacao`.

1. Crie um projeto no Supabase.
2. Abra SQL Editor.
3. Execute o SQL abaixo para criar schema, tabelas e politicas RLS.
4. Em Project Settings > Database, copie a connection string.
5. Atualize a SUPABASE_DATABASE_URL no ambiente de deploy para apontar para o Supabase.
6. Para ambiente serverless, prefira conexao pooled (Supavisor) com `sslmode=require`.

```sql
create schema if not exists indicacao;
create extension if not exists pgcrypto;

create table if not exists indicacao.escritorios (
	id uuid primary key default gen_random_uuid(),
	nome_oficial varchar(255) not null default 'Aguardando Cadastro',
	slug varchar(120) unique,
	celular_responsavel varchar(30) not null unique,
	liberado_lista_positiva boolean not null default false,
	criado_em timestamptz not null default now()
);

create table if not exists indicacao.usuarios (
	id uuid primary key default gen_random_uuid(),
	escritorio_id uuid not null references indicacao.escritorios(id) on delete cascade,
	tipo varchar(20) not null check (tipo in ('advogado', 'agente')),
	nome varchar(150) default null,
	email varchar(150) default null,
	celular varchar(30) not null unique,
	hash_unico varchar(120) not null unique,
	senha_hash text default null,
	criado_em timestamptz not null default now()
);

create table if not exists indicacao.aplicativos (
	id uuid primary key default gen_random_uuid(),
	escritorio_id uuid not null references indicacao.escritorios(id) on delete cascade,
	nome_servico varchar(150) not null,
	url_destino text not null,
	criado_em timestamptz not null default now()
);

create table if not exists indicacao.agentes_aplicativos (
	agente_id uuid not null references indicacao.usuarios(id) on delete cascade,
	aplicativo_id uuid not null references indicacao.aplicativos(id) on delete cascade,
	criado_em timestamptz not null default now(),
	primary key (agente_id, aplicativo_id)
);

create table if not exists indicacao.leads (
	id uuid primary key default gen_random_uuid(),
	escritorio_id uuid not null references indicacao.escritorios(id) on delete cascade,
	agente_id uuid not null references indicacao.usuarios(id) on delete cascade,
	aplicativo_id uuid not null references indicacao.aplicativos(id) on delete cascade,
	whatsapp_lead varchar(30) not null,
	status varchar(20) not null default 'suspect' check (status in ('suspect', 'prospect', 'fechado')),
	pago_ao_agente boolean not null default false,
	localizacao_metadata jsonb default null,
	criado_em timestamptz not null default now()
);

alter table indicacao.escritorios enable row level security;
alter table indicacao.usuarios enable row level security;
alter table indicacao.aplicativos enable row level security;
alter table indicacao.agentes_aplicativos enable row level security;
alter table indicacao.leads enable row level security;

drop policy if exists p_escritorios_por_tenant on indicacao.escritorios;
create policy p_escritorios_por_tenant on indicacao.escritorios
using (id::text = current_setting('app.escritorio_id', true))
with check (id::text = current_setting('app.escritorio_id', true));

drop policy if exists p_usuarios_por_tenant on indicacao.usuarios;
create policy p_usuarios_por_tenant on indicacao.usuarios
using (escritorio_id::text = current_setting('app.escritorio_id', true))
with check (escritorio_id::text = current_setting('app.escritorio_id', true));

drop policy if exists p_aplicativos_por_tenant on indicacao.aplicativos;
create policy p_aplicativos_por_tenant on indicacao.aplicativos
using (escritorio_id::text = current_setting('app.escritorio_id', true))
with check (escritorio_id::text = current_setting('app.escritorio_id', true));

drop policy if exists p_leads_por_tenant on indicacao.leads;
create policy p_leads_por_tenant on indicacao.leads
using (escritorio_id::text = current_setting('app.escritorio_id', true))
with check (escritorio_id::text = current_setting('app.escritorio_id', true));

drop policy if exists p_agentes_aplicativos_por_tenant on indicacao.agentes_aplicativos;
create policy p_agentes_aplicativos_por_tenant on indicacao.agentes_aplicativos
using (
	exists (
		select 1
		from indicacao.usuarios u
		where u.id = agente_id
			and u.escritorio_id::text = current_setting('app.escritorio_id', true)
	)
)
with check (
	exists (
		select 1
		from indicacao.usuarios u
		where u.id = agente_id
			and u.escritorio_id::text = current_setting('app.escritorio_id', true)
	)
);

alter table indicacao.escritorios force row level security;
alter table indicacao.usuarios force row level security;
alter table indicacao.aplicativos force row level security;
alter table indicacao.agentes_aplicativos force row level security;
alter table indicacao.leads force row level security;
```

### Observacao Importante

Atualmente, parte do codigo ainda referencia o schema `indicacao` nas queries.
Se a base no Supabase for `indicacao`, alinhe o codigo para usar `indicacao` em todas as consultas SQL.

## Estrutura principal

- init.sql: schema indicacao, tabelas e RLS
- docker-compose.dev.yml: apenas Postgres para desenvolvimento local
- docker-compose.prod.local.yml: Next.js + Postgres em containers
- docker-compose.prod.supabase.yml: Next.js em container com banco Supabase
- src/lib/db.ts: resolucao de conexao por ambiente
- scripts/validate-env.cjs: validacao de variaveis por cenario
- scripts/open-supabase-dashboard.cjs: abre SQL Editor da Supabase Cloud por `SUPABASE_PROJECT_REF`

## Rodar init.sql
Get-Content scripts/init.sql | docker exec -i r2-postgres psql -U r2-user -d r2-database
