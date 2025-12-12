import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as studentController from "../controllers/studentController.ts";

const router = Router();

// Schemas
const sendMessageSchema = z.object({
  receiverId: z.number(),
  content: z.string().min(1),
});

// GET endpoints
router.get("/", studentController.getNotifications);

// POST endpoints
router.post(
  "/send",
  validateBody(sendMessageSchema),
  studentController.sendMessage
);

export default router;
