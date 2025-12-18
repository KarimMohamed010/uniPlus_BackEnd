import { Router } from "express";
import {
  getEngagementReport,
  getTeamEngagementReportScoped,
  getManagerialReport,
  getParticipationReport,
  getTeamParticipationReport,
  getPostsPerTeam,
  getEventsPerTeam,
} from "../controllers/reportController.ts";
import { authenticate, requireGlobalRole } from "../middleware/auth.ts";

const router = Router();

router.use(authenticate);

// Team-scoped reports (admin OR team leader OR organizer)
router.get("/teams/:teamId/participation", getTeamParticipationReport);
router.get("/teams/:teamId/engagement", getTeamEngagementReportScoped);

// Admin-only reports
router.use(requireGlobalRole(["admin"]));

// Get participation report
router.get("/participation", getParticipationReport);

// Get engagement report
router.get("/engagement", getEngagementReport);

// Posts and events per team (admin)
router.get("/posts-per-team", getPostsPerTeam);
router.get("/events-per-team", getEventsPerTeam);

// Get managerial report
router.get("/managerial", getManagerialReport);

export default router;
