import { redirect } from "next/navigation";

export default function HomePage() {
  // redirect("/super-admin");
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(26,115,232,0.14),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(26,115,232,0.08),_transparent_35%)]" />
      <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-white/90 p-8 shadow-sm backdrop-blur-sm md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Indicação de Atendimento</p>
        <p className="mt-4 font-semibold tracking-tight text-slate-900">
          Esta aplicação é destinada à gestão de indicações de atendimento.
        </p>
      </div>
    </main>
  );
}