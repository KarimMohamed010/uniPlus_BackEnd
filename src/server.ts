import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { isTestEnv } from "../env.ts";
import authRoutes from "./routes/authRoutes.ts";
import { authenticate } from "./middleware/auth.ts";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: ["https://my-frontend.com", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan("dev", {
    skip: () => isTestEnv(),
  })
);

// Public routes (no authentication required)
app.use("/api/auth", authRoutes);

app.get("/health", (req, res) => {
  res.json({ working: true });
});

// Protected routes middleware - all routes after this require authentication
app.use("/api", authenticate);

// Your other protected routes go here
// app.use("/api/users", usersRoutes);
// app.use("/api/teams", teamsRoutes);
// etc.

export default app;
