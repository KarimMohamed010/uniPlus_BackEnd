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
router.get("/badges", teamsController.getStudentsWithBadges); // Get all students with badges
router.get("/my-subscribed", teamsController.getMyTeams);
router.get("/user/:userId", teamsController.getUserTeams);
router.get("/:id", teamsController.getTeamById);
router.get("/:id/members", teamsController.getTeamMembers);

router.post("/", validateBody(createTeamSchema), teamsController.createTeam);


router.patch("/:id", validateBody(updateTeamSchema), teamsController.updateTeam);
router.patch("/:id/members", teamsController.updateMemberRole);

router.delete("/:id/members", teamsController.removeMember);
router.delete("/:id/leave", teamsController.leaveTeam);
router.delete("/:id", teamsController.deleteTeam);

router.post("/:id/subscribe", teamsController.subscribeToTeam);
router.delete("/:id/subscribe", teamsController.unsubscribeFromTeam);

router.patch("/:teamId/accept", teamsController.acceptTeam);

router.get("/:id/applications", teamsController.getTeamApplications);
router.post("/:id/applications/:studentId/accept", teamsController.acceptApplication);
router.post("/:id/applications/:studentId/reject", teamsController.rejectApplication);


export default router;
