# indicacao

Projeto Next.js com tres cenarios suportados:

1. desenvolvimento no Windows com Postgres local em container
2. desenvolvimento no Windows usando o banco da Supabase na nuvem
3. producao na Vercel usando Supabase na nuvem

## Requisitos

- Node.js 20+
- Docker Desktop no Windows para o Postgres local

## Variaveis

O app usa uma convencao simples: sempre ler `DATABASE_URL`.
As queries do projeto usam schema explicito, por exemplo `indicacao.usuarios`.
Por isso a conexao nao precisa informar schema na URL.

Links absolutos usam esta prioridade:

- `NEXT_PUBLIC_APP_URL` (ou `APP_URL`) quando informado
- `VERCEL_URL` quando presente
- `https://indicacao.rrs.net.br` em producao
- `http://localhost:3000` em desenvolvimento

Use [.env.example](.env.example) como referencia.

## Desenvolvimento com Postgres local

1. Configure `.env.dev`.
2. Suba o banco local:

```bash
npm run db:up
```

3. Rode o app:

```bash
npm run dev
```

Comandos uteis:

```bash
npm run db:ps
npm run db:logs
npm run db:shell
npm run db:down
```

## Desenvolvimento com Supabase cloud

1. Configure `.env.prod.supabase`.
2. Rode o app:

```bash
npm run dev:supabase
```

Para validar o arquivo:

```bash
npm run env:validate:supabase
```

Para abrir o SQL Editor da Supabase:

```bash
npm run supa:cloud:open
```

## Producao na Vercel com Supabase

Cadastre estas variaveis na Vercel:

- `DATABASE_URL`
- `SUPER_ADMIN_KEY`

Opcional:

- `NEXT_PUBLIC_APP_URL` ou `APP_URL` para sobrescrever a URL base dos links.

Validacao local do formato esperado:

```bash
npm run vercel:check
```

Nao ha container de aplicacao em producao neste projeto.

## Init (Supabase)

Use este fluxo para inicializar a base no Supabase com o schema `indicacao`.

1. Crie um projeto no Supabase.
2. Abra SQL Editor.
3. Execute o SQL abaixo para criar schema, tabelas e politicas RLS.
4. Em Project Settings > Database, copie a connection string.
5. Atualize a DATABASE_URL no ambiente local ou na Vercel para apontar para o Supabase.
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

- docker-compose.yml: apenas Postgres para desenvolvimento local no Windows
- scripts/init.sql: bootstrap do banco local
- src/lib/db.ts: resolucao de conexao por ambiente
- scripts/validate-env.cjs: validacao de variaveis por cenario
- scripts/open-supabase-dashboard.cjs: abre SQL Editor da Supabase Cloud por `SUPABASE_PROJECT_REF`

## Rodar init.sql
Get-Content scripts/init.sql | docker exec -i r2-postgres psql -U r2-user -d r2-database
