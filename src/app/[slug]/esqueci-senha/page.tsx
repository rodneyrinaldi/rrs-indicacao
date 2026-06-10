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
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Acesso de advogado</p>
        <h1 className="title-lg">Recuperar senha</h1>
        <p className="body-muted">
          Informe o celular do advogado para gerar um novo link de ativacao.
        </p>

        <form action={requestPasswordReset} className="form-stack">
          <input type="hidden" name="slug" value={slug} />

          <label className="block">
            <span className="field-label">Celular</span>
            <PhoneInput
              name="celular"
              required
              placeholder="(11)91222-7040"
              className="input-control"
            />
          </label>

          <button
            type="submit"
            className="primary-button w-full"
          >
            Gerar novo link
          </button>
        </form>

        {ok === "1" && decodedLink && (
          <div className="status-message status-message--info">
            <CopyableLink
              label="Link de redefinicao gerado"
              href={decodedLink}
              containerClassName=""
              labelClassName="text-sm text-sky-900"
              buttonClassName="mt-2 rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
            />
          </div>
        )}

        {erro === "numero-nao-encontrado" && (
          <p className="status-message status-message--error">Numero nao encontrado para este inquilino.</p>
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
