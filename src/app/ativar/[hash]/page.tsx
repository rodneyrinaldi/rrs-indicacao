"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AtivarContaPage() {
  const params = useParams<{ hash: string }>();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMensagem(null);
    setErro(null);

    try {
      const response = await fetch("/api/auth/completar-cadastro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hash: params.hash,
          nome,
          email,
          senha,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setErro(data.error ?? "Falha ao concluir cadastro");
        return;
      }

      const data = (await response.json()) as { redirectTo?: string };
      const redirectTo = data.redirectTo ?? "/super-admin";

      setMensagem("Cadastro concluido com sucesso.");
      setNome("");
      setEmail("");
      setSenha("");
      window.setTimeout(() => {
        router.push(redirectTo);
      }, 1500);
    } catch {
      setErro("Erro de comunicacao com o servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
      <section className="w-full rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Ativacao de Conta</h1>
        <p className="mt-2 text-sm text-slate-600">
          Preencha seus dados para concluir o cadastro inicial.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Nome</span>
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
            />
          </label>

          <button
            disabled={loading}
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:bg-slate-400"
          >
            {loading ? "Salvando..." : "Concluir cadastro"}
          </button>
        </form>

        {mensagem && <p className="mt-4 text-sm text-green-700">{mensagem}</p>}
        {erro && <p className="mt-4 text-sm text-red-700">{erro}</p>}
      </section>
    </main>
  );
}
