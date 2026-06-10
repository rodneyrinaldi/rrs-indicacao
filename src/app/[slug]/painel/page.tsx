import { redirect } from "next/navigation";
import { PhoneInput } from "@/components/phone-input";
import { getAppBaseUrl } from "@/lib/app-url";
import { getCurrentActor } from "@/lib/auth";
import { getBlockingState } from "@/lib/billing-window";
import { query } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

type AgentData = {
  agente_id: string;
  agente_celular: string;
  escritorio_id: string;
  liberado_lista_positiva: boolean;
};

type AllowedApp = {
  id: string;
  nome_servico: string;
};

async function registrarLead(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const hash = formData.get("hash");
  const appId = formData.get("appId");
  const whatsappLead = formData.get("whatsappLead");

  if (
    typeof slug !== "string" ||
    typeof appId !== "string" ||
    typeof whatsappLead !== "string"
  ) {
    throw new Error("Formulario invalido");
  }

  let agent: AgentData | null = null;

  if (typeof hash === "string" && hash) {
    const agentRows = await query<AgentData>(
      `
        SELECT
          u.id AS agente_id,
          u.celular AS agente_celular,
          u.tipo AS agente_tipo,
          e.id AS escritorio_id,
          e.liberado_lista_positiva
        FROM indicacao.usuarios u
        INNER JOIN indicacao.escritorios e ON e.id = u.escritorio_id
        WHERE e.slug = $1
          AND u.hash_unico = $2
          AND u.tipo = 'agente'
        LIMIT 1
      `,
      [slug, hash],
    );

    agent = agentRows[0] ?? null;
  } else {
    const actor = await getCurrentActor();

    if (actor?.tipo === "agente") {
      const agentBySessionRows = await query<AgentData>(
        `
          SELECT
            u.id AS agente_id,
            u.celular AS agente_celular,
            e.id AS escritorio_id,
            e.liberado_lista_positiva
          FROM indicacao.usuarios u
          INNER JOIN indicacao.escritorios e ON e.id = u.escritorio_id
          WHERE e.slug = $1
            AND u.id = $2
            AND u.tipo = 'agente'
          LIMIT 1
        `,
        [slug, actor.userId],
      );

      agent = agentBySessionRows[0] ?? null;
    }
  }

  if (!agent) {
    throw new Error("Agente nao localizado");
  }

  if (getBlockingState(new Date(), agent.liberado_lista_positiva) === "blocked") {
    redirect(`/${slug}/painel?hash=${hash}`);
  }

  const allowed = await query<AllowedApp>(
    `
      SELECT a.id, a.nome_servico
      FROM indicacao.agentes_aplicativos aa
      INNER JOIN indicacao.aplicativos a ON a.id = aa.aplicativo_id
      WHERE aa.agente_id = $1
        AND a.id::text = $2
      LIMIT 1
    `,
    [agent.agente_id, appId],
  );

  if (!allowed[0]) {
    throw new Error("Servico nao permitido para este agente");
  }

  const normalizedLead = normalizePhone(whatsappLead);

  const inserted = await query<{ id: string }>(
    `
      INSERT INTO indicacao.leads (escritorio_id, agente_id, aplicativo_id, whatsapp_lead, status)
      VALUES ($1, $2, $3, $4, 'suspect')
      RETURNING id
    `,
    [agent.escritorio_id, agent.agente_id, appId, normalizedLead],
  );

  const leadId = inserted[0]?.id;

  if (!leadId) {
    throw new Error("Nao foi possivel criar o lead");
  }

  const serviceName = allowed[0].nome_servico;
  const baseUrl = getAppBaseUrl();
  const redirectUrl = `${baseUrl}/r/${slug}/${leadId}/${appId}`;

  const message = encodeURIComponent(
    `Ola! Segue o link do servico ${serviceName}: ${redirectUrl}`,
  );

  redirect(`https://wa.me/${normalizePhone(agent.agente_celular)}?text=${message}`);
}

export default async function PainelAgentePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ hash?: string }>;
}) {
  const { slug } = await params;
  const { hash } = await searchParams;

  let agent: AgentData | null = null;

  if (hash) {
    const agentRows = await query<AgentData>(
      `
        SELECT
          u.id AS agente_id,
          u.celular AS agente_celular,
          u.tipo AS agente_tipo,
          e.id AS escritorio_id,
          e.liberado_lista_positiva
        FROM indicacao.usuarios u
        INNER JOIN indicacao.escritorios e ON e.id = u.escritorio_id
        WHERE e.slug = $1
          AND u.hash_unico = $2
          AND u.tipo = 'agente'
        LIMIT 1
      `,
      [slug, hash],
    );

    agent = agentRows[0] ?? null;
  }

  if (!agent) {
    const actor = await getCurrentActor();

    if (actor?.tipo === "agente") {
      const agentBySessionRows = await query<AgentData>(
        `
          SELECT
            u.id AS agente_id,
            u.celular AS agente_celular,
            e.id AS escritorio_id,
            e.liberado_lista_positiva
          FROM indicacao.usuarios u
          INNER JOIN indicacao.escritorios e ON e.id = u.escritorio_id
          WHERE e.slug = $1
            AND u.id = $2
            AND u.tipo = 'agente'
          LIMIT 1
        `,
        [slug, actor.userId],
      );

      agent = agentBySessionRows[0] ?? null;
    }
  }

  if (!agent) {
    return (
      <main className="auth-shell">
        <section className="auth-card text-center">
          <h1 className="text-xl font-semibold tracking-tight">Acesso ao painel</h1>
          <p className="body-muted mt-2">
            Use o link de acesso do agente ou faca login como agente para acessar o painel.
          </p>
        </section>
      </main>
    );
  }

  const blockingState = getBlockingState(new Date(), agent.liberado_lista_positiva);

  if (blockingState === "blocked") {
    return (
      <main className="auth-shell">
        <section className="auth-card text-center">
          <h1 className="text-xl font-semibold tracking-tight">Conta suspensa</h1>
          <p className="body-muted mt-2">
            Seu escritorio esta bloqueado por lista positiva. Contate o administrador.
          </p>
        </section>
      </main>
    );
  }

  const apps = await query<AllowedApp>(
    `
      SELECT a.id, a.nome_servico
      FROM indicacao.agentes_aplicativos aa
      INNER JOIN indicacao.aplicativos a ON a.id = aa.aplicativo_id
      WHERE aa.agente_id = $1
      ORDER BY a.nome_servico ASC
    `,
    [agent.agente_id],
  );

  return (
    <main className="mx-auto min-h-[calc(100vh-84px)] max-w-2xl px-6 py-10">
      {blockingState === "warning" && (
        <div className="status-message status-message--info mb-4 mt-0">
          Aviso: este escritorio esta fora da lista positiva. No dia 4 o acesso sera bloqueado.
        </div>
      )}

      <section className="surface-card p-8">
        <p className="eyebrow">Envio rapido</p>
        <h1 className="title-lg">Novo envio por WhatsApp</h1>
        <p className="body-muted">
          Informe o WhatsApp do prospect e escolha um servico autorizado.
        </p>

        <form action={registrarLead} className="form-stack">
          <input type="hidden" name="slug" value={slug} />
          {hash && <input type="hidden" name="hash" value={hash} />}

          <label className="block">
            <span className="field-label">Servico juridico</span>
            <select
              name="appId"
              required
              className="input-control"
              defaultValue=""
            >
              <option value="" disabled>
                Selecione
              </option>
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.nome_servico}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">WhatsApp do prospect</span>
            <PhoneInput
              name="whatsappLead"
              required
              placeholder="(11)91222-7040"
              className="input-control"
            />
          </label>

          <button
            type="submit"
            disabled={apps.length === 0}
            className="primary-button w-full disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </form>
      </section>
    </main>
  );
}
