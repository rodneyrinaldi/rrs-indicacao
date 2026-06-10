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
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Primeiro acesso</p>
        <h1 className="title-lg">Ativacao de conta</h1>
        <p className="body-muted">
          Preencha seus dados para concluir o cadastro inicial.
        </p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="block">
            <span className="field-label">Nome</span>
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              className="input-control"
            />
          </label>

          <label className="block">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="input-control"
            />
          </label>

          <label className="block">
            <span className="field-label">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
              minLength={8}
              className="input-control"
            />
          </label>

          <button
            disabled={loading}
            type="submit"
            className="primary-button w-full"
          >
            {loading ? "Salvando..." : "Concluir cadastro"}
          </button>
        </form>

        {mensagem && <p className="status-message status-message--success">{mensagem}</p>}
        {erro && <p className="status-message status-message--error">{erro}</p>}
      </section>
    </main>
  );
}
