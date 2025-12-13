import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import { signUpSchema } from "./authRoutes.ts";
import * as adminController from "../controllers/adminController.ts";
import { authenticate, requireGlobalRole } from "../middleware/auth.ts";

const router = Router();

// Middleware: Require admin role for all routes
router.use(authenticate);
router.use(requireGlobalRole(["admin"]));

// Schema for updating admin info
const updateAdminSchema = signUpSchema.partial();

// Schema for approving/rejecting teams
const approveTeamSchema = z.object({
  acceptanceStatus: z.enum(["approved", "rejected"]),
});

// Schema for approving items
const approveItemSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
  itemType: z.enum(["event", "team"]),
});

// Schema for adding admin
const addAdminSchema = z.object({
  userId: z.string(),
});

// Schema for issuing warnings
const issueWarningSchema = z.object({
  userId: z.string().or(z.number()),
  reason: z.string().min(1, "Reason is required"),
});

// Schema for sending announcements
const sendAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
});

// Schema for toggling user status
const toggleUserStatusSchema = z.object({
  userId: z.number(),
  isActive: z.boolean().optional(),
});

// 1. Get pending approvals (events and organizations)
// router.get("/approvals/pending", adminController.getPendingApprovals);

// 2. Approve or reject an item
// router.patch(
//   "/approvals/:itemId",
//   validateBody(approveItemSchema),
//   adminController.approveItem
// );

// 3. Add new admin
router.post("/", validateBody(addAdminSchema), adminController.addAdmin);

// 4. Get all admins
// router.get("/list", adminController.getAllAdmins);

// 5. Update admin info
router.patch(
  "/:adminId",
  validateBody(updateAdminSchema),
  adminController.updateAdmin
);

// 6. Approve or reject team
router.patch(
  "/teams/:teamId/approve",
  validateBody(approveTeamSchema),
  adminController.approveTeam
);

// 7. Get event participation report
router.get(
  "/reports/events/:eventId",
  adminController.getEventParticipationReport
);

// 8. Generate participation report
// router.get(
//   "/reports/participation",
//   adminController.generateParticipationReport
// );

// 9. Generate engagement report
// router.get("/reports/engagement", adminController.generateEngagementReport);

// 10. Get team engagement report
router.get("/reports/teams/:teamId", adminController.getTeamEngagementReport);

// 11. Issue warning to user
router.post(
  "/warnings",
  validateBody(issueWarningSchema),
  adminController.issueWarning
);

// // 12. Get warnings for a specific user
// router.get("/warnings/:userId", adminController.getUserWarnings);

// // 13. Get all users
// router.get("/users/list", adminController.getAllUsers);

// // 14. Toggle user status (activate/deactivate)
// router.patch("/users/:userId/status", adminController.toggleUserStatus);

// // 15. Send announcement
// router.post(
//   "/announcements",
//   validateBody(sendAnnouncementSchema),
//   adminController.sendAnnouncement
// );

// // 16. Get all announcements
// router.get("/announcements", adminController.getAnnouncements);

// 17. Get received support messages
router.get("/messages", adminController.getAdminMessages);

export default router;
