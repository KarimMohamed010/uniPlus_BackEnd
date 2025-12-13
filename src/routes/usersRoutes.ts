import { Router } from "express";
import * as usersController from "../controllers/usersController.ts";

const router = Router();
router.get("/:username", usersController.getUserByUsername);

export default router;
