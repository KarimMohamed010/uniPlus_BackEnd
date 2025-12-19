import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

import { env } from "../env.ts";

let client;

if (!global._dbPool) {
  global._dbPool = new Pool({ connectionString: env.DATABASE_URL });
}

client = global._dbPool;

const db = drizzle(client, { schema });

export default db;
