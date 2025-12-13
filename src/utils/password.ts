import bcrypt from "bcrypt";
import env from "../../env.ts";
export async function hashPassword(password) {
  return await bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

console.log(await hashPassword("123456"));
