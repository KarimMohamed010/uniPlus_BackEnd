import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { isTestEnv, env } from "./env.ts";
import authRoutes from "./routes/authRoutes.ts";
import eventsRoutes from "./routes/eventsRoutes.ts";
import postsRoutes from "./routes/postsRoutes.ts";
import commentsRoutes from "./routes/commentsRoutes.ts";
import ticketsRoutes from "./routes/ticketsRoutes.ts";
import applicationsRoutes from "./routes/applicationsRoutes.ts";
import messagesRoutes from "./routes/messagesRoutes.ts";
import usersRoutes from "./routes/usersRoutes.ts";
import studentsRoutes from "./routes/studentsRoutes.ts";
import adminsRoutes from "./routes/adminsRoutes.ts";
import organizerRoutes from "./routes/organizerRoutes.ts";
import teamsRoutes from "./routes/teamsRoutes.ts";
import ridesRoutes from "./routes/ridesRoutes.ts";
import announcementsRoutes from "./routes/announcementsRoutes.ts";
import reportRoutes from "./routes/reportRoutes.ts";
import { authenticate } from "./middleware/auth.ts";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: [
      env.FRONTEND_URL,
      "http://localhost:5173",
      "http://localhost:4173",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options(/.*/, cors());


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

// Resource-based RESTful routes
app.use("/api/events", eventsRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/applications", applicationsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/admin", adminsRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/rides", ridesRoutes);

export default app;
