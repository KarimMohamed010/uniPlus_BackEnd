import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as teamsController from "../controllers/teamsController.ts";

const router = Router();

const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const updateTeamSchema = createTeamSchema.partial();

router.get("/", teamsController.getAllTeams);
router.get("/:id", teamsController.getTeamById);
router.post("/", validateBody(createTeamSchema), teamsController.createTeam);
router.patch("/:id", validateBody(updateTeamSchema), teamsController.updateTeam);

export default router;
