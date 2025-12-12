import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as postsController from "../controllers/postsController.ts";

const router = Router();

// Schemas
const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  teamId: z.number().optional(),
});

const updatePostSchema = createPostSchema.partial();

const reportPostSchema = z.object({
  reason: z.string(),
});

// GET endpoints
router.get("/", postsController.getAllPosts);
router.get("/feed", postsController.getUserFeed);
router.get("/:postId", postsController.getPostById);
router.get("/team/:teamId", postsController.getTeamPosts);

// POST endpoints
router.post(
  "/",
  validateBody(createPostSchema),
  postsController.createPostHandler
);
router.post(
  "/:postId/report",
  validateBody(reportPostSchema),
  postsController.reportPost
);

// PATCH endpoints
router.patch(
  "/:postId",
  validateBody(updatePostSchema),
  postsController.editPost
);

// DELETE endpoints
router.delete("/:postId", postsController.deletePost);

export default router;
