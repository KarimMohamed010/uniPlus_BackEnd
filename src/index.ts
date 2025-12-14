import { createServer } from "http";
import app from "./server.ts";
import { env } from "../env.ts";
import { initializeSocket } from "./socket/chat.ts";

const server = createServer(app);
initializeSocket(server);

server.listen(env.PORT, () => {
  console.log(`server running on port ${env.PORT}`);
});