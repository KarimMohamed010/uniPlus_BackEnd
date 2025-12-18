import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as postsController from "../controllers/postsController.ts";

const router = Router();

// Schemas
const createPostSchema = z.object({
  description: z.string().min(1),
  teamId: z.number(),
  media: z
    .array(
      z.object({
        url: z.string().min(1),
        type: z.string().min(1),
        description: z.string().optional(),
        id: z.number().optional(),
      })
    )
    .optional(),
});

const updatePostSchema = z
  .object({
    description: z.string().min(1).optional(),
    media: z
      .array(
        z.object({
          id: z.number(),
          url: z.string().min(1),
          type: z.string().min(1),
          description: z.string().optional(),
        })
      )
      .optional(),
  })
  .partial();

const reportPostSchema = z.object({
  description: z.string().min(1),
});

// GET endpoints
router.get("/", postsController.getAllPosts);
router.get("/feed", postsController.getUserFeed);
router.get("/team/:teamId", postsController.getTeamPosts);
router.get("/team/:teamId/reported", postsController.getReportedPosts);
router.get("/user/:userId", postsController.getUserPosts);
router.get("/:postId", postsController.getPostById);

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
  postsController.editPost
);

// DELETE endpoints
router.delete("/:postId", postsController.deletePost);

export default router;
