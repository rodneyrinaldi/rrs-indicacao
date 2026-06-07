CREATE SCHEMA IF NOT EXISTS indicacao;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS indicacao.escritorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_oficial VARCHAR(255) NOT NULL DEFAULT 'Aguardando Cadastro',
  slug VARCHAR(120) UNIQUE,
  celular_responsavel VARCHAR(30) NOT NULL UNIQUE,
  liberado_lista_positiva BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indicacao.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES indicacao.escritorios(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('advogado', 'agente')),
  nome VARCHAR(150) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  celular VARCHAR(30) NOT NULL UNIQUE,
  hash_unico VARCHAR(120) NOT NULL UNIQUE,
  senha_hash TEXT DEFAULT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indicacao.aplicativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES indicacao.escritorios(id) ON DELETE CASCADE,
  nome_servico VARCHAR(150) NOT NULL,
  url_destino TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indicacao.agentes_aplicativos (
  agente_id UUID NOT NULL REFERENCES indicacao.usuarios(id) ON DELETE CASCADE,
  aplicativo_id UUID NOT NULL REFERENCES indicacao.aplicativos(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agente_id, aplicativo_id)
);

CREATE TABLE IF NOT EXISTS indicacao.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES indicacao.escritorios(id) ON DELETE CASCADE,
  agente_id UUID NOT NULL REFERENCES indicacao.usuarios(id) ON DELETE CASCADE,
  aplicativo_id UUID NOT NULL REFERENCES indicacao.aplicativos(id) ON DELETE CASCADE,
  whatsapp_lead VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'suspect' CHECK (status IN ('suspect', 'prospect', 'fechado')),
  pago_ao_agente BOOLEAN NOT NULL DEFAULT false,
  localizacao_metadata JSONB DEFAULT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE indicacao.escritorios
SET celular_responsavel = regexp_replace(celular_responsavel, '\D', '', 'g')
WHERE celular_responsavel ~ '\D';

UPDATE indicacao.usuarios
SET celular = regexp_replace(celular, '\D', '', 'g')
WHERE celular ~ '\D';

UPDATE indicacao.leads
SET whatsapp_lead = regexp_replace(whatsapp_lead, '\D', '', 'g')
WHERE whatsapp_lead ~ '\D';

ALTER TABLE indicacao.escritorios
  DROP CONSTRAINT IF EXISTS escritores_celular_responsavel_digits_only;

ALTER TABLE indicacao.escritorios
  ADD CONSTRAINT escritores_celular_responsavel_digits_only
  CHECK (celular_responsavel ~ '^[0-9]+$');

ALTER TABLE indicacao.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_celular_digits_only;

ALTER TABLE indicacao.usuarios
  ADD CONSTRAINT usuarios_celular_digits_only
  CHECK (celular ~ '^[0-9]+$');

ALTER TABLE indicacao.leads
  DROP CONSTRAINT IF EXISTS leads_whatsapp_lead_digits_only;

ALTER TABLE indicacao.leads
  ADD CONSTRAINT leads_whatsapp_lead_digits_only
  CHECK (whatsapp_lead ~ '^[0-9]+$');

ALTER TABLE indicacao.escritorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicacao.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicacao.aplicativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicacao.agentes_aplicativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicacao.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_escritorios_por_tenant ON indicacao.escritorios;
CREATE POLICY p_escritorios_por_tenant ON indicacao.escritorios
USING (id::text = current_setting('app.escritorio_id', true))
WITH CHECK (id::text = current_setting('app.escritorio_id', true));

DROP POLICY IF EXISTS p_usuarios_por_tenant ON indicacao.usuarios;
CREATE POLICY p_usuarios_por_tenant ON indicacao.usuarios
USING (escritorio_id::text = current_setting('app.escritorio_id', true))
WITH CHECK (escritorio_id::text = current_setting('app.escritorio_id', true));

DROP POLICY IF EXISTS p_aplicativos_por_tenant ON indicacao.aplicativos;
CREATE POLICY p_aplicativos_por_tenant ON indicacao.aplicativos
USING (escritorio_id::text = current_setting('app.escritorio_id', true))
WITH CHECK (escritorio_id::text = current_setting('app.escritorio_id', true));

DROP POLICY IF EXISTS p_leads_por_tenant ON indicacao.leads;
CREATE POLICY p_leads_por_tenant ON indicacao.leads
USING (escritorio_id::text = current_setting('app.escritorio_id', true))
WITH CHECK (escritorio_id::text = current_setting('app.escritorio_id', true));

DROP POLICY IF EXISTS p_agentes_aplicativos_por_tenant ON indicacao.agentes_aplicativos;
CREATE POLICY p_agentes_aplicativos_por_tenant ON indicacao.agentes_aplicativos
USING (
  EXISTS (
    SELECT 1
    FROM indicacao.usuarios u
    WHERE u.id = agente_id
      AND u.escritorio_id::text = current_setting('app.escritorio_id', true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM indicacao.usuarios u
    WHERE u.id = agente_id
      AND u.escritorio_id::text = current_setting('app.escritorio_id', true)
  )
);

ALTER TABLE indicacao.escritorios FORCE ROW LEVEL SECURITY;
ALTER TABLE indicacao.usuarios FORCE ROW LEVEL SECURITY;
ALTER TABLE indicacao.aplicativos FORCE ROW LEVEL SECURITY;
ALTER TABLE indicacao.agentes_aplicativos FORCE ROW LEVEL SECURITY;
ALTER TABLE indicacao.leads FORCE ROW LEVEL SECURITY;
