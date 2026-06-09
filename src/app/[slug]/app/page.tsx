import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { CopyableLink } from "@/components/copyable-link";
import { clearActorSession, getCurrentActor } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/app-url";
import { query, runAsTenant } from "@/lib/db";
import { createPhoneChangeRequest } from "@/lib/phone-change";
import { formatPhone, normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

type OfficeRow = {
  id: string;
  nome_oficial: string;
  slug: string;
  celular_responsavel: string;
  liberado_lista_positiva: boolean;
};

type DashboardSummary = {
  total: number;
  suspects: number;
  prospects: number;
  fechados: number;
};

type LeadStatus = "suspect" | "prospect" | "fechado";

type RecentLead = {
  id: string;
  agente_nome: string | null;
  nome_servico: string;
  whatsapp_lead: string;
  status: LeadStatus;
  criado_em: string;
};

type LawyerProfile = {
  nome: string | null;
  email: string | null;
  celular: string | null;
};

type ServiceLink = {
  id: string;
  nome_servico: string;
  url_destino: string;
};

type TenantAgent = {
  id: string;
  nome: string | null;
  email: string | null;
  celular: string;
  hash_unico: string;
  senha_hash: string | null;
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
      return "Nao foi possivel identificar o usuario alvo para a troca.";
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

async function logoutLawyer(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");

  if (typeof slug !== "string") {
    throw new Error("Slug invalido");
  }

  await clearActorSession();
  redirect(`/${slug}/login`);
}

async function getLawyerOfficeForSlug(slug: string): Promise<{ officeId: string }> {
  const actor = await getCurrentActor();

  if (actor?.tipo !== "advogado" || !actor.escritorioId) {
    throw new Error("Nao autorizado");
  }

  const officeRows = await query<{ id: string }>(
    `
      SELECT id
      FROM indicacao.escritorios
      WHERE slug = $1
        AND id = $2
      LIMIT 1
    `,
    [slug, actor.escritorioId],
  );

  const office = officeRows[0];

  if (!office) {
    throw new Error("Escritorio invalido");
  }

  return { officeId: office.id };
}

function normalizeServiceUrl(input: string): string {
  const value = input.trim();

  if (!value) {
    throw new Error("URL obrigatoria");
  }

  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL deve iniciar com http:// ou https://");
  }

  return url.toString();
}

async function createServiceLink(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const nomeServico = formData.get("nomeServico");
  const urlDestino = formData.get("urlDestino");

  if (typeof slug !== "string" || typeof nomeServico !== "string" || typeof urlDestino !== "string") {
    throw new Error("Formulario invalido");
  }

  const serviceName = nomeServico.trim();
  if (!serviceName) {
    throw new Error("Nome do servico obrigatorio");
  }

  const normalizedUrl = normalizeServiceUrl(urlDestino);
  const { officeId } = await getLawyerOfficeForSlug(slug);

  await query(
    `
      INSERT INTO indicacao.aplicativos (escritorio_id, nome_servico, url_destino)
      VALUES ($1, $2, $3)
    `,
    [officeId, serviceName, normalizedUrl],
  );

  revalidatePath(`/${slug}/app`);
  revalidatePath(`/${slug}/painel`);
}

async function updateServiceLink(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const appId = formData.get("appId");
  const nomeServico = formData.get("nomeServico");
  const urlDestino = formData.get("urlDestino");

  if (
    typeof slug !== "string" ||
    typeof appId !== "string" ||
    typeof nomeServico !== "string" ||
    typeof urlDestino !== "string"
  ) {
    throw new Error("Formulario invalido");
  }

  const serviceName = nomeServico.trim();
  if (!serviceName) {
    throw new Error("Nome do servico obrigatorio");
  }

  const normalizedUrl = normalizeServiceUrl(urlDestino);
  const { officeId } = await getLawyerOfficeForSlug(slug);

  await query(
    `
      UPDATE indicacao.aplicativos
      SET nome_servico = $1,
          url_destino = $2
      WHERE id = $3
        AND escritorio_id = $4
    `,
    [serviceName, normalizedUrl, appId, officeId],
  );

  revalidatePath(`/${slug}/app`);
  revalidatePath(`/${slug}/painel`);
}

async function deleteServiceLink(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const appId = formData.get("appId");

  if (typeof slug !== "string" || typeof appId !== "string") {
    throw new Error("Formulario invalido");
  }

  const { officeId } = await getLawyerOfficeForSlug(slug);

  await query(
    `
      DELETE FROM indicacao.aplicativos
      WHERE id = $1
        AND escritorio_id = $2
    `,
    [appId, officeId],
  );

  revalidatePath(`/${slug}/app`);
  revalidatePath(`/${slug}/painel`);
}

async function createAgent(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const celular = formData.get("celular");

  if (typeof slug !== "string" || typeof celular !== "string") {
    throw new Error("Formulario invalido");
  }

  const normalizedPhone = normalizePhone(celular);
  if (!normalizedPhone) {
    throw new Error("Celular invalido");
  }

  const { officeId } = await getLawyerOfficeForSlug(slug);
  const hashUnico = randomUUID();

  await runAsTenant(officeId, async (client) => {
    const createdAgent = await client.query<{ id: string }>(
      `
        INSERT INTO indicacao.usuarios (escritorio_id, tipo, celular, hash_unico)
        VALUES ($1, 'agente', $2, $3)
        RETURNING id
      `,
      [officeId, normalizedPhone, hashUnico],
    );

    const agentId = createdAgent.rows[0]?.id;
    if (!agentId) {
      throw new Error("Nao foi possivel criar o agente");
    }

    await client.query(
      `
        INSERT INTO indicacao.agentes_aplicativos (agente_id, aplicativo_id)
        SELECT $1, a.id
        FROM indicacao.aplicativos a
        WHERE a.escritorio_id = $2
        ON CONFLICT (agente_id, aplicativo_id) DO NOTHING
      `,
      [agentId, officeId],
    );
  });

  revalidatePath(`/${slug}/app`);
  revalidatePath(`/${slug}/painel`);
}

async function updateLeadStatus(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const leadId = formData.get("leadId");
  const status = formData.get("status");

  if (typeof slug !== "string" || typeof leadId !== "string" || typeof status !== "string") {
    throw new Error("Formulario invalido");
  }

  const allowedStatuses: LeadStatus[] = ["suspect", "prospect", "fechado"];

  if (!allowedStatuses.includes(status as LeadStatus)) {
    throw new Error("Status invalido");
  }

  const { officeId } = await getLawyerOfficeForSlug(slug);

  await query(
    `
      UPDATE indicacao.leads
      SET status = $1
      WHERE id = $2
        AND escritorio_id = $3
    `,
    [status, leadId, officeId],
  );

  revalidatePath(`/${slug}/app`);
  revalidatePath(`/${slug}/agente/app`);
}

async function requestPhoneChange(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const usuarioAlvoId = formData.get("usuarioAlvoId");
  const celularNovo = formData.get("celularNovo");

  if (typeof slug !== "string" || typeof usuarioAlvoId !== "string" || typeof celularNovo !== "string") {
    throw new Error("Formulario invalido");
  }

  const actor = await getCurrentActor();

  if (actor?.tipo !== "advogado" || !actor.userId) {
    redirect(`/${slug}/login`);
  }

  const { officeId } = await getLawyerOfficeForSlug(slug);

  try {
    const requestResult = await createPhoneChangeRequest({
      escritorioId: officeId,
      solicitanteId: actor.userId,
      usuarioAlvoId,
      celularNovo,
    });

    redirect(
      `/${slug}/app?trocaUsuarioId=${encodeURIComponent(usuarioAlvoId)}&trocaToken=${encodeURIComponent(requestResult.token)}`,
    );
  } catch (error) {
    const errorCode = mapPhoneChangeError(error);
    redirect(`/${slug}/app?trocaUsuarioId=${encodeURIComponent(usuarioAlvoId)}&trocaErro=${errorCode}`);
  }
}

export default async function LawyerAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ data?: string; trocaToken?: string; trocaUsuarioId?: string; trocaErro?: string }>;
}) {
  const { slug } = await params;
  const { data, trocaToken, trocaUsuarioId, trocaErro } = await searchParams;
  const selectedDate = normalizeFilterDate(data);

  const offices = await query<OfficeRow>(
    `
      SELECT id, nome_oficial, slug, celular_responsavel, liberado_lista_positiva
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
  if (actor?.tipo !== "advogado" || actor.escritorioId !== office.id) {
    redirect(`/${slug}/login`);
  }

  const dashboard = await runAsTenant(office.id, async (client) => {
    const summaryResult = await client.query<DashboardSummary>(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'suspect')::int AS suspects,
          COUNT(*) FILTER (WHERE status = 'prospect')::int AS prospects,
          COUNT(*) FILTER (WHERE status = 'fechado')::int AS fechados
        FROM indicacao.leads
      `,
    );

    const recentResult = await client.query<RecentLead>(
      `
        SELECT
          l.id,
          u.nome AS agente_nome,
          a.nome_servico,
          l.whatsapp_lead,
          l.status,
          l.criado_em::text
        FROM indicacao.leads l
        INNER JOIN indicacao.usuarios u ON u.id = l.agente_id
        INNER JOIN indicacao.aplicativos a ON a.id = l.aplicativo_id
        WHERE (
          $1::date IS NULL
          OR (
            l.criado_em >= ($1::date - INTERVAL '30 days')
            AND l.criado_em < ($1::date + INTERVAL '1 day')
          )
        )
        ORDER BY l.criado_em DESC
      `,
      [selectedDate],
    );

    const profileResult = await client.query<LawyerProfile>(
      `
        SELECT nome, email, celular
        FROM indicacao.usuarios
        WHERE id = $1
          AND tipo = 'advogado'
        LIMIT 1
      `,
      [actor.userId],
    );

    const servicesResult = await client.query<ServiceLink>(
      `
        SELECT id, nome_servico, url_destino
        FROM indicacao.aplicativos
        ORDER BY criado_em DESC
      `,
    );

    const agentsResult = await client.query<TenantAgent>(
      `
        SELECT id, nome, email, celular, hash_unico, senha_hash
        FROM indicacao.usuarios
        WHERE tipo = 'agente'
        ORDER BY criado_em DESC
      `,
    );

    return {
      summary: summaryResult.rows[0] ?? { total: 0, suspects: 0, prospects: 0, fechados: 0 },
      recentLeads: recentResult.rows,
      profile: profileResult.rows[0] ?? null,
      services: servicesResult.rows,
      agents: agentsResult.rows,
    };
  });

  const baseUrl = await getRequestBaseUrl();
  const lawyerLoginLink = `${baseUrl}/${slug}/login`;
  const tenantSendPanelLink = `${baseUrl}/${slug}/painel`;
  const phoneChangeLink = trocaToken ? `${baseUrl}/confirmar-telefone/${trocaToken}` : null;
  const phoneChangeError = getPhoneChangeErrorMessage(trocaErro);

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 py-8">
      <header className="mb-6 rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-300">Inquilino</p>
        <h1 className="mt-2 text-2xl font-semibold">{office.nome_oficial}</h1>
        <p className="mt-2 text-sm text-slate-200">App pronto para uso em celular (PWA).</p>
        <form action={logoutLawyer} className="mt-4">
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            className="rounded-md border border-slate-500 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Sair
          </button>
        </form>
      </header>

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

      <section className="mb-5 rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Dados do Inquilino</h2>
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

        <form action={requestPhoneChange} className="mt-4 grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="usuarioAlvoId" value={actor.userId} />
          <input
            name="celularNovo"
            required
            placeholder="Novo celular do inquilino"
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Gerar link de confirmacao
          </button>
        </form>

        {trocaUsuarioId === actor.userId && phoneChangeLink && (
          <div className="mt-3">
            <CopyableLink
              label="Link de confirmacao da troca do inquilino"
              href={phoneChangeLink}
              containerClassName="rounded-lg border border-blue-200 bg-blue-50 p-3"
            />
          </div>
        )}

        {trocaUsuarioId === actor.userId && phoneChangeError && (
          <p className="mt-3 text-sm text-red-700">{phoneChangeError}</p>
        )}
      </section>

      <section className="mb-5 rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Links do Escritorio</h2>

        <div className="mt-3">
          <CopyableLink label="Login do Inquilino" href={lawyerLoginLink} />
        </div>

        <div className="mt-3">
          <CopyableLink label="Painel de Envio" href={tenantSendPanelLink} />
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Servicos para Envio</h2>
        <p className="mt-2 text-sm text-slate-600">
          Cadastre os links que aparecerao no painel de envio por WhatsApp.
        </p>

        <form action={createServiceLink} className="mt-4 grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-3">
          <input type="hidden" name="slug" value={slug} />
          <input
            name="nomeServico"
            required
            placeholder="Nome do servico"
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <input
            name="urlDestino"
            type="url"
            required
            placeholder="https://seu-link.com"
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">
            Adicionar
          </button>
        </form>

        {dashboard.services.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Nenhum servico cadastrado ainda.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {dashboard.services.map((service) => (
              <li key={service.id} className="rounded-lg border border-slate-200 p-3">
                <form action={updateServiceLink} className="grid gap-3 md:grid-cols-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="appId" value={service.id} />
                  <input
                    name="nomeServico"
                    defaultValue={service.nome_servico}
                    required
                    className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <input
                    name="urlDestino"
                    type="url"
                    defaultValue={service.url_destino}
                    required
                    className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    Salvar
                  </button>
                </form>

                <form action={deleteServiceLink} className="mt-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="appId" value={service.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-5 rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Agentes de Indicacao</h2>
        <p className="mt-2 text-sm text-slate-600">
          Fluxo recomendado: 1) cadastre os servicos, 2) cadastre os agentes, 3) compartilhe o link
          de ativacao com cada agente para comecarem a cadastrar prospects.
        </p>

        <form action={createAgent} className="mt-4 grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-3">
          <input type="hidden" name="slug" value={slug} />
          <input
            name="celular"
            required
            placeholder="Celular do agente"
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">
            Cadastrar agente
          </button>
        </form>

        {dashboard.agents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Nenhum agente cadastrado ainda.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {dashboard.agents.map((agent) => {
              const activationLink = `${baseUrl}/ativar/${agent.hash_unico}`;
              const onboardingSendLink = `${baseUrl}/${slug}/painel?hash=${agent.hash_unico}`;
              const agentLoginLink = `${baseUrl}/${slug}/agente/login`;
              const agentActivityPanelLink = `${baseUrl}/${slug}/agente/app`;

              return (
                <li key={agent.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{agent.nome ?? "Agente sem nome"}</p>
                  <p className="text-xs text-slate-600">
                    {agent.email ?? "Email nao informado"} | {formatPhone(agent.celular)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Status: {agent.senha_hash ? "Ativo" : "Pendente de ativacao"}
                  </p>

                  <div className="mt-3 space-y-2">
                    <CopyableLink
                      label="Link de ativacao do agente"
                      href={activationLink}
                      containerClassName="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    />
                    <CopyableLink
                      label="Login do agente"
                      href={agentLoginLink}
                      containerClassName="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    />
                    <CopyableLink
                      label="Painel de atividades do agente"
                      href={agentActivityPanelLink}
                      containerClassName="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    />
                    <CopyableLink
                      label="Link de envio do agente (onboarding)"
                      href={onboardingSendLink}
                      containerClassName="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    />
                  </div>

                  <form
                    action={requestPhoneChange}
                    className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto]"
                  >
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="usuarioAlvoId" value={agent.id} />
                    <input
                      name="celularNovo"
                      required
                      placeholder="Novo celular do agente"
                      className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      Gerar link de confirmacao
                    </button>
                  </form>

                  {trocaUsuarioId === agent.id && phoneChangeLink && (
                    <div className="mt-2">
                      <CopyableLink
                        label="Link de confirmacao de troca do agente"
                        href={phoneChangeLink}
                        containerClassName="rounded-lg border border-blue-200 bg-blue-50 p-3"
                      />
                    </div>
                  )}

                  {trocaUsuarioId === agent.id && phoneChangeError && (
                    <p className="mt-2 text-sm text-red-700">{phoneChangeError}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Ultimas Indicacoes dos Agentes</h2>

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
            href={`/${slug}/app`}
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
          <p className="mt-3 text-sm text-slate-600">Ainda sem leads registrados.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dashboard.recentLeads.map((lead) => (
              <li key={lead.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{formatPhone(lead.whatsapp_lead)}</p>
                <p className="text-xs text-slate-600">Agente: {lead.agente_nome ?? "Nao informado"}</p>
                <p className="text-xs text-slate-600">Servico: {lead.nome_servico}</p>

                <form action={updateLeadStatus} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="leadId" value={lead.id} />
                  <select
                    name="status"
                    defaultValue={lead.status}
                    className="rounded-md border border-border px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="suspect">Suspect</option>
                    <option value="prospect">Prospect</option>
                    <option value="fechado">Fechado</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  >
                    Atualizar status
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
