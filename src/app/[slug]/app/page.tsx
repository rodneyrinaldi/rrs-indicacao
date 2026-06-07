import { redirect } from "next/navigation";
import { CopyableLink } from "@/components/copyable-link";
import { clearActorSession, getCurrentActor } from "@/lib/auth";
import { query, runAsTenant } from "@/lib/db";
import { formatPhone } from "@/lib/phone";

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

type RecentLead = {
  id: string;
  whatsapp_lead: string;
  status: "suspect" | "prospect" | "fechado";
  criado_em: string;
};

async function logoutLawyer(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");

  if (typeof slug !== "string") {
    throw new Error("Slug invalido");
  }

  await clearActorSession();
  redirect(`/${slug}/login`);
}

export default async function LawyerAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
        SELECT id, whatsapp_lead, status, criado_em::text
        FROM indicacao.leads
        ORDER BY criado_em DESC
        LIMIT 5
      `,
    );

    return {
      summary: summaryResult.rows[0] ?? { total: 0, suspects: 0, prospects: 0, fechados: 0 },
      recentLeads: recentResult.rows,
    };
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const lawyerLoginLink = `${baseUrl}/${slug}/login`;
  const agentPanelLink = `${baseUrl}/${slug}/painel`;

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
        <h2 className="text-base font-semibold text-slate-900">Links do Escritorio</h2>

        <div className="mt-3">
          <CopyableLink label="Login do Inquilino" href={lawyerLoginLink} />
        </div>

        <div className="mt-3">
          <CopyableLink label="Painel de Agentes" href={agentPanelLink} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Ultimos Leads</h2>

        {dashboard.recentLeads.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Ainda sem leads registrados.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dashboard.recentLeads.map((lead) => (
              <li key={lead.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{formatPhone(lead.whatsapp_lead)}</p>
                <p className="text-xs uppercase text-slate-500">{lead.status}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
