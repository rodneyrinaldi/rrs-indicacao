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

  if (await isSuperAdminAuthenticated()) {
    redirect("/super-admin");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Ambiente protegido</p>
        <h1 className="title-lg">Login super admin</h1>
        <p className="body-muted">
          Somente o administrador com a chave correta pode acessar o painel.
        </p>

        <form action={loginSuperAdmin} className="form-stack">
          <label className="block">
            <span className="field-label">Senha administrativa</span>
            <input
              type="password"
              name="adminKey"
              required
              className="input-control"
            />
          </label>

          <button type="submit" className="primary-button w-full">
            Entrar
          </button>
        </form>

        {erro === "senha-invalida" && (
          <p className="status-message status-message--error">Senha invalida.</p>
        )}
      </section>
    </main>
  );
}
