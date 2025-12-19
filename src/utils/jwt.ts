import { createSecretKey } from "node:crypto";
import { SignJWT } from "jose";
import { jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import env from "../env.ts";

// type jwtPayLoad = JWTPayload & {
//     username : string;
// }

export interface jwtPayLoad extends JWTPayload {
  id: number;
  email: string;
  roles: {
    global: "student" | "admin";
    team: { teamId: number; role: string }[];
  };
}

export function generateToken(payload: jwtPayLoad) {
  const secret = env.JWT_SECRET;
  const secretkey = createSecretKey(secret, "utf-8");

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN || "1h")
    .sign(secretkey);
}

function isValidRole(roles: unknown): roles is jwtPayLoad["roles"] {
  if (typeof roles !== "object" || roles === null) return false;
  const r = roles as any;
  if (r.global !== "student" && r.global !== "admin") return false;
  if (!Array.isArray(r.team)) return false;
  return r.team.every(
    (t: any) => typeof t.teamId === "number" && typeof t.role === "string"
  );
}

export const verifyToken = async (token: string): Promise<jwtPayLoad> => {
  const secretKey = createSecretKey(env.JWT_SECRET, "utf-8");
  const { payload } = await jwtVerify(token, secretKey);

  if (
    typeof payload === "object" &&
    payload !== null &&
    typeof payload.id === "number" &&
    typeof payload.email === "string" &&
    isValidRole(payload.roles)
  ) {
    return payload as unknown as jwtPayLoad;
  }
  throw new Error("Invalid JWT payload structure");
};
