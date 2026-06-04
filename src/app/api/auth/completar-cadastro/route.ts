import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";

const payloadSchema = z.object({
  hash: z.string().min(20).max(120),
  nome: z.string().min(3).max(150),
  email: z.string().email().max(150),
  senha: z.string().min(8).max(100),
});

type UserRow = {
  id: string;
  senha_hash: string | null;
  slug: string | null;
};

export async function POST(request: NextRequest) {
  const parsed = payloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { hash, nome, email, senha } = parsed.data;
  const users = await query<UserRow>(
    `
      SELECT u.id, u.senha_hash, e.slug
      FROM whitelabel.usuarios u
      INNER JOIN whitelabel.escritorios e ON e.id = u.escritorio_id
      WHERE u.hash_unico = $1
      LIMIT 1
    `,
    [hash],
  );

  const user = users[0];

  if (!user) {
    return NextResponse.json({ error: "Hash de ativacao invalido" }, { status: 404 });
  }

  if (user.senha_hash !== null) {
    return NextResponse.json({ error: "Cadastro ja foi concluido" }, { status: 409 });
  }

  const senhaHash = await bcrypt.hash(senha, 12);

  await query(
    `
      UPDATE whitelabel.usuarios
      SET nome = $1,
          email = $2,
          senha_hash = $3
      WHERE id = $4
    `,
    [nome, email, senhaHash, user.id],
  );

  return NextResponse.json({
    ok: true,
    redirectTo: user.slug ? `/${user.slug}/login` : "/super-admin",
  });
}
