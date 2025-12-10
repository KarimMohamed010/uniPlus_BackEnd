import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { signUp, signIn } from "../controllers/authController.ts";
import { asyncHandler } from "../utils/wrappers.ts";
import { z } from "zod";

const router = Router();

const signUpSchema = z.object({
  email: z.string().email("Invalid email"),
  fname: z.string().min(1, "First name is required"),
  lname: z.string().min(1, "Last name is required"),
  userPassword: z.string().min(6, "Password must be at least 6 characters"),
  bio: z.string().optional(),
  imgUrl: z.string().optional(),
});

const signInSchema = z.object({
  email: z.string().email("Invalid email"),
  userPassword: z.string().min(1, "Password is required"),
});

router.post("/sign-up", validateBody(signUpSchema), asyncHandler(signUp));
router.post("/sign-in", validateBody(signInSchema), asyncHandler(signIn));

export default router;
