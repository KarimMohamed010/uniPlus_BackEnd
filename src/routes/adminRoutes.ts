import { Router } from "express";
import {  validateBody } from "../middleware/validation.ts";
import { authenticate } from "../middleware/auth.ts";
import { z } from "zod";
import { signUpSchema } from "./authRoutes.ts";
import * as adminController from "../controllers/adminController.ts";
import { a } from "vitest/dist/chunks/suite.d.FvehnV49.js";

const router = Router()

router.use(authenticate)

router.post('/admins', validateBody(signUpSchema), adminController.addAdmin)


export default router

