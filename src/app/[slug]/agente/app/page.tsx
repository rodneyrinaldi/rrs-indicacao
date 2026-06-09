import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CopyableLink } from "@/components/copyable-link";
import { clearActorSession, getCurrentActor } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/app-url";
import { query, runAsTenant } from "@/lib/db";
import { createPhoneChangeRequest } from "@/lib/phone-change";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

type OfficeRow = {
  id: string;
  nome_oficial: string;
};

type AgentProfile = {
  nome: string | null;
  email: string | null;
  celular: string;
};

type AgentSummary = {
  total: number;
  suspects: number;
  prospects: number;
  fechados: number;
};

type RecentLead = {
  id: string;
  nome_servico: string;
  whatsapp_lead: string;
  status: "suspect" | "prospect" | "fechado";
  criado_em: string;
};

type PhoneChangeErrorCode =
  | "celular-invalido"
  | "celular-em-uso"
  | "mesmo-numero"
  | "alvo-nao-encontrado"
  | "nao-autorizado"
  | "desconhecido";

function mapPhoneChangeError(error: unknown): PhoneChangeErrorCode {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Celular invalido")) {
    return "celular-invalido";
  }

  if (message.includes("ja esta em uso")) {
    return "celular-em-uso";
  }

  if (message.includes("diferente do atual")) {
    return "mesmo-numero";
  }

  if (message.includes("Usuario alvo nao encontrado")) {
    return "alvo-nao-encontrado";
  }

  if (message.includes("Nao autorizado")) {
    return "nao-autorizado";
  }

  return "desconhecido";
}

function getPhoneChangeErrorMessage(code: string | undefined): string | null {
  if (!code) {
    return null;
  }

  switch (code as PhoneChangeErrorCode) {
    case "celular-invalido":
      return "Informe um celular valido com DDD para gerar o link.";
    case "celular-em-uso":
      return "Este numero ja esta em uso por outro usuario.";
    case "mesmo-numero":
      return "O novo numero deve ser diferente do numero atual.";
    case "alvo-nao-encontrado":
      return "Nao foi possivel identificar o usuario para a troca.";
    case "nao-autorizado":
      return "Sua sessao nao tem permissao para solicitar esta troca.";
    default:
      return "Falha ao gerar o link de confirmacao. Tente novamente.";
  }
}

function normalizeFilterDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return value;
}

async function getRequestBaseUrl(): Promise<string> {
  const fallback = getAppBaseUrl();
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");

  if (!host) {
    return fallback;
  }

  const protocol =
    headersList.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${protocol}://${host}`.replace(/\/+$/, "");
}

async function logoutAgent(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");

  if (typeof slug !== "string") {
    throw new Error("Slug invalido");
  }

  await clearActorSession();
  redirect(`/${slug}/agente/login`);
}

async function requestOwnPhoneChange(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const celularNovo = formData.get("celularNovo");

  if (typeof slug !== "string" || typeof celularNovo !== "string") {
    throw new Error("Formulario invalido");
  }

  const actor = await getCurrentActor();

  if (actor?.tipo !== "agente" || !actor.userId || !actor.escritorioId) {
    redirect(`/${slug}/agente/login`);
  }

  try {
    const requestResult = await createPhoneChangeRequest({
      escritorioId: actor.escritorioId,
      solicitanteId: actor.userId,
      usuarioAlvoId: actor.userId,
      celularNovo,
    });

    redirect(`/${slug}/agente/app?trocaToken=${encodeURIComponent(requestResult.token)}`);
  } catch (error) {
    const errorCode = mapPhoneChangeError(error);
    redirect(`/${slug}/agente/app?trocaErro=${errorCode}`);
  }
}

export default async function AgentAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ data?: string; trocaToken?: string; trocaErro?: string }>;
}) {
  const { slug } = await params;
  const { data, trocaToken, trocaErro } = await searchParams;
  const selectedDate = normalizeFilterDate(data);

  const offices = await query<OfficeRow>(
    `
      SELECT id, nome_oficial
      FROM indicacao.escritorios
      WHERE slug = $1
      LIMIT 1
    `,
    [slug],
  );

  const office = offices[0];

  if (!office) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
        <section className="w-full rounded-xl border border-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Escritorio nao encontrado</h1>
          <p className="mt-2 text-sm text-slate-600">Valide o endereco informado para login.</p>
        </section>
      </main>
    );
  }

  const actor = await getCurrentActor();
  if (actor?.tipo !== "agente" || actor.escritorioId !== office.id) {
    redirect(`/${slug}/agente/login`);
  }

  const dashboard = await runAsTenant(office.id, async (client) => {
    const profileResult = await client.query<AgentProfile>(
      `
        SELECT nome, email, celular
        FROM indicacao.usuarios
        WHERE id = $1
          AND tipo = 'agente'
        LIMIT 1
      `,
      [actor.userId],
    );

    const summaryResult = await client.query<AgentSummary>(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'suspect')::int AS suspects,
          COUNT(*) FILTER (WHERE status = 'prospect')::int AS prospects,
          COUNT(*) FILTER (WHERE status = 'fechado')::int AS fechados
        FROM indicacao.leads
        WHERE agente_id = $1
      `,
      [actor.userId],
    );

    const recentResult = await client.query<RecentLead>(
      `
        SELECT l.id, a.nome_servico, l.whatsapp_lead, l.status, l.criado_em::text
        FROM indicacao.leads l
        INNER JOIN indicacao.aplicativos a ON a.id = l.aplicativo_id
        WHERE agente_id = $1
          AND (
            $2::date IS NULL
            OR (
              l.criado_em >= ($2::date - INTERVAL '30 days')
              AND l.criado_em < ($2::date + INTERVAL '1 day')
            )
          )
        ORDER BY criado_em DESC
      `,
      [actor.userId, selectedDate],
    );

    return {
      profile: profileResult.rows[0] ?? null,
      summary: summaryResult.rows[0] ?? { total: 0, suspects: 0, prospects: 0, fechados: 0 },
      recentLeads: recentResult.rows,
    };
  });

  const baseUrl = await getRequestBaseUrl();
  const painelEnvioLink = `${baseUrl}/${slug}/painel`;
  const phoneChangeLink = trocaToken ? `${baseUrl}/confirmar-telefone/${trocaToken}` : null;
  const phoneChangeError = getPhoneChangeErrorMessage(trocaErro);

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 py-8">
      <header className="mb-6 rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-300">Agente</p>
        <h1 className="mt-2 text-2xl font-semibold">{dashboard.profile?.nome ?? "Agente"}</h1>
        <p className="mt-2 text-sm text-slate-200">{office.nome_oficial}</p>
        <form action={logoutAgent} className="mt-4">
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            className="rounded-md border border-slate-500 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Sair
          </button>
        </form>
      </header>

      <section className="mb-5 rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Seus Dados</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="font-medium text-slate-600">Nome</dt>
            <dd className="text-slate-900">{dashboard.profile?.nome ?? "Nao informado"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Email</dt>
            <dd className="text-slate-900">{dashboard.profile?.email ?? "Nao informado"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Telefone</dt>
            <dd className="text-slate-900">
              {dashboard.profile?.celular ? formatPhone(dashboard.profile.celular) : "Nao informado"}
            </dd>
          </div>
        </dl>

        <form action={requestOwnPhoneChange} className="mt-4 grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-2">
          <input type="hidden" name="slug" value={slug} />
          <input
            name="celularNovo"
            required
            placeholder="Novo celular"
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Gerar link de confirmacao
          </button>
        </form>

        {phoneChangeLink && (
          <div className="mt-3">
            <CopyableLink
              label="Link de confirmacao de troca"
              href={phoneChangeLink}
              containerClassName="rounded-lg border border-blue-200 bg-blue-50 p-3"
            />
          </div>
        )}

        {phoneChangeError && <p className="mt-3 text-sm text-red-700">{phoneChangeError}</p>}
      </section>

      <section className="mb-5 rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Acesso ao Envio</h2>
        <p className="mt-2 text-sm text-slate-600">
          Use este link para abrir o formulario de envio de novos prospects.
        </p>
        <div className="mt-3">
          <CopyableLink label="Painel de envio para prospect" href={painelEnvioLink} />
        </div>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-3">
        <article className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Total de Leads</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard.summary.total}</p>
        </article>
        <article className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Fechados</p>
          <p className="mt-2 text-2xl font-semibold text-blue-700">{dashboard.summary.fechados}</p>
        </article>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-3">
        <article className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Suspects</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{dashboard.summary.suspects}</p>
        </article>
        <article className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Prospects</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{dashboard.summary.prospects}</p>
        </article>
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Todos os Prospects Indicados</h2>

        <form method="GET" className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            Data base
            <input
              type="date"
              name="data"
              defaultValue={selectedDate ?? ""}
              className="ml-2 rounded-md border border-border px-2 py-1 text-xs text-slate-700"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            Filtrar 30 dias
          </button>
          <a
            href={`/${slug}/agente/app`}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Limpar
          </a>
        </form>

        {selectedDate && (
          <p className="mt-2 text-xs text-slate-600">
            Exibindo indicacoes de 30 dias ate {new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString("pt-BR")}
          </p>
        )}

        {dashboard.recentLeads.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nenhum lead enviado ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dashboard.recentLeads.map((lead) => (
              <li key={lead.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{formatPhone(lead.whatsapp_lead)}</p>
                <p className="text-xs text-slate-600">Servico: {lead.nome_servico}</p>
                <p className="text-xs uppercase text-slate-500">{lead.status}</p>
                <p className="text-xs text-slate-500">
                  {new Date(lead.criado_em).toLocaleString("pt-BR")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
