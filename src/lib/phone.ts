export function sanitizeWhatsapp(raw: string): string {
  return raw.replace(/\D+/g, "");
}
