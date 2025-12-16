import { Router } from "express";
import {
  getEngagementReport,
  getManagerialReport,
  getParticipationReport,
} from "../controllers/reportController.ts";
import { authenticate, requireGlobalRole } from "../middleware/auth.ts";

const router = Router();

router.use(authenticate);
router.use(requireGlobalRole(["admin"]));

// Get participation report
router.get("/participation", getParticipationReport);

// Get engagement report
router.get("/engagement", getEngagementReport);

// Get managerial report
router.get("/managerial", getManagerialReport);

export default router;
