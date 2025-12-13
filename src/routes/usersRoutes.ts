import { Router } from "express";
import * as usersController from "../controllers/usersController.ts";
import { authenticate } from "../middleware/auth.ts";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";

const router = Router();

// Schema for changing password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// Get user by username (public)
router.get("/:username", usersController.getUserByUsername);

// Change password (protected)
router.patch(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  usersController.changePassword
);

export default router;
