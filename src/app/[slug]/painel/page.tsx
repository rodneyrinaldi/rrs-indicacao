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
  agente_tipo: "agente" | "advogado";
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

    if (actor?.tipo === "advogado") {
      const lawyerRows = await query<AgentData>(
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
            AND u.id = $2
            AND u.tipo = 'advogado'
          LIMIT 1
        `,
        [slug, actor.userId],
      );

      agent = lawyerRows[0] ?? null;
    } else if (actor?.tipo === "agente") {
      const agentBySessionRows = await query<AgentData>(
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

  const allowed =
    agent.agente_tipo === "advogado"
      ? await query<AllowedApp>(
          `
            SELECT a.id, a.nome_servico
            FROM indicacao.aplicativos a
            WHERE a.escritorio_id = $1
              AND a.id::text = $2
            LIMIT 1
          `,
          [agent.escritorio_id, appId],
        )
      : await query<AllowedApp>(
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

    if (actor?.tipo === "advogado") {
      const lawyerRows = await query<AgentData>(
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
            AND u.id = $2
            AND u.tipo = 'advogado'
          LIMIT 1
        `,
        [slug, actor.userId],
      );

      agent = lawyerRows[0] ?? null;
    } else if (actor?.tipo === "agente") {
      const agentBySessionRows = await query<AgentData>(
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
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
        <section className="w-full rounded-xl border border-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Acesso ao Painel</h1>
          <p className="mt-2 text-sm text-slate-600">
            Use o link de onboarding ou faca login como inquilino para acessar o painel.
          </p>
        </section>
      </main>
    );
  }

  const blockingState = getBlockingState(new Date(), agent.liberado_lista_positiva);

  if (blockingState === "blocked") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
        <section className="w-full rounded-xl border border-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Conta suspensa</h1>
          <p className="mt-2 text-sm text-slate-600">
            Seu escritorio esta bloqueado por lista positiva. Contate o administrador.
          </p>
        </section>
      </main>
    );
  }

  const apps =
    agent.agente_tipo === "advogado"
      ? await query<AllowedApp>(
          `
            SELECT a.id, a.nome_servico
            FROM indicacao.aplicativos a
            WHERE a.escritorio_id = $1
            ORDER BY a.nome_servico ASC
          `,
          [agent.escritorio_id],
        )
      : await query<AllowedApp>(
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
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      {blockingState === "warning" && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Aviso: este escritorio esta fora da lista positiva. No dia 4 o acesso sera bloqueado.
        </div>
      )}

      <section className="rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Novo Envio por WhatsApp</h1>
        <p className="mt-2 text-sm text-slate-600">
          Informe o WhatsApp do prospect e escolha um servico autorizado.
        </p>

        <form action={registrarLead} className="mt-8 space-y-5">
          <input type="hidden" name="slug" value={slug} />
          {hash && <input type="hidden" name="hash" value={hash} />}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Servico juridico</span>
            <select
              name="appId"
              required
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
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
            <span className="mb-2 block text-sm font-medium text-slate-700">WhatsApp do prospect</span>
            <PhoneInput
              name="whatsappLead"
              required
              placeholder="(11)91222-7040"
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
            />
          </label>

          <button
            type="submit"
            disabled={apps.length === 0}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Enviar
          </button>
        </form>
      </section>
    </main>
  );
}
