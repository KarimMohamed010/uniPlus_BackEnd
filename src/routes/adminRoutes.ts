import { Router } from "express";
import {  validateBody } from "../middleware/validation.ts";
import { authenticate } from "../middleware/auth.ts";
import { z } from "zod";
import { signUpSchema } from "./authRoutes.ts";
import * as adminController from "../controllers/adminController.ts";
import { a } from "vitest/dist/chunks/suite.d.FvehnV49.js";

const router = Router()
const updateAdminSchema = signUpSchema.partial()
router.use(authenticate)

router.post('/admins', validateBody(signUpSchema), adminController.addAdmin)
router.patch('/admins/:adminId', validateBody(updateAdminSchema), adminController.updateAdmin)


export default router

