import bycrypt from "bcrypt";
import env from "../../env.ts";
export async function hashPassword(password) {
  return await bycrypt.hash(password, env.BCRYPT_ROUNDS);
}