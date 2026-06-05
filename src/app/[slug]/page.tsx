import { notFound, redirect } from "next/navigation";
import { query } from "@/lib/db";

type OfficeRow = {
  id: string;
};

export default async function TenantSlugEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const offices = await query<OfficeRow>(
    `
      SELECT id
      FROM whitelabel.escritorios
      WHERE slug = $1
      LIMIT 1
    `,
    [slug],
  );

  if (!offices[0]) {
    notFound();
  }

  redirect(`/${slug}/login`);
}
