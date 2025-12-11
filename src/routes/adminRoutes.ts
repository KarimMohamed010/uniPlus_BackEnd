import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import { insertUserSchema } from "../db/schema.ts";

const updateAdminschema = insertUserSchema.extend({

})
