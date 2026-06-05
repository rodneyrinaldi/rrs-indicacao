import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(26,115,232,0.14),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(26,115,232,0.08),_transparent_35%)]" />
      <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-white/90 p-8 shadow-sm backdrop-blur-sm md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Pagina nao encontrada</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-2xl">
          Essa rota nao existe ou nao esta mais disponivel.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
          Verificamos o endereco informado e nao encontramos uma pagina valida.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {/* <Link
            href="/super-admin/login"
            className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            Ir para login do super admin
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Voltar para a pagina inicial
          </Link> */}
        </div>
      </div>
    </main>
  );
}