import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as studentController from "../controllers/studentController.ts";

const router = Router();

// Schema for registering for events
const registerEventSchema = z.object({
  eventId: z.number(),
});

// Schema for checking in via QR
const checkInQRSchema = z.object({
  ticketId: z.number(),
  qrCode: z.string(),
});

// Schema for applying to team
const applyToTeamSchema = z.object({
  teamId: z.number(),
  desiredRole: z.string().optional(),
  cv: z.string().optional(),
});

// Schema for rating events
const rateEventSchema = z.object({
  eventId: z.number(),
  rating: z.number().min(0).max(5),
  feedback: z.string().optional(),
});

// Schema for sending messages
const sendMessageSchema = z.object({
  receiverId: z.number(),
  content: z.string().min(1),
});

// 1. Get all available events
router.get("/events/available", studentController.getAvailableEvents);

// 2. Register for an event
router.post(
  "/events/register",
  validateBody(registerEventSchema),
  studentController.registerForEvent
);

// 3. Check in to event via QR code
router.post(
  "/events/checkin",
  validateBody(checkInQRSchema),
  studentController.checkInViaQR
);

// 4. Apply to team
router.post(
  "/teams/apply",
  validateBody(applyToTeamSchema),
  studentController.applyToTeam
);

// 5. Rate and provide feedback for event
router.post(
  "/events/rate",
  validateBody(rateEventSchema),
  studentController.rateEvent
);

// 6. Send message to another student
router.post(
  "/messages/send",
  validateBody(sendMessageSchema),
  studentController.sendMessage
);

// 7. Get my ticket for an event
router.get("/tickets/:ticketId", studentController.getMyTicket);

// 8. Cancel event registration
router.delete("/events/:eventId/cancel", studentController.cancelRegistration);

// 9. Get my upcoming registered events
router.get("/events/upcoming", studentController.getMyUpcomingRegisteredEvents);

// 10. Get my attended events
router.get("/events/attended", studentController.getMyAttendedRegisteredEvents);

// 11. Get notifications/messages
router.get("/notifications", studentController.getNotifications);

export default router;
