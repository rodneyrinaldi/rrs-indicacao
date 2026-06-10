import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card max-w-2xl">
        <p className="eyebrow">Pagina nao encontrada</p>
        <h1 className="title-lg text-balance">Essa rota nao existe ou nao esta mais disponivel.</h1>
        <p className="body-muted max-w-xl text-base">
          Verificamos o endereco informado e nao encontramos uma pagina valida.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/super-admin/login" className="primary-button">
            Ir para login do super admin
          </Link>
          <Link href="/" className="ghost-button">
            Voltar para pagina inicial
          </Link>
        </div>
      </section>
    </main>
  );
}