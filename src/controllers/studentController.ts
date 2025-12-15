import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
  events,
  ticketsAndFeedback,
  apply,
  teams,
  comments,
  posts,
  messages,
  rides,
  joinRide,
  users,
  badges,
  type NewTicketsAndFeedback,
  belongTo,
} from "../db/schema.ts";
import { eq, and, gt, isNotNull, desc, asc } from "drizzle-orm";


// 1. Register for event
export async function registerForEvent(
  req: Request<any, any, NewTicketsAndFeedback>,
  res: Response
) {
  try {
    const { eventId } = req.body;
    const studentId = (req as any).user.id;

    const [ticket] = await db
      .insert(ticketsAndFeedback)
      .values({
        eventId,
        studentId,
        price: 0, // Default price
      })
      .returning();

    return res.status(201).json({
      message: "Registered for event successfully",
      ticket,
    });
  } catch (error) {
    console.error("Error registering for event:", error);
    res.status(500).json({ error: "Failed to register for event" });
  }
}

// 2. Check in via QR code
export async function checkInViaQR(
  req: Request<any, any, { eventId: number; studentId: number }>,
  res: Response
) {
  try {
    const { eventId, studentId } = req.body;
    const { organizerId } = (req as any).user.id;
    //check if the scanner is a memeber of the team organizing that event

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));

    if (!event) return res.status(404).json({ error: "Event not found" });

    const [result] = await db
      .select()
      .from(belongTo)
      .where(
        and(
          eq(belongTo.studentId, organizerId),
          eq(belongTo.teamId, event.teamId)
        )
      );

    if (!result)
      //that organizer dosn't belong to the team
      return res.status(400).json({ error: "Bad organizer" });

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
      return res.status(404).json({ error: "Registration not found" });
    }

    return res.status(200).json({
      message: "Check-in successful",
      ticket,
    });
  } catch (error) {
    console.error("Error checking in:", error);
    res.status(500).json({ error: "Failed to check in" });
  }
}

// 3. Apply to join team
export async function applyToTeam(
  req: Request<any, any, { teamId: number; cvUrl: string; role: string }>,
  res: Response
) {
  try {
    const { teamId, cvUrl, role } = req.body;
    const studentId = (req as any).user.id;

    const [application] = await db
      .insert(apply)
      .values({
        studentId,
        teamId,
        cvUrl,
        role,
      })
      .returning();

    return res.status(201).json({
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("Error applying to team:", error);
    res.status(500).json({ error: "Failed to apply to team" });
  }
}


// 12. Get my ticket for an event
export async function getMyTicket(
  req: Request<{ eventId: string }>,
  res: Response
) {
  try {
    const { eventId } = req.params;
    const studentId = (req as any).user.id;

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
      return res.status(404).json({ error: "Ticket not found" });
    }

    return res.status(200).json({
      message: "Ticket retrieved successfully",
      ticket,
    });
  } catch (error) {
    console.error("Error retrieving ticket:", error);
    res.status(500).json({ error: "Failed to retrieve ticket" });
  }
}

// 8. Manage personal profile
export async function updateProfile(
  req: Request<any, any, any>,
  res: Response
) {
  try {
    const { bio, imgUrl } = req.body;
    const userId = (req as any).user.id;

    const [updatedUser] = await db
      .update(users)
      .set({
        bio: bio || undefined,
        imgUrl: imgUrl || undefined,
      })
      .where(eq(users.id, userId))
      .returning();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

// 8. Get personal profile
export async function getProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;

    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      message: "Profile retrieved",
      user,
    });
  } catch (error) {
    console.error("Error retrieving profile:", error);
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
}

// 9. Get achievements/badges
export async function getBadges(req: Request, res: Response) {
  try {
    const studentId = (req as any).user.id;

    const studentBadges = await db
      .select()
      .from(badges)
      .where(eq(badges.studentId, studentId));

    return res.status(200).json({
      message: "Badges retrieved",
      badges: studentBadges,
    });
  } catch (error) {
    console.error("Error retrieving badges:", error);
    res.status(500).json({ error: "Failed to retrieve badges" });
  }
}



// // 10. View certificates and achievements
export async function getCertificates(req: Request, res: Response) {
  try {
    const { studentId } = req.params;

    const certificates = await db
      .select()
      .from(ticketsAndFeedback)
      .where(
        and(
          eq(ticketsAndFeedback.studentId, parseInt(studentId)),
          isNotNull(ticketsAndFeedback.certificationUrl)
        )
      );

    return res.status(200).json({
      message: "Certificates retrieved",
      certificates,
    });
  } catch (error: any) {
    console.error("Error retrieving certificates:", error);
    res.status(500).json({ error: "Failed to retrieve certificates" });
  }
}


