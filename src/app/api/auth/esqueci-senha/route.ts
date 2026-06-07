import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdminAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

const schema = z.object({
  celular: z.string().min(8).max(30),
});

type ResetUser = {
  hash_unico: string;
};

export async function POST(request: NextRequest) {
  if (!(await isSuperAdminAuthenticated())) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Celular invalido" }, { status: 400 });
  }

  const celular = normalizePhone(parsed.data.celular);

  const users = await query<ResetUser>(
    `
      UPDATE indicacao.usuarios
      SET senha_hash = NULL
      WHERE regexp_replace(celular, '\\D', '', 'g') = $1
      RETURNING hash_unico
    `,
    [celular],
  );

  const user = users[0];

  if (!user) {
    return NextResponse.json({ error: "Numero nao encontrado" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indicacao.rrs.net.br";
  return NextResponse.json({
    ok: true,
    redirectTo: `${appUrl}/ativar/${user.hash_unico}`,
  });
}
