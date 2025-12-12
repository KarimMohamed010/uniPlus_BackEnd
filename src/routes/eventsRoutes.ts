import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as eventsController from "../controllers/eventsController.ts";

const router = Router();

// Schemas
const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  teamId: z.number(),
});

const updateEventSchema = createEventSchema.partial();

const approveEventSchema = z.object({
  acceptanceStatus: z.enum(["approved", "rejected"]),
});

const assignSpeakerSchema = z.object({
  speakerId: z.number(),
  eventId: z.number(),
});

const assignRoomSchema = z.object({
  roomId: z.number(),
});

const searchEventSchema = z.object({
  query: z.string(),
});

// GET endpoints
router.get("/", eventsController.getAllEvents);
router.get("/pending", eventsController.getPendingEvents);
router.get(
  "/search",
  validateBody(searchEventSchema),
  eventsController.searchEvents
);
router.get("/type/:type", eventsController.getEventsByType);
router.get("/date/:date", eventsController.getEventsByDate);
router.get("/:eventId", eventsController.getEventById);
router.get("/:eventId/registrations", eventsController.getEventRegistrations);
router.get("/:eventId/feedback", eventsController.getEventFeedback);
router.get("/:eventId/speakers", eventsController.getEventSpeakers);
router.get("/:eventId/room", eventsController.getEventRoom);
router.get("/team/:teamId", eventsController.getTeamEvents);

// POST endpoints
router.post("/", validateBody(createEventSchema), eventsController.createEvent);
router.post(
  "/:eventId/speakers",
  validateBody(assignSpeakerSchema),
  eventsController.assignSpeakerToEvent
);
router.post(
  "/:eventId/room",
  validateBody(assignRoomSchema),
  eventsController.assignRoomToEvent
);

// PATCH endpoints
router.patch(
  "/:eventId",
  validateBody(updateEventSchema),
  eventsController.updateEvent
);
router.patch(
  "/:eventId/approve",
  validateBody(approveEventSchema),
  eventsController.approveEvent
);
router.patch(
  "/:eventId/speakers/:speakerId",
  validateBody(assignSpeakerSchema),
  eventsController.changeSpeaker
);

// DELETE endpoints
router.delete("/:eventId", eventsController.deleteEvent);
router.delete(
  "/:eventId/speakers/:speakerId",
  eventsController.removeSpeakerFromEvent
);
router.delete("/:eventId/room", eventsController.removeRoomFromEvent);

export default router;
