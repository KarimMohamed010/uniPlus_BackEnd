import { Router } from "express";
import * as announcementsController from "../controllers/announcementsController.ts";
import { authenticate, requireGlobalRole } from "../middleware/auth.ts";

const router = Router();

// Get announcements (Authenticated users)
router.get("/", authenticate, announcementsController.getAnnouncements);

// Create announcement (Admins only)
router.post(
  "/",
  authenticate,
  requireGlobalRole(["admin"]),
  announcementsController.createAnnouncement
);

// Delete announcement (Admins only)
router.delete(
  "/:id",
  authenticate,
  requireGlobalRole(["admin"]),
  announcementsController.deleteAnnouncement
);

export default router;
