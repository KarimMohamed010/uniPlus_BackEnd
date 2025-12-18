import { Router } from "express";
import { validateBody } from "../middleware/validation.ts";
import { z } from "zod";
import * as eventsController from "../controllers/eventsController.ts";

const router = Router();

// Schemas
export const createEventSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['online', 'offline']).optional(),
    startTime: z.string(),
    endTime: z.string(),
    basePrice: z.number().optional(),
    teamId: z.number(),
    speakerId: z.number(),
    speakerId2: z.number().optional(),
    roomId: z.number().optional(), // Make sure this is optional!
});
// Schema for rating events
const rateEventSchema = z.object({
  eventId: z.number(),
  rating: z.number().min(0).max(5),
  feedback: z.string().optional(),
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

const addRoomSchema = z.object({
  name: z.string().min(1).max(50),
  capacity: z.number().min(1),
  location: z.string().optional(),
});

const searchEventSchema = z.object({
  query: z.string(),
});

// GET endpoints
router.get("/", eventsController.getAllEvents);
router.get("/pending", eventsController.getPendingEvents);
router.get("/rooms", eventsController.getAllRooms);
router.get("/speakers", eventsController.getAllSpeakers);
router.get("/search", validateBody(searchEventSchema), eventsController.searchEvents);
router.get("/type/:type", eventsController.getEventsByType);
router.get("/date/:date", eventsController.getEventsByDate);
router.get("/:eventId", eventsController.getEventById);
router.get("/:eventId/registrations", eventsController.getEventRegistrations);
router.get("/:eventId/feedback", eventsController.getEventFeedback);
router.get("/:eventId/speakers", eventsController.getEventSpeakers);
router.get("/:eventId/room", eventsController.getEventRoom);
router.get("/team/:teamId", eventsController.getTeamEvents);
router.get("/events/upcoming", eventsController.getMyUpcomingRegisteredEvents);
router.get("/events/attended", eventsController.getMyAttendedRegisteredEvents);
router.get("/events/upcoming", eventsController.getUpcomingEvents);
router.get("/events/:eventId/stats", eventsController.getEventAttendeeStats);

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
// 5. Rate and provide feedback for event
router.post(
  "/events/rate",
  validateBody(rateEventSchema),
  eventsController.rateEvent
);
// Add room (Admin only)
router.post(
  "/rooms",
  validateBody(addRoomSchema),
  eventsController.addRoom
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
router.delete("/:speakerId", eventsController.removeSpeaker);
router.delete(
  "/:eventId/speakers/:speakerId",
  eventsController.removeSpeakerFromEvent
);
router.delete("/:eventId/room", eventsController.removeRoomFromEvent);
// 8. Cancel event registration
router.delete("/:eventId/cancel", eventsController.cancelRegistration);
export default router;
