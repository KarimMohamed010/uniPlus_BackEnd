import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import { signUp, signIn } from "../controllers/authController.ts";
// import { asyncHandler } from "../utils/wrappers.ts";
import { insertUserSchema, selectUserSchema, type NewUser } from "../db/schema.ts";

const router = Router();

export const signUpSchema  = insertUserSchema.extend({
  email: z.email("Invalid email"),
});

export const signInSchema = selectUserSchema.extend({
  email: z.email("Invalid email"),

});

router.post("/sign-up", validateBody(signUpSchema), signUp);
router.post("/sign-in", validateBody(signInSchema), signIn);

export default router;
