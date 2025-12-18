import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import env from "../../env.ts";

type VerificationRecord = {
  id: string;
  email: string;
  codeHash: Buffer;
  expiresAtMs: number;
  verifiedAtMs?: number;
  createdAtMs: number;
  lastSentAtMs: number;
  attempts: number;
};

const recordsById = new Map<string, VerificationRecord>();
const activeIdByEmail = new Map<string, string>();

function nowMs() {
  return Date.now();
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest();
}

function generateCode() {
  // 6-digit numeric code
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function cleanupExpiredForEmail(email: string) {
  const existingId = activeIdByEmail.get(email);
  if (!existingId) return;
  const rec = recordsById.get(existingId);
  if (!rec) {
    activeIdByEmail.delete(email);
    return;
  }
  if (rec.expiresAtMs <= nowMs()) {
    recordsById.delete(existingId);
    activeIdByEmail.delete(email);
  }
}

export function requestEmailVerification(emailRaw: string) {
  const email = emailRaw.toLowerCase().trim();
  cleanupExpiredForEmail(email);

  const existingId = activeIdByEmail.get(email);
  const now = nowMs();

  if (existingId) {
    const rec = recordsById.get(existingId);
    if (rec && !rec.verifiedAtMs) {
      const resendAfterMs = env.EMAIL_OTP_RESEND_SECONDS * 1000;
      const nextAllowed = rec.lastSentAtMs + resendAfterMs;
      if (now < nextAllowed) {
        return {
          ok: false as const,
          status: 429 as const,
          error: "Please wait before requesting another code",
          retryAfterSeconds: Math.ceil((nextAllowed - now) / 1000),
        };
      }

      const code = generateCode();
      rec.codeHash = hashCode(code);
      rec.expiresAtMs = now + env.EMAIL_OTP_TTL_SECONDS * 1000;
      rec.lastSentAtMs = now;
      rec.attempts = 0;

      return {
        ok: true as const,
        verificationId: rec.id,
        code,
      };
    }
  }

  const code = generateCode();
  const id = randomUUID();
  const rec: VerificationRecord = {
    id,
    email,
    codeHash: hashCode(code),
    createdAtMs: now,
    lastSentAtMs: now,
    expiresAtMs: now + env.EMAIL_OTP_TTL_SECONDS * 1000,
    attempts: 0,
  };

  recordsById.set(id, rec);
  activeIdByEmail.set(email, id);

  return {
    ok: true as const,
    verificationId: id,
    code,
  };
}

export function verifyEmailCode(input: {
  verificationId: string;
  email: string;
  code: string;
}) {
  const verificationId = input.verificationId;
  const email = input.email.toLowerCase().trim();
  const code = input.code.trim();

  const rec = recordsById.get(verificationId);
  if (!rec || rec.email !== email) {
    return { ok: false as const, status: 400 as const, error: "Invalid verification" };
  }

  const now = nowMs();
  if (rec.expiresAtMs <= now) {
    return { ok: false as const, status: 400 as const, error: "Code expired" };
  }

  if (rec.verifiedAtMs) {
    return { ok: true as const };
  }

  rec.attempts += 1;
  if (rec.attempts > 10) {
    return { ok: false as const, status: 429 as const, error: "Too many attempts" };
  }

  const provided = hashCode(code);
  const matches = timingSafeEqual(rec.codeHash, provided);

  if (!matches) {
    return { ok: false as const, status: 400 as const, error: "Invalid code" };
  }

  rec.verifiedAtMs = now;
  return { ok: true as const };
}

export function assertEmailVerifiedForSignup(input: {
  verificationId: string;
  email: string;
}) {
  const verificationId = input.verificationId;
  const email = input.email.toLowerCase().trim();

  const rec = recordsById.get(verificationId);
  if (!rec || rec.email !== email) {
    return { ok: false as const, status: 400 as const, error: "Email not verified" };
  }

  if (rec.expiresAtMs <= nowMs()) {
    return { ok: false as const, status: 400 as const, error: "Verification expired" };
  }

  if (!rec.verifiedAtMs) {
    return { ok: false as const, status: 400 as const, error: "Email not verified" };
  }

  return { ok: true as const };
}

export function consumeEmailVerification(verificationId: string) {
  const rec = recordsById.get(verificationId);
  if (!rec) return;
  recordsById.delete(verificationId);
  const active = activeIdByEmail.get(rec.email);
  if (active === verificationId) {
    activeIdByEmail.delete(rec.email);
  }
}
