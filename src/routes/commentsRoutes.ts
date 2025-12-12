import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as commentsController from "../controllers/commentsController.ts";

const router = Router();

// Schemas
const createCommentSchema = z.object({
  content: z.string().min(1),
  postId: z.number(),
});

const updateCommentSchema = createCommentSchema.partial();

// GET endpoints
router.get("/:commentId", commentsController.getCommentById);
router.get("/post/:postId", commentsController.getPostComments);

// POST endpoints
router.post(
  "/",
  validateBody(createCommentSchema),
  commentsController.addComment
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
