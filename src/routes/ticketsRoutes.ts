import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as studentController from "../controllers/studentController.ts";
import { verifyQr, issueCertificate } from "../controllers/organizerController.ts";
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

const issueCertificateSchema = z.object({
  eventId: z.number(),
  studentId: z.number(),
  certUrl: z.string(),
});

// GET endpoints
// router.get("/", studentController.getAvailableEvents);
router.get("/my/upcoming", studentController.getMyUpcomingRegisteredEvents);
router.get("/my/attended", studentController.getMyAttendedRegisteredEvents);
router.get("/my/registration", studentController.getMyOnlyRegisteredEvents);
router.get("/event/:eventId", studentController.getMyTicket); // Get my ticket for a specific event
router.get("/certificates/:studentId", studentController.getCertificates); // Get certificates for a student
router.get("/badges", studentController.getBadges); // Get current user's badges

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

router.patch(
  "/certificate",
  validateBody(issueCertificateSchema),
  issueCertificate
);

export default router;
