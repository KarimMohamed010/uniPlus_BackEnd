import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import { signUpSchema } from "./authRoutes.ts";
import * as adminController from "../controllers/adminController.ts";

const router = Router();

// Schema for updating admin info
const updateAdminSchema = signUpSchema.partial();

// Schema for approving/rejecting teams
const approveTeamSchema = z.object({
  acceptanceStatus: z.enum(["approved", "rejected"]),
});

// Schema for issuing warnings
const issueWarningSchema = z.object({
  userId: z.number(),
  message: z.string().min(1),
});

// Schema for sending announcements
const sendAnnouncementSchema = z.object({
  userIds: z.array(z.number()),
  content: z.string().min(1),
});

// Schema for toggling user status
const toggleUserStatusSchema = z.object({
  userId: z.number(),
  isActive: z.boolean(),
});

// 1. Add new admin
router.post("/", validateBody(signUpSchema), adminController.addAdmin);

// 2. Update admin info
router.patch(
  "/:adminId",
  validateBody(updateAdminSchema),
  adminController.updateAdmin
);

// 3. Approve or reject team
router.patch(
  "/teams/:teamId/approve",
  validateBody(approveTeamSchema),
  adminController.approveTeam
);

// 4. Get event participation report
router.get(
  "/reports/events/:eventId",
  adminController.getEventParticipationReport
);

// 5. Get team engagement report
router.get("/reports/teams/:teamId", adminController.getTeamEngagementReport);

// 6. Issue warning to user
router.post(
  "/warnings",
  validateBody(issueWarningSchema),
  adminController.issueWarning
);

// 7. Toggle user status (activate/deactivate)
router.patch(
  "/users/:userId/status",
  validateBody(toggleUserStatusSchema),
  adminController.toggleUserStatus
);

// 8. Send announcement
router.post(
  "/announcements",
  validateBody(sendAnnouncementSchema),
  adminController.sendAnnouncement
);

// 9. Get received support messages
router.get("/messages", adminController.getAdminMessages);

export default router;
