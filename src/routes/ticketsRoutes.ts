import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as studentController from "../controllers/studentController.ts";
import { verifyQr } from "../controllers/organizerController.ts";
const router = Router();

// Schemas
const registerEventSchema = z.object({
  eventId: z.number(),
});

const checkInQRSchema = z.object({
  ticketId: z.number(),
  qrCode: z.string(),
});

const rateEventSchema = z.object({
  eventId: z.number(),
  rating: z.number().min(0).max(5),
  feedback: z.string().optional(),
});

// GET endpoints
// router.get("/", studentController.getAvailableEvents);
router.get("/my/upcoming", studentController.getMyUpcomingRegisteredEvents);
router.get("/my/attended", studentController.getMyAttendedRegisteredEvents);
router.get("/my/registration", studentController.getMyOnlyRegisteredEvents);
router.get("/:ticketId", studentController.getMyTicket);

// POST endpoints
router.post(
  "/register",
  validateBody(registerEventSchema),
  studentController.registerForEvent
);
router.post(
  "/checkin",
  validateBody(checkInQRSchema),
  studentController.checkInViaQR
);


router.post(
  "/rate",
  validateBody(rateEventSchema),
  studentController.rateEvent
);

router.patch(
  "/verifyQr",
  verifyQr
);

export default router;
