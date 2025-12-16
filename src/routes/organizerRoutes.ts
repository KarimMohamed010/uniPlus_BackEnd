import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as organizerController from "../controllers/organizerController.ts";

const router = Router();

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



// 5. Issue certificate to attendee
router.post(
  "/certificates",
  validateBody(issueCertificateSchema),
  organizerController.issueCertificate
);

// 7. Respond to team member applications
router.post(
  "/applications/:applicationId/respond",
  validateBody(respondToApplicationSchema),
  organizerController.respondToApplication
);

export default router;
