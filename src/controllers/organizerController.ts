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

// 1. Verify QR code / Check-in attendee
export async function verifyQr(
  req: Request<any, any, { eventId: number; studentId: number }>,
  res: Response
) {
  try {
    const { eventId, studentId } = req.body;
    const userId = (req as any).user.id;
    const [event] = await db
      .select({
        eventId: events.id,
        eventTitle: events.title,
        teamId: events.teamId,
        teamName: teams.name,
        leaderId : teams.leaderId,
      })
      .from(events)
      .innerJoin(teams, eq(events.teamId, teams.id))
      .where(eq(events.id, eventId));

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    // Check if user is team organizer
    const membership = await db
      .select()
      .from(belongTo)
      .where(eq(belongTo.studentId, userId));
// not organizer or leader
    if (membership.length === 0 && event.leaderId !== userId) {
      return res
        .status(403)
        .json({ error: "Only event organizers can check in attendees" });
    }
    // Check if ticket exists

      

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

// 2. Issue certificates (Organizer only)
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
      return res
        .status(403)
        .json({ error: "Only event organizers can issue certificates" });
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
      return res
        .status(400)
        .json({
          error: "Cannot issue certificate to student who did not attend",
        });
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

// 3. Respond to student applications
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
