import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { clearSuperAdminSession, isSuperAdminAuthenticated } from "@/lib/auth";
import { CopyableLink } from "@/components/copyable-link";
import { PhoneInput } from "@/components/phone-input";
import { getAppBaseUrl } from "@/lib/app-url";
import { query, runAsTenant } from "@/lib/db";
import { formatPhone, normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

type TenantRow = {
  id: string;
  nome_oficial: string;
  slug: string | null;
  celular_responsavel: string;
  liberado_lista_positiva: boolean;
};

async function togglePositiveList(formData: FormData): Promise<void> {
  "use server";

  if (!(await isSuperAdminAuthenticated())) {
    throw new Error("Nao autorizado");
  }

  const escritorioId = formData.get("escritorioId");

  if (typeof escritorioId !== "string" || !escritorioId) {
    throw new Error("Escritorio invalido");
  }

  await query(
    `
      UPDATE indicacao.escritorios
      SET liberado_lista_positiva = NOT liberado_lista_positiva
      WHERE id = $1
    `,
    [escritorioId],
  );

  revalidatePath("/super-admin");
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function createTenant(formData: FormData): Promise<void> {
  "use server";

  if (!(await isSuperAdminAuthenticated())) {
    throw new Error("Nao autorizado");
  }

  const celular = formData.get("celular");
  const slugRaw = formData.get("slug");

  if (typeof celular !== "string" || !celular.trim()) {
    throw new Error("Celular obrigatorio");
  }

  if (typeof slugRaw !== "string" || !slugRaw.trim()) {
    throw new Error("Slug obrigatorio");
  }

  const celularNormalized = normalizePhone(celular);
  const slug = normalizeSlug(slugRaw);

  if (!slug) {
    throw new Error("Slug invalido");
  }

  const hashUnico = randomUUID();
  const escritorioId = randomUUID();

  // Keep onboarding compatible with RLS by scoping writes to the new tenant id.
  await runAsTenant(escritorioId, async (client) => {
    await client.query(
      `
        INSERT INTO indicacao.escritorios (id, slug, celular_responsavel)
        VALUES ($1, $2, $3)
      `,
      [escritorioId, slug, celularNormalized],
    );

    await client.query(
      `
        INSERT INTO indicacao.usuarios (escritorio_id, tipo, celular, hash_unico)
        VALUES ($1, 'advogado', $2, $3)
      `,
      [escritorioId, celularNormalized, hashUnico],
    );
  });

  revalidatePath("/super-admin");
  redirect(`/super-admin?hash=${hashUnico}`);
}

async function logoutSuperAdmin(): Promise<void> {
  "use server";

  await clearSuperAdminSession();
  redirect("/super-admin");
}

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ hash?: string }>;
}) {
  const { hash } = await searchParams;

  if (!process.env.SUPER_ADMIN_KEY) {
    return (
      <main className="auth-shell">
        <section className="auth-card text-center">
          <h1 className="text-xl font-semibold tracking-tight">SUPER_ADMIN_KEY nao configurada</h1>
          <p className="body-muted">
            Defina a variavel no .env para proteger o acesso ao painel administrativo.
          </p>
        </section>
      </main>
    );
  }

  const authenticated = await isSuperAdminAuthenticated();

  if (!authenticated) {
    redirect("/super-admin/login");
  }

  const appUrl = getAppBaseUrl();
  const activationUrl = hash ? `${appUrl}/ativar/${hash}` : null;

  let tenants: TenantRow[] = [];
  let databaseError: string | null = null;

  try {
    tenants = await query<TenantRow>(
      `
        SELECT id, nome_oficial, slug, celular_responsavel, liberado_lista_positiva
        FROM indicacao.escritorios
        ORDER BY criado_em DESC
      `,
    );
  } catch (error) {
    databaseError =
      error instanceof Error
        ? error.message
        : "Nao foi possivel consultar o banco de dados no momento.";
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-84px)] max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="eyebrow">Gestao administrativa</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Lista positiva de escritorios</h1>
        <p className="mt-2 text-sm text-slate-600">
          Altere entre Livre e Bloqueado para governar o acesso mensal.
        </p>
        <form action={logoutSuperAdmin} className="mt-4">
          <button type="submit" className="ghost-button">
            Sair
          </button>
        </form>
      </header>

      <section className="surface-card mb-6 p-6">
        <h2 className="text-lg font-semibold tracking-tight">Onboarding de inquilino</h2>
        <p className="mt-2 text-sm text-slate-600">
          Cadastre o celular do advogado e um slug para gerar o link inicial de ativacao.
        </p>

        <form action={createTenant} className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="field-label">Slug do escritorio</span>
            <input
              name="slug"
              required
              placeholder="ex.: rrs-advocacia"
              className="input-control"
            />
          </label>

          <label className="block">
            <span className="field-label">Celular do advogado</span>
            <PhoneInput
              name="celular"
              required
              placeholder="(11)91222-7040"
              className="input-control"
            />
          </label>

          <div className="flex items-end">
            <button type="submit" className="primary-button">
              Cadastrar
            </button>
          </div>
        </form>

        {activationUrl && (
          <div className="status-message status-message--info">
            <CopyableLink
              label="Link de ativacao gerado"
              href={activationUrl}
              containerClassName=""
              labelClassName="text-sm text-sky-900"
              buttonClassName="mt-2 rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
            />
          </div>
        )}
      </section>

      {databaseError ? (
        <section className="status-message status-message--warning p-6 text-sm">
          <h2 className="text-lg font-semibold">Banco de dados indisponivel</h2>
          <p className="mt-2">
            Nao foi possivel carregar os escritorios. Verifique se o banco esta em execucao e se
            <span className="font-medium"> DATABASE_URL</span> aponta para o banco correto.
          </p>
          <p className="mt-2 break-all text-xs text-amber-800">{databaseError}</p>
        </section>
      ) : (
        <section className="surface-card overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th className="px-4 py-3">Escritorio</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Celular</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Acao</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t border-border">
                  <td className="px-4 py-3">{tenant.nome_oficial}</td>
                  <td className="px-4 py-3 text-slate-600">{tenant.slug ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatPhone(tenant.celular_responsavel)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        tenant.liberado_lista_positiva
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {tenant.liberado_lista_positiva ? "Livre" : "Bloqueado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <form action={togglePositiveList}>
                      <input type="hidden" name="escritorioId" value={tenant.id} />
                      <button
                        type="submit"
                        className="ghost-button border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        Alternar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Nenhum escritorio cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
