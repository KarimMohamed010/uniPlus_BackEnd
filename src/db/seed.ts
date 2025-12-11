import db from "./connection.ts"
import { seed, reset } from "drizzle-seed";
import * as schema from "./schema.ts";
import env from "../../env.ts";

async function main() {
  await reset(db, schema);
  await seed(db, schema);
}

main();
