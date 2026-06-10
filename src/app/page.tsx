import { redirect } from "next/navigation";

export default function HomePage() {
  // redirect("/super-admin");
  return (
    <main className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-6xl items-center px-6 py-14">
      <section className="grid w-full gap-6 lg:grid-cols-[1.35fr_1fr]">
        <article className="surface-card rounded-3xl p-8 md:p-10">
          <p className="eyebrow">Indicacao de Atendimento</p>
          <h1 className="title-lg max-w-2xl text-balance">Gestao de indicacoes com fluxo claro e operacao rapida</h1>
          <p className="body-muted max-w-2xl text-base">
            Plataforma privada para escritorios juridicos registrarem leads, acompanharem status e manterem
            dados de atendimento centralizados com seguranca.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/super-admin/login" className="primary-button">
              Acessar super admin
            </a>
            <a href="/super-admin" className="ghost-button">
              Ver painel administrativo
            </a>
          </div>
        </article>

        <aside className="surface-card rounded-3xl p-8">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Como entrar</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li>Advogado: use o endereco /seu-slug/login.</li>
            <li>Agente: use o endereco /seu-slug/agente/login.</li>
            <li>Recuperacao: em caso de bloqueio, use /seu-slug/esqueci-senha.</li>
          </ul>
          <p className="status-message status-message--info mt-6">
            Dica: mantenha seu slug em local seguro para agilizar o acesso da equipe.
          </p>
        </aside>
      </section>
    </main>
  );
}