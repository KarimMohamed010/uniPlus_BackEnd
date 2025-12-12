import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as studentController from "../controllers/studentController.ts";

const router = Router();

// Schemas
const applyToTeamSchema = z.object({
  teamId: z.number(),
  desiredRole: z.string().optional(),
  cv: z.string().optional(),
});

// POST endpoints
router.post(
  "/apply",
  validateBody(applyToTeamSchema),
  studentController.applyToTeam
);

export default router;
