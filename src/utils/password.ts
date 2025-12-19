import bcrypt from "bcrypt";
import env from "../env.ts";
export async function hashPassword(password: string) {
  return await bcrypt.hash(password, env.BCRYPT_ROUNDS);
}
