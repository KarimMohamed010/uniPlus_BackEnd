import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import {
  sendVerificationCode,
  signIn,
  signUp,
  verifyVerificationCode,
} from "../controllers/authController.ts";
// import { asyncHandler } from "../utils/wrappers.ts";
import { insertUserSchema } from "../db/schema.ts";

const router = Router();

export const signUpSchema  = insertUserSchema.extend({
  email: z.email("Invalid email"),
  verificationId: z.string().min(1, "Verification is required"),
});

export const sendEmailCodeSchema = z.object({
  email: z
  .email("Invalid email format")
  .refine(
    (email) =>
      email.endsWith("@gmail.com") || email.endsWith("@webxio.pro"),
    {
      message: "Email must be a @gmail.com or @webxio.pro address",
    }
  ),
});

export const verifyEmailCodeSchema = z.object({
  email: z.email("Invalid email"),
  verificationId: z.string().min(1, "Verification is required"),
  code: z.string().min(1, "Code is required"),
});

export const signInSchema = z.object({
  email: z.email("Invalid email"),
  userPassword: z.string().min(6, "Password must be at least 6 characters long"),

});

router.post("/email/send-code", validateBody(sendEmailCodeSchema), sendVerificationCode);
router.post(
  "/email/verify-code",
  validateBody(verifyEmailCodeSchema),
  verifyVerificationCode
);
router.post("/sign-up", validateBody(signUpSchema), signUp);
router.post("/sign-in", validateBody(signInSchema), signIn);

export default router;
