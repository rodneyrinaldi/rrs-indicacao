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
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
        <section className="w-full rounded-xl border border-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Link invalido</h1>
          <p className="mt-2 text-sm text-slate-600">Este link de confirmacao nao existe ou foi removido.</p>
        </section>
      </main>
    );
  }

  const expired = new Date(request.expira_em).getTime() <= Date.now();
  const pending = request.status === "pendente" && !expired;
  const loginPath = request.usuario_tipo === "agente" ? `/${request.escritorio_slug}/agente/login` : `/${request.escritorio_slug}/login`;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
      <section className="w-full rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Confirmacao de troca de telefone</h1>

        <dl className="mt-5 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
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
            <p className="mt-4 text-sm text-slate-600">
              Ao confirmar, o sistema atualiza apenas o telefone do usuario. O historico de indicacoes permanece intacto.
            </p>
            <form action={confirmarTroca} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Confirmar novo telefone
              </button>
            </form>
          </>
        )}

        {!pending && request.status === "confirmada" && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Troca confirmada com sucesso. O novo numero ja esta ativo.
          </div>
        )}

        {!pending && request.status === "cancelada" && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Este link foi substituido por uma solicitacao mais recente.
          </div>
        )}

        {!pending && request.status === "pendente" && expired && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
