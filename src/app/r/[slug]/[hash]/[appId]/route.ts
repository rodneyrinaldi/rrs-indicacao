import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { shouldBlockRedirect } from "@/lib/billing-window";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type RedirectData = {
  lead_id: string;
  escritorio_id: string;
  liberado_lista_positiva: boolean;
  url_destino: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; hash: string; appId: string }> },
) {
  const { slug, hash, appId } = await params;

  const rows = await query<RedirectData>(
    `
      SELECT
        l.id AS lead_id,
        l.escritorio_id,
        e.liberado_lista_positiva,
        a.url_destino
      FROM indicacao.leads l
      INNER JOIN indicacao.escritorios e ON e.id = l.escritorio_id
      INNER JOIN indicacao.aplicativos a ON a.id = l.aplicativo_id
      WHERE e.slug = $1
        AND l.id::text = $2
        AND a.id::text = $3
      LIMIT 1
    `,
    [slug, hash, appId],
  );

  const redirectData = rows[0];

  if (!redirectData) {
    return NextResponse.json({ error: "Link invalido" }, { status: 404 });
  }

  if (shouldBlockRedirect(new Date(), redirectData.liberado_lista_positiva)) {
    return NextResponse.json({ error: "Escritorio suspenso pela lista positiva" }, { status: 423 });
  }

  const metadata = {
    pais: request.headers.get("x-vercel-ip-country"),
    regiao: request.headers.get("x-vercel-ip-country-region"),
    cidade: request.headers.get("x-vercel-ip-city"),
    userAgent: request.headers.get("user-agent"),
    coletadoEm: new Date().toISOString(),
  };

  await query(
    `
      UPDATE indicacao.leads
      SET localizacao_metadata = $1
      WHERE id = $2
    `,
    [metadata, redirectData.lead_id],
  );

  const uuid = randomUUID();
  const url = new URL(redirectData.url_destino);
  url.searchParams.set("rid", uuid);

  return NextResponse.redirect(url, 302);
}
