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



// Schema for sending messages
const sendMessageSchema = z.object({
  receiverId: z.number(),
  content: z.string().min(1),
});


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





// 7. Get my ticket for an event
router.get("/tickets/:ticketId", studentController.getMyTicket);

// I'm not sure with the url of the functions below

router.patch("/profile", studentController.updateProfile);

router.get("/profile", studentController.getProfile);

router.get("/:studentId/certificates", studentController.getCertificates);


export default router;
