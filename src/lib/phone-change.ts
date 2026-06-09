import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

type PhoneChangeRequestStatus = "pendente" | "confirmada" | "cancelada";

type PhoneChangeRow = {
  id: string;
  token_hash: string;
  status: PhoneChangeRequestStatus;
  expira_em: string;
  confirmado_em: string | null;
  celular_atual: string;
  celular_novo: string;
  usuario_alvo_id: string;
  usuario_tipo: "advogado" | "agente";
  escritorio_slug: string;
};

type ConfirmedChangeRow = {
  usuario_tipo: "advogado" | "agente";
  escritorio_slug: string;
  celular_novo: string;
};

async function ensurePhoneChangeTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS indicacao.solicitacoes_troca_celular (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      escritorio_id uuid NOT NULL REFERENCES indicacao.escritorios(id) ON DELETE CASCADE,
      solicitante_id uuid NOT NULL REFERENCES indicacao.usuarios(id) ON DELETE CASCADE,
      usuario_alvo_id uuid NOT NULL REFERENCES indicacao.usuarios(id) ON DELETE CASCADE,
      celular_atual varchar(30) NOT NULL,
      celular_novo varchar(30) NOT NULL,
      token_hash text NOT NULL UNIQUE,
      status varchar(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'cancelada')),
      expira_em timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
      confirmado_em timestamptz NULL,
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_solicitacoes_troca_celular_alvo_status
    ON indicacao.solicitacoes_troca_celular (usuario_alvo_id, status)
  `);
}

function validatePhone(input: string): string {
  const normalized = normalizePhone(input);

  if (normalized.length < 10 || normalized.length > 13) {
    throw new Error("Celular invalido");
  }

  return normalized;
}

export async function createPhoneChangeRequest(input: {
  escritorioId: string;
  solicitanteId: string;
  usuarioAlvoId: string;
  celularNovo: string;
}): Promise<{ token: string; celularAtual: string; celularNovo: string }> {
  await ensurePhoneChangeTable();

  const normalizedNewPhone = validatePhone(input.celularNovo);

  const targetRows = await query<{ celular: string }>(
    `
      SELECT celular
      FROM indicacao.usuarios
      WHERE id = $1
        AND escritorio_id = $2
      LIMIT 1
    `,
    [input.usuarioAlvoId, input.escritorioId],
  );

  const target = targetRows[0];

  if (!target) {
    throw new Error("Usuario alvo nao encontrado");
  }

  const normalizedCurrentPhone = normalizePhone(target.celular);

  if (normalizedCurrentPhone === normalizedNewPhone) {
    throw new Error("O novo numero deve ser diferente do atual");
  }

  const existingRows = await query<{ id: string }>(
    `
      SELECT id
      FROM indicacao.usuarios
      WHERE id <> $1
        AND regexp_replace(celular, '\\D', '', 'g') = $2
      LIMIT 1
    `,
    [input.usuarioAlvoId, normalizedNewPhone],
  );

  if (existingRows[0]) {
    throw new Error("Este numero ja esta em uso por outro usuario");
  }

  await query(
    `
      UPDATE indicacao.solicitacoes_troca_celular
      SET status = 'cancelada'
      WHERE usuario_alvo_id = $1
        AND status = 'pendente'
    `,
    [input.usuarioAlvoId],
  );

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(`phone-change:${token}`);

  await query(
    `
      INSERT INTO indicacao.solicitacoes_troca_celular (
        escritorio_id,
        solicitante_id,
        usuario_alvo_id,
        celular_atual,
        celular_novo,
        token_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      input.escritorioId,
      input.solicitanteId,
      input.usuarioAlvoId,
      normalizedCurrentPhone,
      normalizedNewPhone,
      tokenHash,
    ],
  );

  return {
    token,
    celularAtual: normalizedCurrentPhone,
    celularNovo: normalizedNewPhone,
  };
}

export async function getPhoneChangeRequestByToken(token: string): Promise<PhoneChangeRow | null> {
  await ensurePhoneChangeTable();

  const tokenHash = hashToken(`phone-change:${token}`);

  const rows = await query<PhoneChangeRow>(
    `
      SELECT
        s.id,
        s.token_hash,
        s.status,
        s.expira_em::text,
        s.confirmado_em::text,
        s.celular_atual,
        s.celular_novo,
        s.usuario_alvo_id,
        u.tipo AS usuario_tipo,
        e.slug AS escritorio_slug
      FROM indicacao.solicitacoes_troca_celular s
      INNER JOIN indicacao.usuarios u ON u.id = s.usuario_alvo_id
      INNER JOIN indicacao.escritorios e ON e.id = s.escritorio_id
      WHERE s.token_hash = $1
      LIMIT 1
    `,
    [tokenHash],
  );

  return rows[0] ?? null;
}

export async function confirmPhoneChangeByToken(token: string): Promise<ConfirmedChangeRow> {
  await ensurePhoneChangeTable();

  const tokenHash = hashToken(`phone-change:${token}`);

  const rows = await query<ConfirmedChangeRow>(
    `
      WITH pending AS (
        UPDATE indicacao.solicitacoes_troca_celular s
        SET status = 'confirmada',
            confirmado_em = now()
        WHERE s.token_hash = $1
          AND s.status = 'pendente'
          AND s.expira_em > now()
        RETURNING s.usuario_alvo_id, s.celular_novo
      ),
      updated_user AS (
        UPDATE indicacao.usuarios u
        SET celular = p.celular_novo
        FROM pending p
        WHERE u.id = p.usuario_alvo_id
        RETURNING u.tipo, u.escritorio_id, p.celular_novo
      )
      SELECT
        uu.tipo AS usuario_tipo,
        e.slug AS escritorio_slug,
        uu.celular_novo
      FROM updated_user uu
      INNER JOIN indicacao.escritorios e ON e.id = uu.escritorio_id
    `,
    [tokenHash],
  );

  const confirmed = rows[0];

  if (!confirmed) {
    throw new Error("Solicitacao invalida, expirada ou ja confirmada");
  }

  return confirmed;
}
