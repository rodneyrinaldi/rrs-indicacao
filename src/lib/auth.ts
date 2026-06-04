import { createHash } from "crypto";
import { cookies } from "next/headers";

export type SessionActor = {
  userId: string;
  tipo: "advogado" | "agente" | "super-admin";
  escritorioId?: string;
  celular?: string;
};

const SESSION_COOKIE_NAME = "indicacao_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SUPER_ADMIN_COOKIE_NAME = "indicacao_super_admin";
const SUPER_ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export async function getCurrentActor(): Promise<SessionActor | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as SessionActor;
  } catch {
    return null;
  }
}

export async function createActorSession(actor: SessionActor): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: Buffer.from(JSON.stringify(actor), "utf8").toString("base64url"),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearActorSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: SESSION_COOKIE_NAME,
    path: "/",
  });
}

export function hashToken(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function getSuperAdminExpectedToken(): string | null {
  const superAdminKey = process.env.SUPER_ADMIN_KEY;

  if (!superAdminKey) {
    return null;
  }

  return hashToken(`super-admin:${superAdminKey}`);
}

export function isSuperAdminKeyValid(input: string): boolean {
  const expectedToken = getSuperAdminExpectedToken();

  if (!expectedToken) {
    return false;
  }

  return hashToken(`super-admin:${input}`) === expectedToken;
}

export async function isSuperAdminAuthenticated(): Promise<boolean> {
  const expectedToken = getSuperAdminExpectedToken();

  if (!expectedToken) {
    return false;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SUPER_ADMIN_COOKIE_NAME)?.value;

  return token === expectedToken;
}

export async function createSuperAdminSession(): Promise<void> {
  const expectedToken = getSuperAdminExpectedToken();

  if (!expectedToken) {
    throw new Error("SUPER_ADMIN_KEY nao configurada");
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: SUPER_ADMIN_COOKIE_NAME,
    value: expectedToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SUPER_ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSuperAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: SUPER_ADMIN_COOKIE_NAME,
    path: "/",
  });
}
