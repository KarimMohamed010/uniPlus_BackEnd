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

export const signInSchema = z.object({
  email: z.email("Invalid email"),
  userPassword: z.string().min(6, "Password must be at least 6 characters long"),

});

router.post("/sign-up", validateBody(signUpSchema), signUp);
router.post("/sign-in", validateBody(signInSchema), signIn);

export default router;
