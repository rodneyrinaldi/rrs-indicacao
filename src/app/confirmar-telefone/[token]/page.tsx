import { redirect } from "next/navigation";
import { confirmPhoneChangeByToken, getPhoneChangeRequestByToken } from "@/lib/phone-change";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

async function confirmarTroca(formData: FormData): Promise<void> {
  "use server";

  const token = formData.get("token");

  if (typeof token !== "string" || token.length < 32) {
    throw new Error("Token invalido");
  }

  try {
    await confirmPhoneChangeByToken(token);
  } catch {
    // The page will render the latest status after redirect.
  }

  redirect(`/confirmar-telefone/${token}`);
}

export default async function ConfirmarTelefonePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = await getPhoneChangeRequestByToken(token);

  if (!request) {
    return (
      <main className="auth-shell">
        <section className="auth-card text-center">
          <h1 className="text-xl font-semibold tracking-tight">Link invalido</h1>
          <p className="body-muted mt-2">Este link de confirmacao nao existe ou foi removido.</p>
        </section>
      </main>
    );
  }

  const expired = new Date(request.expira_em).getTime() <= Date.now();
  const pending = request.status === "pendente" && !expired;
  const loginPath = request.usuario_tipo === "agente" ? `/${request.escritorio_slug}/agente/login` : `/${request.escritorio_slug}/login`;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Confirmacao</p>
        <h1 className="title-lg">Troca de telefone</h1>

        <dl className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div>
            <dt className="font-medium text-slate-600">Numero atual</dt>
            <dd className="text-slate-900">{formatPhone(request.celular_atual)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Novo numero</dt>
            <dd className="text-slate-900">{formatPhone(request.celular_novo)}</dd>
          </div>
        </dl>

        {pending && (
          <>
            <p className="body-muted mt-4">
              Ao confirmar, o sistema atualiza apenas o telefone do usuario. O historico de indicacoes permanece intacto.
            </p>
            <form action={confirmarTroca} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="primary-button"
              >
                Confirmar novo telefone
              </button>
            </form>
          </>
        )}

        {!pending && request.status === "confirmada" && (
          <div className="status-message status-message--success">
            Troca confirmada com sucesso. O novo numero ja esta ativo.
          </div>
        )}

        {!pending && request.status === "cancelada" && (
          <div className="status-message status-message--warning">
            Este link foi substituido por uma solicitacao mais recente.
          </div>
        )}

        {!pending && request.status === "pendente" && expired && (
          <div className="status-message status-message--error">
            Este link expirou. Solicite um novo link de confirmacao.
          </div>
        )}

        <p className="mt-5 text-sm">
          <a href={loginPath} className="text-blue-700 hover:underline">
            Ir para o login
          </a>
        </p>
      </section>
    </main>
  );
}
