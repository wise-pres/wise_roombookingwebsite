import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "wise_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is required for dashboard access.");
  }
  return value;
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function verifyPasscode(passcode: string): boolean {
  const expectedHash = process.env.ADMIN_DASHBOARD_PASSWORD_HASH;
  if (!expectedHash) {
    return false;
  }
  const providedHash = createHash("sha256").update(passcode).digest("hex");
  if (providedHash.length !== expectedHash.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(providedHash), Buffer.from(expectedHash));
}

export function createAdminSession(now = Date.now()): string {
  const payload = encode({ expiresAt: now + SESSION_DURATION_SECONDS * 1000 });
  return `${payload}.${signature(payload)}`;
}

export function isAdminSession(value?: string, now = Date.now()): boolean {
  if (!value) {
    return false;
  }
  const [payload, receivedSignature] = value.split(".");
  if (!payload || !receivedSignature) {
    return false;
  }
  const expectedSignature = signature(payload);
  if (receivedSignature.length !== expectedSignature.length) {
    return false;
  }
  if (!timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) {
    return false;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { expiresAt?: number };
    return typeof decoded.expiresAt === "number" && decoded.expiresAt > now;
  } catch {
    return false;
  }
}

export const adminCookie = {
  name: COOKIE_NAME,
  maxAge: SESSION_DURATION_SECONDS,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  },
};
