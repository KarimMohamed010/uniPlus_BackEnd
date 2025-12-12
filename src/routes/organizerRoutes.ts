import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as organizerController from "../controllers/organizerController.ts";

const router = Router();

// Schema for publishing events
const publishEventSchema = z.object({
  eventId: z.number(),
});

// Schema for checking in attendees
const checkInAttendeeSchema = z.object({
  ticketId: z.number(),
});

// Schema for issuing certificates
const issueCertificateSchema = z.object({
  ticketId: z.number(),
  certificationUrl: z.string().url(),
});

// Schema for responding to applications
const respondToApplicationSchema = z.object({
  applicationId: z.number(),
  status: z.enum(["approved", "rejected"]),
});

// Schema for submitting event request
const submitEventRequestSchema = z.object({
  eventId: z.number(),
});

// 1. Publish event (submit for approval)
router.post(
  "/events/:eventId/publish",
  validateBody(publishEventSchema),
  organizerController.publishEvent
);

// 2. Get event attendee statistics
router.get("/events/:eventId/stats", organizerController.getEventAttendeeStats);

// 3. Check in attendee via QR code
router.post(
  "/events/:eventId/checkin",
  validateBody(checkInAttendeeSchema),
  organizerController.checkInAttendee
);

// 4. Get event feedback and ratings
router.get("/events/:eventId/feedback", organizerController.getEventFeedback);

// 5. Issue certificate to attendee
router.post(
  "/certificates",
  validateBody(issueCertificateSchema),
  organizerController.issueCertificate
);

// 6. Submit event for admin approval
router.post(
  "/events/request-approval",
  validateBody(submitEventRequestSchema),
  organizerController.submitEventRequest
);

// 7. Respond to team member applications
router.post(
  "/applications/:applicationId/respond",
  validateBody(respondToApplicationSchema),
  organizerController.respondToApplication
);

export default router;
