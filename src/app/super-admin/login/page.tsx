import { redirect } from "next/navigation";
import {
  createSuperAdminSession,
  isSuperAdminAuthenticated,
  isSuperAdminKeyValid,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

async function loginSuperAdmin(formData: FormData): Promise<void> {
  "use server";

  const adminKey = formData.get("adminKey");

  if (typeof adminKey !== "string" || !isSuperAdminKeyValid(adminKey)) {
    redirect("/super-admin/login?erro=senha-invalida");
  }

  await createSuperAdminSession();
  redirect("/super-admin");
}

export default async function SuperAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  if (!process.env.SUPER_ADMIN_KEY) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
        <section className="w-full rounded-xl border border-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">SUPER_ADMIN_KEY nao configurada</h1>
          <p className="mt-2 text-sm text-slate-600">
            Defina a variavel no .env para proteger o acesso ao painel administrativo.
          </p>
        </section>
      </main>
    );
  }

  if (await isSuperAdminAuthenticated()) {
    redirect("/super-admin");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
      <section className="w-full rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Login Super Admin</h1>
        <p className="mt-2 text-sm text-slate-600">
          Somente o administrador com a chave correta pode acessar o painel.
        </p>

        <form action={loginSuperAdmin} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Senha administrativa</span>
            <input
              type="password"
              name="adminKey"
              required
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
            />
          </label>

          <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
            Entrar
          </button>
        </form>

        {erro === "senha-invalida" && <p className="mt-4 text-sm text-red-700">Senha invalida.</p>}
      </section>
    </main>
  );
}
