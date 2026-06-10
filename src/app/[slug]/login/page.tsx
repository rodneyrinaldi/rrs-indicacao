import bcrypt from "bcryptjs";
import { notFound, redirect } from "next/navigation";
import { PhoneInput } from "@/components/phone-input";
import { createActorSession, getCurrentActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

type LawyerRow = {
  id: string;
  escritorio_id: string;
  senha_hash: string | null;
};

type OfficeRow = {
  id: string;
};

async function loginLawyer(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug");
  const celular = formData.get("celular");
  const senha = formData.get("senha");

  if (typeof slug !== "string" || typeof celular !== "string" || typeof senha !== "string") {
    throw new Error("Formulario invalido");
  }

  const celularNormalizado = normalizePhone(celular);

  const users = await query<LawyerRow>(
    `
      SELECT u.id, u.escritorio_id, u.senha_hash
      FROM indicacao.usuarios u
      INNER JOIN indicacao.escritorios e ON e.id = u.escritorio_id
      WHERE e.slug = $1
        AND u.tipo = 'advogado'
        AND regexp_replace(u.celular, '\\D', '', 'g') = $2
      LIMIT 1
    `,
    [slug, celularNormalizado],
  );

  const user = users[0];

  if (!user?.senha_hash) {
    redirect(`/${slug}/login?erro=credenciais-invalidas`);
  }

  const senhaValida = await bcrypt.compare(senha, user.senha_hash);

  if (!senhaValida) {
    redirect(`/${slug}/login?erro=credenciais-invalidas`);
  }

  await createActorSession({
    userId: user.id,
    tipo: "advogado",
    escritorioId: user.escritorio_id,
    celular: celularNormalizado,
  });

  redirect(`/${slug}/app`);
}

export default async function LawyerLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string; telefone?: string }>;
}) {
  const { slug } = await params;
  const { erro, telefone } = await searchParams;

  const offices = await query<OfficeRow>(
    `
      SELECT id
      FROM indicacao.escritorios
      WHERE slug = $1
      LIMIT 1
    `,
    [slug],
  );
  const office = offices[0];

  if (!office) {
    notFound();
  }

  const actor = await getCurrentActor();
  if (office && actor?.tipo === "advogado" && actor.escritorioId === office.id) {
    redirect(`/${slug}/app`);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Acesso do escritorio</p>
        <h1 className="title-lg">Login do advogado</h1>
        <p className="body-muted">Entre com celular e senha para acessar o app.</p>

        <form action={loginLawyer} className="form-stack">
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

          <label className="block">
            <span className="field-label">Senha</span>
            <input
              type="password"
              name="senha"
              required
              className="input-control"
            />
          </label>

          <p className="text-right text-sm">
            <a className="text-blue-700 hover:underline" href={`/${slug}/esqueci-senha`}>
              Esqueci minha senha
            </a>
          </p>

          <button
            type="submit"
            className="primary-button w-full"
          >
            Entrar
          </button>
        </form>

        {erro === "credenciais-invalidas" && (
          <p className="status-message status-message--error">Celular ou senha invalidos.</p>
        )}

        {telefone === "atualizado" && (
          <p className="status-message status-message--success">
            Telefone atualizado. Entre com o novo numero.
          </p>
        )}
      </section>
    </main>
  );
}
