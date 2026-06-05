export function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, "");
}

export function sanitizeWhatsapp(raw: string): string {
  return normalizePhone(raw);
}

export function formatPhone(raw: string): string {
  const digits = normalizePhone(raw).slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
}
