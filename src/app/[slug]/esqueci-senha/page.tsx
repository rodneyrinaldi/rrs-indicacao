import { redirect } from "next/navigation";
import { CopyableLink } from "@/components/copyable-link";
import { PhoneInput } from "@/components/phone-input";
import { getAppBaseUrl } from "@/lib/app-url";
import { getCurrentActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

type ResetLawyerRow = {
  hash_unico: string;
};

async function requestPasswordReset(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const celular = formData.get("celular");

  if (typeof slug !== "string" || typeof celular !== "string") {
    throw new Error("Formulario invalido");
  }

  const celularNormalizado = normalizePhone(celular);

  const users = await query<ResetLawyerRow>(
    `
      UPDATE indicacao.usuarios u
      SET senha_hash = NULL
      FROM indicacao.escritorios e
      WHERE u.escritorio_id = e.id
        AND e.slug = $1
        AND u.tipo = 'advogado'
        AND regexp_replace(u.celular, '\\D', '', 'g') = $2
      RETURNING u.hash_unico
    `,
    [slug, celularNormalizado],
  );

  const user = users[0];

  if (!user) {
    redirect(`/${slug}/esqueci-senha?erro=numero-nao-encontrado`);
  }

  const appUrl = getAppBaseUrl();
  const resetLink = encodeURIComponent(`${appUrl}/ativar/${user.hash_unico}`);
  redirect(`/${slug}/esqueci-senha?ok=1&link=${resetLink}`);
}

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; erro?: string; link?: string }>;
}) {
  const { slug } = await params;
  const { ok, erro, link } = await searchParams;

  const actor = await getCurrentActor();
  if (actor?.tipo === "advogado") {
    redirect(`/${slug}/app`);
  }

  const decodedLink = link ? decodeURIComponent(link) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
      <section className="w-full rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Recuperar Senha</h1>
        <p className="mt-2 text-sm text-slate-600">
          Informe o celular do advogado para gerar um novo link de ativacao.
        </p>

        <form action={requestPasswordReset} className="mt-6 space-y-4">
          <input type="hidden" name="slug" value={slug} />

          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Celular</span>
            <PhoneInput
              name="celular"
              required
              placeholder="(11)91222-7040"
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-white hover:opacity-90"
          >
            Gerar novo link
          </button>
        </form>

        {ok === "1" && decodedLink && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <CopyableLink
              label="Link de redefinicao gerado"
              href={decodedLink}
              containerClassName=""
              labelClassName="text-sm text-slate-700"
              buttonClassName="mt-2 rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            />
          </div>
        )}

        {erro === "numero-nao-encontrado" && (
          <p className="mt-4 text-sm text-red-700">Numero nao encontrado para este inquilino.</p>
        )}

        <p className="mt-6 text-sm text-slate-600">
          <a className="text-blue-700 hover:underline" href={`/${slug}/login`}>
            Voltar para login
          </a>
        </p>
      </section>
    </main>
  );
}
