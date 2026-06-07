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
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;

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
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
      <section className="w-full rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Login do Inquilino</h1>
        <p className="mt-2 text-sm text-slate-600">Entre com celular e senha para acessar o app.</p>

        <form action={loginLawyer} className="mt-6 space-y-4">
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

          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Senha</span>
            <input
              type="password"
              name="senha"
              required
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
            />
          </label>

          <p className="text-right text-sm">
            <a className="text-blue-700 hover:underline" href={`/${slug}/esqueci-senha`}>
              Esqueci minha senha
            </a>
          </p>

          <button
            type="submit"
            className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-white hover:opacity-90"
          >
            Entrar
          </button>
        </form>

        {erro === "credenciais-invalidas" && (
          <p className="mt-4 text-sm text-red-700">Celular ou senha invalidos.</p>
        )}
      </section>
    </main>
  );
}
