import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as messagesController from "../controllers/messagesController.ts";

const router = Router();

// Schemas
const sendMessageSchema = z.object({
  receiverId: z.number(),
  content: z.string().min(1),
});

// GET endpoints
router.get("/unread", messagesController.getNotifications);
router.get("/received", messagesController.getRecievedMessages);
router.get("/sent", messagesController.getSentMessages);


// POST endpoints
router.post(
  "/send",
  validateBody(sendMessageSchema),
  messagesController.sendMessage
);

export default router;
