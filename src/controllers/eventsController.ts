import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
    events,
    teams,
    admins,
    belongTo,
    speak,
    speakers,
    ticketsAndFeedback,
    students,
    users,
    rooms,
    takePlace,
} from "../db/schema.ts";
import { eq, desc, and, sql, isNotNull, like, gt, lt, asc } from "drizzle-orm";

// 1. Create an event ( organizer role only )
export async function createEvent(
    req: Request<any, any, { title: string; description?: string; type?: string; startTime: string; endTime: string; basePrice?: number; teamId: number }>,
    res: Response
) {
    try {
        const { title, description, type, startTime, endTime, basePrice, teamId } = req.body;
        const userId = (req as any).user.id;

        // Check if user is a team member with organizer role
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, teamId),
                    eq(belongTo.role, "organizer")
                )
            );

        if (membership.length === 0) {
            return res.status(403).json({ error: "Only team organizers can create events" });
        }

        const [newEvent] = await db
            .insert(events)
            .values({
                title,
                description,
                type,
                startTime,
                endTime,
                basePrice,
                teamId,
                acceptanceStatus: "pending",
            })
            .returning();

        return res.status(201).json({
            message: "Event created successfully",
            event: newEvent,
        });
    } catch (error) {
        console.error("Error creating event:", error);
        res.status(500).json({ error: "Failed to create event" });
    }
}

// 2. Get all approved events
export async function getAllEvents(req: Request, res: Response) {
    try {
        const eventsData = await db
            .select({
                id: events.id,
                title: events.title,
                description: events.description,
                type: events.type,
                issuedAt: events.issuedAt,
                startTime: events.startTime,
                endTime: events.endTime,
                basePrice: events.basePrice,
                acceptanceStatus: events.acceptanceStatus,
                team: {
                    id: teams.id,
                    name: teams.name,
                    leaderId: teams.leaderId,
                },
            })
            .from(events)
            .innerJoin(teams, eq(events.teamId, teams.id))
            .where( eq(events.acceptanceStatus, "approved"))
            .orderBy(desc(events.startTime));

        return res.status(200).json({
            message: "Events retrieved successfully",
            events: eventsData,
        });
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ error: "Failed to fetch events" });
    }
}

// 3. Get events for a specific team
export async function getTeamEvents(req: Request<{ teamId: string }>, res: Response) {
    try {
        const { teamId } = req.params;

        const eventsData = await db
            .select({
                id: events.id,
                title: events.title,
                description: events.description,
                type: events.type,
                issuedAt: events.issuedAt,
                startTime: events.startTime,
                endTime: events.endTime,
                basePrice: events.basePrice,
                acceptanceStatus: events.acceptanceStatus,
                team: {
                    id: teams.id,
                    name: teams.name,
                    leaderId: teams.leaderId,
                },
            })
            .from(events)
            .innerJoin(teams, eq(events.teamId, teams.id))
            .where(and (eq(events.acceptanceStatus, "approved"), eq(events.teamId, parseInt(teamId))))
            .orderBy(desc(events.startTime));

        return res.status(200).json({
            message: "Events retrieved successfully",
            events: eventsData,
        });
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ error: "Failed to fetch events" });
}}

// 4. Update an event (organizer role only)
export async function updateEvent(req: Request<{ eventId: string }>, res: Response) {
    try {
        const { eventId } = req.params;
        const { title, description, type, startTime, endTime, basePrice } = req.body;
        const userId = (req as any).user.id;

        // Get event to check team
        const eventRecord = await db
            .select()
            .from(events)
            .where(eq(events.id, parseInt(eventId)));

        if (eventRecord.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Check if user is a team member with organizer role
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, eventRecord[0].teamId!),
                    eq(belongTo.role, "organizer")
                )
            );

        if (membership.length === 0) {
            return res.status(403).json({ error: "Only team organizers can update this event" });
        }

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;
        if (startTime !== undefined) updateData.startTime = startTime;
        if (endTime !== undefined) updateData.endTime = endTime;
        if (basePrice !== undefined) updateData.basePrice = basePrice;

        await db
            .update(events)
            .set(updateData)
            .where(eq(events.id, parseInt(eventId)));

        return res.status(200).json({
            message: "Event updated successfully",
        });
    } catch (error) {
        console.error("Error updating event:", error);
        res.status(500).json({ error: "Failed to update event" });
    }
}

// 5. Delete an event (organizer or admin)
export async function deleteEvent(req: Request<{ eventId: string }>, res: Response) {
    try {
        const { eventId } = req.params;
        const userId = (req as any).user.id;

        // Get event to check team
        const eventRecord = await db
            .select()
            .from(events)
            .where(eq(events.id, parseInt(eventId)));

        if (eventRecord.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Check if user is admin
        const adminRecord = await db
            .select()
            .from(admins)
            .where(eq(admins.id, userId));

        if (adminRecord.length > 0) {
            // Admin can delete
            await db.delete(events).where(eq(events.id, parseInt(eventId)));
            return res.status(200).json({ message: "Event deleted successfully" });
        }

        // Check if user is a team member with organizer role
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, eventRecord[0].teamId!),
                    eq(belongTo.role, "organizer")
                )
            );

        const teamLeader = await db
            .select()
            .from(teams)
            .where(
                and(
                    eq(teams.id, eventRecord[0].teamId!),
                    eq(teams.leaderId, userId)
                )
            );
        if (membership.length === 0 && teamLeader.length === 0) {
            return res.status(403).json({ error: "Unauthorized to delete this event" });
        }


        await db.delete(events).where(eq(events.id, parseInt(eventId)));

        return res.status(200).json({ message: "Event deleted successfully" });
    } catch (error) {
        console.error("Error deleting event:", error);
        res.status(500).json({ error: "Failed to delete event " });
    }
}

// 6. Approve/Reject an event (Admin only)
export async function approveEvent(req: Request<{ eventId: string }>, res: Response) {
    try {
        const { eventId } = req.params;
        const { status } = req.body; // "approved" or "rejected"
        const userId = (req as any).user.id;

        // Check if user is admin
        const adminRecord = await db
            .select()
            .from(admins)
            .where(eq(admins.id, userId));

        if (adminRecord.length === 0) {
            return res.status(403).json({ error: "Only admins can approve events" });
        }

        await db
            .update(events)
            .set({
                acceptanceStatus: status,
                respondedBy: userId,
            })
            .where(eq(events.id, parseInt(eventId)));

        return res.status(200).json({
            message: `Event ${status} successfully`,
        });
    } catch (error) {
        console.error("Error approving event:", error);
        res.status(500).json({ error: "Failed to approve event" });
    }
}

// 7. Assign a speaker to an event (Organizer only)
export async function assignSpeakerToEvent(req: Request, res: Response) {
    try {
        const { eventId, speakerId } = req.body;
        const userId = (req as any).user.id;

        // Get event to check team
        const eventRecord = await db
            .select()
            .from(events)
            .where(eq(events.id, eventId));

        if (eventRecord.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Check if user is team organizer
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, eventRecord[0].teamId!),
                    eq(belongTo.role, "organizer")
                )
            );

        if (membership.length === 0) {
            return res.status(403).json({ error: "Only team organizers can assign speakers" });
        }

        // Check if speaker exists
        const speakerRecord = await db
            .select()
            .from(speakers)
            .where(eq(speakers.id, speakerId));

        if (speakerRecord.length === 0) {
            return res.status(404).json({ error: "Speaker not found" });
        }

        await db.insert(speak).values({
            eventId,
            speakerId,
        });

        return res.status(201).json({
            message: "Speaker assigned to event successfully",
        });
    } catch (error: any) {
        // Handle duplicate assignment
        if (error.code === '23505') {
            return res.status(409).json({ error: "Speaker is already assigned to this event" });
        }
        console.error("Error assigning speaker:", error);
        res.status(500).json({ error: "Failed to assign speaker" });
    }
}

// 8. Remove a speaker from an event (Organizer only)
export async function removeSpeakerFromEvent(req: Request, res: Response) {
    try {
        const { eventId, speakerId } = req.body;
        const userId = (req as any).user.id;

        // Get event to check team
        const eventRecord = await db
            .select()
            .from(events)
            .where(eq(events.id, eventId));

        if (eventRecord.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Check if user is team organizer
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, eventRecord[0].teamId!),
                    eq(belongTo.role, "organizer")
                )
            );

        if (membership.length === 0) {
            return res.status(403).json({ error: "Only team organizers can remove speakers" });
        }

        await db.delete(speak).where(
            and(
                eq(speak.eventId, eventId),
                eq(speak.speakerId, speakerId)
            )
        );

        return res.status(200).json({
            message: "Speaker removed from event successfully",
        });
    } catch (error) {
        console.error("Error removing speaker:", error);
        res.status(500).json({ error: "Failed to remove speaker" });
    }
}

// 9. Get all speakers for a certain event
export async function getEventSpeakers(req: Request<{ eventId: string }>, res: Response) {
    try {
        const { eventId } = req.params;

        const speakersData = await db
            .select({
                id: speakers.id,
                name: speakers.name,
                bio: speakers.bio,
                fname: speakers.fname,
                lname: speakers.lname,
                contact: speakers.contact,
                email: speakers.email,
            })
            .from(speak)
            .innerJoin(speakers, eq(speak.speakerId, speakers.id))
            .where(eq(speak.eventId, parseInt(eventId)));

        return res.status(200).json({
            message: "Event speakers retrieved successfully",
            speakers: speakersData,
        });
    } catch (error) {
        console.error("Error fetching event speakers:", error);
        res.status(500).json({ error: "Failed to fetch event speakers" });
    }
}

// 10. Change a speaker for an event (Organizer only)
export async function changeSpeaker(req: Request, res: Response) {
    try {
        const { eventId, oldSpeakerId, newSpeakerId } = req.body;
        const userId = (req as any).user.id;

        // Get event to check team
        const eventRecord = await db
            .select()
            .from(events)
            .where(eq(events.id, eventId));

        if (eventRecord.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Check if user is team organizer
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, eventRecord[0].teamId!),
                    eq(belongTo.role, "organizer")
                )
            );

        if (membership.length === 0) {
            return res.status(403).json({ error: "Only team organizers can change speakers" });
        }

        // Check if old speaker is assigned to this event
        const oldAssignment = await db
            .select()
            .from(speak)
            .where(
                and(
                    eq(speak.eventId, eventId),
                    eq(speak.speakerId, oldSpeakerId)
                )
            );

        if (oldAssignment.length === 0) {
            return res.status(404).json({ error: "Old speaker is not assigned to this event" });
        }

        // Check if new speaker exists
        const newSpeakerRecord = await db
            .select()
            .from(speakers)
            .where(eq(speakers.id, newSpeakerId));

        if (newSpeakerRecord.length === 0) {
            return res.status(404).json({ error: "New speaker not found" });
        }
        //The replacement here is done by removing the old speaker and adding the new speaker
        // as the speaker id is partial key that give error when trying to chnge it 
        // Remove old speaker
        await db.delete(speak).where(
            and(
                eq(speak.eventId, eventId),
                eq(speak.speakerId, oldSpeakerId)
            )
        );

        // Assign new speaker
        await db.insert(speak).values({
            eventId,
            speakerId: newSpeakerId,
        });

        return res.status(200).json({
            message: "Speaker changed successfully",
        });
    } catch (error: any) {
        // Handle duplicate assignment
        if (error.code === '23505') {
            return res.status(409).json({ error: "New speaker is already assigned to this event" });
        }
        console.error("Error changing speaker:", error);
        res.status(500).json({ error: "Failed to change speaker" });
    }
}

// 11. Get single event by ID
export async function getEventById(req: Request<{ eventId: string }>, res: Response) {
    try {
        const { eventId } = req.params;

        const eventData = await db
            .select({
                id: events.id,
                title: events.title,
                description: events.description,
                type: events.type,
                issuedAt: events.issuedAt,
                startTime: events.startTime,
                endTime: events.endTime,
                basePrice: events.basePrice,
                acceptanceStatus: events.acceptanceStatus,
                team: {
                    id: teams.id,
                    name: teams.name,
                },
            })
            .from(events)
            .leftJoin(teams, eq(events.teamId, teams.id))
            .where(eq(events.id, parseInt(eventId)));

        if (eventData.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        return res.status(200).json({
            message: "Event retrieved successfully",
            event: eventData[0],
        });
    } catch (error) {
        console.error("Error fetching event:", error);
        res.status(500).json({ error: "Failed to fetch event" });
    }
}

// 12. Get pending events (Admin only)
export async function getPendingEvents(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;

        // Check if user is admin
        const adminRecord = await db
            .select()
            .from(admins)
            .where(eq(admins.id, userId));

        if (adminRecord.length === 0) {
            return res.status(403).json({ error: "Only admins can view pending events" });
        }

        const pendingEvents = await db
            .select({
                id: events.id,
                title: events.title,
                description: events.description,
                type: events.type,
                issuedAt: events.issuedAt,
                startTime: events.startTime,
                endTime: events.endTime,
                basePrice: events.basePrice,
                team: {
                    id: teams.id,
                    name: teams.name,
                },
            })
            .from(events)
            .innerJoin(teams, eq(events.teamId, teams.id))
            .where(eq(events.acceptanceStatus, "pending"))
            .orderBy(desc(events.issuedAt));

        return res.status(200).json({
            message: "Pending events retrieved successfully",
            events: pendingEvents,
        });
    } catch (error) {
        console.error("Error fetching pending events:", error);
        res.status(500).json({ error: "Failed to fetch pending events" });
    }
}

// 13. Get all registrations for an event (Organizer only)
export async function getEventRegistrations(
    req: Request<{ eventId: string }>,
    res: Response
) {
    try {
        const { eventId } = req.params;
        const userId = (req as any).user.id;

        // Get event to check team
        const eventRecord = await db
            .select()
            .from(events)
            .where(eq(events.id, parseInt(eventId)));

        if (eventRecord.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Check if user is team organizer
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, eventRecord[0].teamId!),
                    eq(belongTo.role, "organizer")
                )
            );

        if (membership.length === 0) {
            return res.status(403).json({
                error: "Only event organizers can view registrations"
            });
        }

        // Get all registrations with student details
        const registrations = await db
            .select({
                studentId: ticketsAndFeedback.studentId,
                studentName: sql`${users.fname} || ' ' || ${users.lname}`,
                email: users.email,
                price: ticketsAndFeedback.price,
                scanned: ticketsAndFeedback.scanned,
                rating: ticketsAndFeedback.rating,
                feedback: ticketsAndFeedback.feedback,
                dateIssued: ticketsAndFeedback.dateIssued,
            })
            .from(ticketsAndFeedback)
            .innerJoin(students, eq(ticketsAndFeedback.studentId, students.id))
            .innerJoin(users, eq(students.id, users.id))
            .where(eq(ticketsAndFeedback.eventId, parseInt(eventId)));

        return res.status(200).json({
            message: "Event registrations retrieved successfully",
            registrations,
        });
    } catch (error) {
        console.error("Error fetching registrations:", error);
        res.status(500).json({ error: "Failed to fetch registrations" });
    }
}

// 14. Assign room to event (Organizer only)
export async function assignRoomToEvent(
    req: Request<any, any, { eventId: number; roomId: number }>,
    res: Response
) {
    try {
        const { eventId, roomId } = req.body;
        const userId = (req as any).user.id;

        // Get event to check team
        const eventRecord = await db
            .select()
            .from(events)
            .where(eq(events.id, eventId));

        if (eventRecord.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Check if user is team organizer
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, eventRecord[0].teamId!),
                    eq(belongTo.role, "organizer")
                )
            );

        if (membership.length === 0) {
            return res.status(403).json({ error: "Only team organizers can assign rooms" });
        }

        // Check if event is offline
        if (eventRecord[0].type?.toLowerCase() !== "offline") {
            return res.status(400).json({ error: "Only offline events can have room assignments" });
        }

        // Check if room exists
        const roomRecord = await db
            .select()
            .from(rooms)
            .where(eq(rooms.id, roomId));

        if (roomRecord.length === 0) {
            return res.status(404).json({ error: "Room not found" });
        }

        // Assign room to event
        await db.insert(takePlace).values({
            eventId,
            roomId,
        });

        return res.status(201).json({
            message: "Room assigned to event successfully",
        });
    } catch (error: any) {
        // Handle duplicate assignment
        if (error.code === '23505') {
            return res.status(409).json({ error: "Event already has a room assigned" });
        }
        console.error("Error assigning room:", error);
        res.status(500).json({ error: "Failed to assign room" });
    }
}

// 15. Remove room from event (Organizer only)
export async function removeRoomFromEvent(
    req: Request<{ eventId: string }>,
    res: Response
) {
    try {
        const { eventId } = req.params;
        const userId = (req as any).user.id;

        // Get event to check team
        const eventRecord = await db
            .select()
            .from(events)
            .where(eq(events.id, parseInt(eventId)));

        if (eventRecord.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Check if user is team organizer
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, eventRecord[0].teamId!),
                    eq(belongTo.role, "organizer")
                )
            );

        if (membership.length === 0) {
            return res.status(403).json({ error: "Only team organizers can remove room assignments" });
        }

        // Remove room assignment
        await db.delete(takePlace).where(eq(takePlace.eventId, parseInt(eventId)));

        return res.status(200).json({
            message: "Room assignment removed successfully",
        });
    } catch (error) {
        console.error("Error removing room assignment:", error);
        res.status(500).json({ error: "Failed to remove room assignment" });
    }
}

// 16. Get event room (Public)
export async function getEventRoom(
    req: Request<{ eventId: string }>,
    res: Response
) {
    try {
        const { eventId } = req.params;

        const roomData = await db
            .select({
                id: rooms.id,
                name: rooms.name,
                capacity: rooms.capacity,
                location: rooms.location,
            })
            .from(takePlace)
            .innerJoin(rooms, eq(takePlace.roomId, rooms.id))
            .where(eq(takePlace.eventId, parseInt(eventId)));

        if (roomData.length === 0) {
            return res.status(404).json({ error: "No room assigned to this event" });
        }

        return res.status(200).json({
            message: "Event room retrieved successfully",
            room: roomData[0],
        });
    } catch (error) {
        console.error("Error fetching event room:", error);
        res.status(500).json({ error: "Failed to fetch event room" });
    }
}

// 17. Get event feedback (Public)
export async function getEventFeedback(
    req: Request<{ eventId: string }>,
    res: Response
) {
    try {
        const { eventId } = req.params;

        const feedbackData = await db
            .select({
                studentId: ticketsAndFeedback.studentId,
                studentName: sql`${users.fname} || ' ' || ${users.lname}`,
                rating: ticketsAndFeedback.rating,
                feedback: ticketsAndFeedback.feedback,
                dateIssued: ticketsAndFeedback.dateIssued,
            })
            .from(ticketsAndFeedback)
            .innerJoin(students, eq(ticketsAndFeedback.studentId, students.id))
            .innerJoin(users, eq(students.id, users.id))
            .where(
                and(
                    eq(ticketsAndFeedback.eventId, parseInt(eventId)),
                    isNotNull(ticketsAndFeedback.feedback),
                    eq(ticketsAndFeedback.scanned, 1) // Only show feedback from attendees
                )
            );

        return res.status(200).json({
            message: "Event feedback retrieved successfully",
            feedback: feedbackData,
        });
    } catch (error) {
        console.error("Error fetching event feedback:", error);
        res.status(500).json({ error: "Failed to fetch event feedback" });
    }
}
//==============SEARCHING AND FILTRING===================
// 18. Get events by type (Public - for filtering)
export async function getEventsByType(
    req: Request<any, any, any, { type: string }>,
    res: Response
) {
    try {
        const { type } = req.query;

        if (!type) {
            return res.status(400).json({ error: "Event type is required" });
        }

        const filteredEvents = await db
            .select({
                id: events.id,
                title: events.title,
                description: events.description,
                type: events.type,
                issuedAt: events.issuedAt,
                startTime: events.startTime,
                endTime: events.endTime,
                basePrice: events.basePrice,
                team: {
                    id: teams.id,
                    name: teams.name,
                },
            })
            .from(events)
            .innerJoin(teams, eq(events.teamId, teams.id))
            .where(
                and(
                    eq(events.type, type),
                    eq(events.acceptanceStatus, "approved")
                )
            )
            .orderBy(asc(events.startTime));

        return res.status(200).json({
            message: `Events of type '${type}' retrieved`,
            count: filteredEvents.length,
            events: filteredEvents,
        });
    } catch (error) {
        console.error("Error retrieving events by type:", error);
        res.status(500).json({ error: "Failed to retrieve events by type" });
    }
}

// 19. Get events by date range (Public - for filtering)
export async function getEventsByDate(
    req: Request<any, any, any, { startDate?: string; endDate?: string }>,
    res: Response
) {
    try {
        const { startDate, endDate } = req.query;

        // If no dates provided, return all upcoming approved events
        if (!startDate && !endDate) {
            const upcomingEvents = await db
                .select({
                    id: events.id,
                    title: events.title,
                    description: events.description,
                    type: events.type,
                    issuedAt: events.issuedAt,
                    startTime: events.startTime,
                    endTime: events.endTime,
                    basePrice: events.basePrice,
                    team: {
                        id: teams.id,
                        name: teams.name,
                    },
                })
                .from(events)
                .innerJoin(teams, eq(events.teamId, teams.id))
                .where(
                    and(
                        gt(events.startTime, new Date().toISOString()),
                        eq(events.acceptanceStatus, "approved")
                    )
                )
                .orderBy(asc(events.startTime));

            return res.status(200).json({
                message: "Upcoming events retrieved",
                count: upcomingEvents.length,
                events: upcomingEvents,
            });
        }

        // Validate dates if provided
        if (startDate && isNaN(Date.parse(startDate as string))) {
            return res.status(400).json({ error: "Invalid start date format" });
        }

        if (endDate && isNaN(Date.parse(endDate as string))) {
            return res.status(400).json({ error: "Invalid end date format" });
        }

        // Build conditions array based on provided dates
        const conditions = [eq(events.acceptanceStatus, "approved")];

        if (startDate && endDate) {
            conditions.push(
                gt(events.startTime, startDate as string),
                lt(events.startTime, endDate as string)
            );
        } else if (startDate) {
            conditions.push(gt(events.startTime, startDate as string));
        } else if (endDate) {
            conditions.push(lt(events.startTime, endDate as string));
        }

        // Execute query with all conditions
        const filteredEvents = await db
            .select({
                id: events.id,
                title: events.title,
                description: events.description,
                type: events.type,
                issuedAt: events.issuedAt,
                startTime: events.startTime,
                endTime: events.endTime,
                basePrice: events.basePrice,
                team: {
                    id: teams.id,
                    name: teams.name,
                },
            })
            .from(events)
            .innerJoin(teams, eq(events.teamId, teams.id))
            .where(and(...conditions))
            .orderBy(asc(events.startTime));

        return res.status(200).json({
            message: "Events filtered by date",
            count: filteredEvents.length,
            events: filteredEvents,
        });
    } catch (error) {
        console.error("Error retrieving events by date:", error);
        res.status(500).json({ error: "Failed to retrieve events by date" });
    }
}

// 20. Search events by name (Public)
export async function searchEvents(
    req: Request<any, any, any, { query: string }>,
    res: Response
) {
    try {
        const { query } = req.query;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: "Search query is required" });
        }

        // Search for events matching the query (case-insensitive)
        const searchResults = await db
            .select({
                id: events.id,
                title: events.title,
                description: events.description,
                type: events.type,
                issuedAt: events.issuedAt,
                startTime: events.startTime,
                endTime: events.endTime,
                basePrice: events.basePrice,
                team: {
                    id: teams.id,
                    name: teams.name,
                },
            })
            .from(events)
            .innerJoin(teams, eq(events.teamId, teams.id))
            .where(
                and(
                    like(events.title, `%${query}%`),
                    eq(events.acceptanceStatus, "approved")
                )
            )
            .orderBy(asc(events.startTime));

        return res.status(200).json({
            message: "Search completed",
            query: query,
            count: searchResults.length,
            events: searchResults,
        });
    } catch (error) {
        console.error("Error searching events:", error);
        res.status(500).json({ error: "Failed to search events" });
    }
}
//==================================================
// 21. Get event average rating (Public)
export async function getEventAverageRating(
    req: Request<{ eventId: string }>,
    res: Response
) {
    try {
        const { eventId } = req.params;

        const result = await db
            .select({
                averageRating: sql<number>`avg(${ticketsAndFeedback.rating})`,
            })
            .from(ticketsAndFeedback)
            .where(
                and(
                    eq(ticketsAndFeedback.eventId, parseInt(eventId)),
                    isNotNull(ticketsAndFeedback.rating)
                )
            );

        const averageRating = result[0]?.averageRating
            ? parseFloat(Number(result[0].averageRating).toFixed(1))
            : 0;

        return res.status(200).json({
            message: "Average rating rating retrieved successfully",
            averageRating,
        });
    } catch (error) {
        console.error("Error calculating average rating:", error);
        res.status(500).json({ error: "Failed to calculate average rating" });
    }
}

//22. rate event
export async function rateEvent(
    req: Request<any, any, { eventId: number; rating: number; feedback: string }>,
    res: Response
) {
    try {
        const { eventId, rating, feedback } = req.body;
        const studentId = (req as any).user.id;

        if (rating < 0 || rating > 5) {
            return res.status(400).json({
                error: "Rating must be between 0 and 5",
            });
        }

        const [ticket] = await db
            .update(ticketsAndFeedback)
            .set({ rating, feedback })
            .where(
                and(
                    eq(ticketsAndFeedback.eventId, eventId),
                    eq(ticketsAndFeedback.studentId, studentId)
                )
            )
            .returning();

        if (!ticket) {
            return res.status(404).json({ error: "Event registration not found" });
        }

        // Check if student attended
        if (ticket.scanned !== 1) {
            return res.status(400).json({ error: "Cannot submit feedback without attending the event" });
        }

        return res.status(200).json({
            message: "Rating submitted successfully",
            ticket,
        });
    } catch (error) {
        console.error("Error rating event:", error);
        res.status(500).json({ error: "Failed to rate event" });
    }
}

// 23. Cancel event registration
export async function cancelRegistration(
    req: Request<{ eventId: string }>,
    res: Response
) {
    try {
        const { eventId } = req.params;
        const studentId = (req as any).user.id;

        // Check if ticket exists
        const [ticket] = await db
            .select()
            .from(ticketsAndFeedback)
            .where(
                and(
                    eq(ticketsAndFeedback.eventId, parseInt(eventId)),
                    eq(ticketsAndFeedback.studentId, studentId)
                )
            );

        if (!ticket) {
            return res.status(404).json({ error: "Registration not found" });
        }

        // Prevent cancellation if already checked in
        if (ticket.scanned === 1) {
            return res.status(400).json({
                error: "Cannot cancel registration after check-in"
            });
        }

        // Delete the registration
        await db
            .delete(ticketsAndFeedback)
            .where(
                and(
                    eq(ticketsAndFeedback.eventId, parseInt(eventId)),
                    eq(ticketsAndFeedback.studentId, studentId)
                )
            );

        return res.status(200).json({
            message: "Registration canceled successfully",
        });
    } catch (error) {
        console.error("Error canceling registration:", error);
        res.status(500).json({ error: "Failed to cancel registration" });
    }
}

//24. Get my upcoming registered events (sorted by nearest date)
export async function getMyUpcomingRegisteredEvents(req: Request, res: Response) {
    try {
        const studentId = (req as any).user.id;
        const currentDate = new Date().toISOString();

        // Validate student is authenticated
        if (!studentId) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Get all tickets for this student with future events
        const registrations = await db
            .select({
                eventId: ticketsAndFeedback.eventId,
                studentId: ticketsAndFeedback.studentId,
                price: ticketsAndFeedback.price,
                scanned: ticketsAndFeedback.scanned,
                dateIssued: ticketsAndFeedback.dateIssued,
                certificationUrl: ticketsAndFeedback.certificationUrl,
                event: {
                    id: events.id,
                    title: events.title,
                    description: events.description,
                    type: events.type,
                    startTime: events.startTime,
                    endTime: events.endTime,
                    basePrice: events.basePrice,
                    acceptanceStatus: events.acceptanceStatus,
                },
                team: {
                    id: teams.id,
                    name: teams.name,
                },
            })
            .from(ticketsAndFeedback)
            .innerJoin(events, eq(ticketsAndFeedback.eventId, events.id))
            .leftJoin(teams, eq(events.teamId, teams.id))
            .where(
                and(
                    eq(ticketsAndFeedback.studentId, studentId),
                    gt(events.startTime, currentDate),
                    eq(events.acceptanceStatus, "approved")
                )
            )
            .orderBy(asc(events.startTime));

        // Check if any registrations found
        if (registrations.length === 0) {
            return res.status(200).json({
                message: "No upcoming registered events found",
                count: 0,
                events: [],
            });
        }

        return res.status(200).json({
            message: "Upcoming registered events retrieved successfully",
            count: registrations.length,
            events: registrations,
        });
    } catch (error) {
        console.error("Error retrieving upcoming registered events:", error);
        res.status(500).json({ error: "Failed to retrieve upcoming registered events" });
    }
}

// 25. Get my attended registered events (sorted by most recent first)
export async function getMyAttendedRegisteredEvents(req: Request, res: Response) {
    try {
        const studentId = (req as any).user.id;

        // Validate student is authenticated
        if (!studentId) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Get all attended events (scanned = 1) for this student
        const attendedEvents = await db
            .select({
                eventId: ticketsAndFeedback.eventId,
                studentId: ticketsAndFeedback.studentId,
                price: ticketsAndFeedback.price,
                scanned: ticketsAndFeedback.scanned,
                rating: ticketsAndFeedback.rating,
                feedback: ticketsAndFeedback.feedback,
                dateIssued: ticketsAndFeedback.dateIssued,
                certificationUrl: ticketsAndFeedback.certificationUrl,
                event: {
                    id: events.id,
                    title: events.title,
                    description: events.description,
                    type: events.type,
                    startTime: events.startTime,
                    endTime: events.endTime,
                    basePrice: events.basePrice,
                    acceptanceStatus: events.acceptanceStatus,
                },
                team: {
                    id: teams.id,
                    name: teams.name,
                },
            })
            .from(ticketsAndFeedback)
            .innerJoin(events, eq(ticketsAndFeedback.eventId, events.id))
            .leftJoin(teams, eq(events.teamId, teams.id))
            .where(
                and(
                    eq(ticketsAndFeedback.studentId, studentId),
                    eq(ticketsAndFeedback.scanned, 1)
                )
            )
            .orderBy(desc(events.startTime));

        // Check if any attended events found
        if (attendedEvents.length === 0) {
            return res.status(200).json({
                message: "No attended events found",
                count: 0,
                events: [],
            });
        }

        return res.status(200).json({
            message: "Attended events retrieved successfully",
            count: attendedEvents.length,
            events: attendedEvents,
        });
    } catch (error) {
        console.error("Error retrieving attended events:", error);
        res.status(500).json({ error: "Failed to retrieve attended events" });
    }
}

// 26. Calendar view - Get upcoming events
export async function getUpcomingEvents(req: Request, res: Response) {
    try {
        const upcomingEvents = await db
            .select()
            .from(events)
            .where(eq(events.acceptanceStatus, "approved"));
        // .where(gt(events.startTime, new Date().toISOString()));

        return res.status(200).json({
            message: "Upcoming events retrieved",
            events: upcomingEvents,
        });
    } catch (error) {
        console.error("Error retrieving upcoming events:", error);
        res.status(500).json({ error: "Failed to retrieve upcoming events" });
    }
}

// 27. Get attendee registrations and statistics
export async function getEventAttendeeStats(
    req: Request<{ eventId: string }>,
    res: Response
) {
    try {
        const { eventId } = req.params;
        const userId = (req as any).user.id;
        const eventIdNum = parseInt(eventId);

        if (Number.isNaN(eventIdNum))
            return res.status(400).json({ error: "Invalid eventId" });

        // Get event to check team
        const eventRecord = await db
            .select()
            .from(events)
            .where(eq(events.id, eventIdNum));

        if (eventRecord.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Check if user is team organizer
        const membership = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, eventRecord[0].teamId!),
                    eq(belongTo.role, "organizer")
                )
            );

        if (membership.length === 0) {
            return res.status(403).json({ error: "Only event organizers can view statistics" });
        }

        const stats = await db
            .select({
                totalRegistered: sql<number>`COUNT(${ticketsAndFeedback.studentId})`,
                checkedIn: sql<number>`SUM${ticketsAndFeedback.scanned}`,
                averageRating: sql<number>`AVG(${ticketsAndFeedback.rating})`,
            })
            .from(ticketsAndFeedback)
            .where(eq(ticketsAndFeedback.eventId, eventIdNum));

        return res.status(200).json({
            message: "Attendee statistics retrieved",
            stats,
        });
    } catch (error) {
        console.error("Error retrieving stats:", error);
        res.status(500).json({ error: "Failed to retrieve statistics" });
    }
}