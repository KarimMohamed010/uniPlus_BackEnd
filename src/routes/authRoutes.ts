import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { signUp, signIn } from "../controllers/authController.ts";
import { asyncHandler } from "../utils/wrappers.ts";
import { minLength, z } from "zod";
import { insertUserSchema, selectUserSchema } from "../db/schema.ts";

const router = Router();

const signUpSchema = insertUserSchema.extend({
  email: z.email("Invalid email"),
});

const signInSchema = selectUserSchema.extend({
  email: z.email("Invalid email"),
});

router.post("/sign-up", validateBody(signUpSchema), signUp);
router.post("/sign-in", validateBody(signInSchema), asyncHandler(signIn));

export default router;
