import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
  events,
  teams,
  posts,
  apply,
  ticketsAndFeedback,
  speak,
  speakers,
  messages,
  belongTo,
  students,
  users,
  type NewEvent,
} from "../db/schema.ts";
import { eq, and, sql } from "drizzle-orm";

// DONE IN EVENT CONTROLLER --NOTE: i didn't delete it from here however i think it should be in event controller
// 1. Create event
// export async function createEvent(
//   req: Request<any, any, NewEvent>,
//   res: Response
// ) {
//   try {
//     const { title, description, type, startTime, endTime, teamId } = req.body;
//     const userId = (req as any).user.id;

//     // Verify user is part of the team
//     const teamMember = await db
//       .select()
//       .from(belongTo)
//       .where(and(eq(belongTo.studentId, userId), eq(belongTo.teamId, teamId)));

//     if (teamMember.length === 0) {
//       return res.status(403).json({
//         error: "You are not a member of this team",
//       });
//     }

//     const [event] = await db
//       .insert(events)
//       .values({
//         title,
//         description,
//         type,
//         startTime,
//         endTime,
//         teamId,
//       })
//       .returning();

//     return res.status(201).json({
//       message: "Event created successfully",
//       event,
//     });
//   } catch (error) {
//     console.error("Error creating event:", error);
//     res.status(500).json({ error: "Failed to create event" });
//   }
// }

// // 1. Edit event
// export async function editEvent(
//   req: Request<{ eventId: string }, any, any>,
//   res: Response
// ) {
//   try {
//     const { eventId } = req.params;
//     const { title, description, type, startTime, endTime } = req.body;
//     const userId = (req as any).user.id;

//     // Verify event exists and belongs to user's team
//     const event = await db
//       .select()
//       .from(events)
//       .where(eq(events.id, parseInt(eventId)));

//     if (event.length === 0) {
//       return res.status(404).json({ error: "Event not found" });
//     }

//     const teamMember = await db
//       .select()
//       .from(belongTo)
//       .where(
//         and(
//           eq(belongTo.studentId, userId),
//           eq(belongTo.teamId, event[0].teamId!)
//         )
//       );

//     if (teamMember.length === 0) {
//       return res.status(403).json({
//         error: "You don't have permission to edit this event",
//       });
//     }

//     const [updated] = await db
//       .update(events)
//       .set({
//         title: title || event[0].title,
//         description: description || event[0].description,
//         type: type || event[0].type,
//         startTime: startTime || event[0].startTime,
//         endTime: endTime || event[0].endTime,
//       })
//       .where(eq(events.id, parseInt(eventId)))
//       .returning();

//     return res.status(200).json({
//       message: "Event updated successfully",
//       event: updated,
//     });
//   } catch (error) {
//     console.error("Error editing event:", error);
//     res.status(500).json({ error: "Failed to edit event" });
//   }
// }

//2. Assign speaker to event
// export async function assignSpeaker(
//   req: Request<any, any, { speakerId: number; eventId: number }>,
//   res: Response
// ) {
//   try {
//     const { speakerId, eventId } = req.body;

//     await db.insert(speak).values({
//       speakerId,
//       eventId,
//     });

//     return res.status(201).json({
//       message: "Speaker assigned successfully",
//     });
//   } catch (error) {
//     console.error("Error assigning speaker:", error);
//     res.status(500).json({ error: "Failed to assign speaker" });
//   }
// }

// 1. Publish event
export async function publishEvent(
  req: Request<{ eventId: string }>,
  res: Response
) {
  try {
    const { eventId } = req.params;

    const [event] = await db
      .update(events)
      .set({ acceptanceStatus: "published" })
      .where(eq(events.id, parseInt(eventId)))
      .returning();

    return res.status(200).json({
      message: "Event published successfully",
      event,
    });
  } catch (error) {
    console.error("Error publishing event:", error);
    res.status(500).json({ error: "Failed to publish event" });
  }
}



// 3. Get attendee registrations and statistics
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

// 4. Verify QR code / Check-in attendee
export async function checkInAttendee(
  req: Request<any, any, { eventId: number; studentId: number }>,
  res: Response
) {
  try {
    const { eventId, studentId } = req.body;

    const [ticket] = await db
      .update(ticketsAndFeedback)
      .set({ scanned: 1 })
      .where(
        and(
          eq(ticketsAndFeedback.eventId, eventId),
          eq(ticketsAndFeedback.studentId, studentId)
        )
      )
      .returning();

    if (!ticket) {
      return res.status(404).json({ error: "Attendee not found" });
    }

    return res.status(200).json({
      message: "Check-in successful",
      ticket,
    });
  } catch (error) {
    console.error("Error checking in attendee:", error);
    res.status(500).json({ error: "Failed to check in attendee" });
  }
}
//===BY OMAR ==
// 8. View feedback and ratings (Organizer only)
export async function getEventFeedback(
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
      return res.status(403).json({ error: "Only event organizers can view feedback" });
    }

    // Get feedback with student details (only from attendees)
    const feedback = await db
      .select({
        studentId: ticketsAndFeedback.studentId,
        studentName: sql`${users.fname} || ' ' || ${users.lname}`,
        rating: ticketsAndFeedback.rating,
        feedback: ticketsAndFeedback.feedback,
        scanned: ticketsAndFeedback.scanned,
        dateIssued: ticketsAndFeedback.dateIssued,
      })
      .from(ticketsAndFeedback)
      .innerJoin(students, eq(ticketsAndFeedback.studentId, students.id))
      .innerJoin(users, eq(students.id, users.id))
      .where(
        and(
          eq(ticketsAndFeedback.eventId, parseInt(eventId)),
          eq(ticketsAndFeedback.scanned, 1) // Only show feedback from attendees
        )
      );

    return res.status(200).json({
      message: "Event feedback retrieved",
      feedback,
    });
  } catch (error) {
    console.error("Error retrieving feedback:", error);
    res.status(500).json({ error: "Failed to retrieve feedback" });
  }
}

// 9. Issue certificates (Organizer only)
export async function issueCertificate(
  req: Request<
    any,
    any,
    { eventId: number; studentId: number; certUrl: string }
  >,
  res: Response
) {
  try {
    const { eventId, studentId, certUrl } = req.body;
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
      return res.status(403).json({ error: "Only event organizers can issue certificates" });
    }

    // Check if ticket exists and student attended
    const [existingTicket] = await db
      .select()
      .from(ticketsAndFeedback)
      .where(
        and(
          eq(ticketsAndFeedback.eventId, eventId),
          eq(ticketsAndFeedback.studentId, studentId)
        )
      );

    if (!existingTicket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Only issue certificate to students who attended
    if (existingTicket.scanned !== 1) {
      return res.status(400).json({ error: "Cannot issue certificate to student who did not attend" });
    }

    // Issue certificate
    const [ticket] = await db
      .update(ticketsAndFeedback)
      .set({ certificationUrl: certUrl })
      .where(
        and(
          eq(ticketsAndFeedback.eventId, eventId),
          eq(ticketsAndFeedback.studentId, studentId)
        )
      )
      .returning();

    return res.status(200).json({
      message: "Certificate issued successfully",
      ticket,
    });
  } catch (error) {
    console.error("Error issuing certificate:", error);
    res.status(500).json({ error: "Failed to issue certificate" });
  }
}

////////////////////////////////////////////////////////////////////////////////////////didn't continue

// 5. Post announcement/blog update
//NOTE: el ai by3oly tetshal 3shan da y3tbr post w create post mawgoda
// export async function createEventPost(
//   req: Request<any, any, any>,
//   res: Response
// ) {
//   try {
//     const { description, teamId } = req.body;
//     const userId = (req as any).user.id;

//     const [post] = await db
//       .insert(posts)
//       .values({
//         description,
//       })
//       .returning();

//     // Link post to team
//     await db.insert(posts).values({
//       description,
//     });

//     return res.status(201).json({
//       message: "Post created successfully",
//       post,
//     });
//   } catch (error) {
//     console.error("Error creating post:", error);
//     res.status(500).json({ error: "Failed to create post" });
//   }
// }

// 6. Submit event request (for approval)
export async function submitEventRequest(
  req: Request<any, any, any>,
  res: Response
) {
  try {
    const { eventId } = req.body;

    const [event] = await db
      .update(events)
      .set({ acceptanceStatus: "pending" })
      .where(eq(events.id, eventId))
      .returning();

    return res.status(200).json({
      message: "Event request submitted for approval",
      event,
    });
  } catch (error) {
    console.error("Error submitting request:", error);
    res.status(500).json({ error: "Failed to submit request" });
  }
}

// 7. Respond to student applications
export async function respondToApplication(
  req: Request<
    any,
    any,
    { applicationId: string; status: "approved" | "rejected" }
  >,
  res: Response
) {
  try {
    const { applicationId, status } = req.body;

    // Get application details
    const application = await db
      .select()
      .from(apply)
      .where(eq(apply.studentId, parseInt(applicationId)));

    if (application.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (status === "approved") {
      // Add to team
      await db.insert(belongTo).values({
        studentId: application[0].studentId,
        teamId: application[0].teamId,
        role: application[0].role,
      });
    }

    // Delete application
    await db.delete(apply).where(eq(apply.studentId, parseInt(applicationId)));

    return res.status(200).json({
      message: `Application ${status}`,
    });
  } catch (error) {
    console.error("Error responding to application:", error);
    res.status(500).json({ error: "Failed to respond to application" });
  }
}

