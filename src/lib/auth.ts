// Session auth built on JWT (jose) in an httpOnly cookie.
// Edge-safe: verification uses jose only (no bcrypt) so middleware can run on the edge.
import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./rbac";

export const SESSION_COOKIE = "numik_session";
const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    // Fail loud rather than sign with a guessable key in production.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is missing or too short in production.");
    }
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-00000000");
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    tenantId: user.tenantId,
    locale: user.locale,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email),
      fullName: String(payload.fullName),
      role: payload.role as SessionUser["role"],
      tenantId: String(payload.tenantId),
      locale: String(payload.locale ?? "en"),
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
