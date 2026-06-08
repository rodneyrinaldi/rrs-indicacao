const DEV_APP_URL = "http://localhost:3000";
const PROD_APP_URL = "https://indicacao.rrs.net.br";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function fromVercelUrl(vercelUrl: string | undefined): string | null {
  if (!vercelUrl) {
    return null;
  }

  const host = vercelUrl.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  if (!host) {
    return null;
  }

  return `https://${host}`;
}

export function getAppBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (configuredUrl && configuredUrl.trim()) {
    return normalizeBaseUrl(configuredUrl);
  }

  const vercelUrl = fromVercelUrl(process.env.VERCEL_URL);

  if (vercelUrl) {
    return vercelUrl;
  }

  if (process.env.NODE_ENV === "production") {
    return PROD_APP_URL;
  }

  return DEV_APP_URL;
}