import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as commentsController from "../controllers/commentsController.ts";

const router = Router();

// Schemas
const createCommentSchema = z.object({
  content: z.string().min(1),
  postId: z.number(),
  parentId: z.number().optional(),
});

const updateCommentSchema = createCommentSchema.partial();

// GET endpoints
router.get("/post/:postId", commentsController.getPostComments);
router.get("/:commentId", commentsController.getCommentById);

// Replies routes
router.get("/:commentId/replies", commentsController.getCommentReplies);

// POST endpoints
router.post(
  "/",
  validateBody(createCommentSchema),
  commentsController.addComment
);

// Create a reply to a specific comment
router.post(
  "/:commentId/replies",
  validateBody(z.object({ content: z.string().min(1), postId: z.number().optional() })),
  commentsController.addReply
);

// PATCH endpoints
router.patch(
  "/:commentId",
  validateBody(updateCommentSchema),
  commentsController.editComment
);

// DELETE endpoints
router.delete("/:commentId", commentsController.deleteComment);

export default router;
