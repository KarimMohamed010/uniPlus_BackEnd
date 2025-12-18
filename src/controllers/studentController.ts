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
import { eq, and, gt, isNotNull, desc, asc,sql } from "drizzle-orm";

export async function getAvailableEvents(req: Request, res: Response) {
  try {
    const currentDate = new Date().toISOString();
    const availableEvents = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        type: events.type,
        startTime: events.startTime,
        endTime: events.endTime,
        basePrice: events.basePrice,
        acceptanceStatus: events.acceptanceStatus,
        teamId: events.teamId,
        teamName: teams.name,
      })
      .from(events)
      .leftJoin(teams, eq(events.teamId, teams.id))
      .where(
        and(
          gt(events.startTime, currentDate),
          eq(events.acceptanceStatus, "approved")
        )
      )
      .orderBy(asc(events.startTime));
    return res.status(200).json({
      message: "Available events retrieved successfully",
      events: availableEvents,
    });
  } catch (error) {
    console.error("Error retrieving available events:", error);
    res.status(500).json({ error: "Failed to retrieve available events" });
  }
}
// 1. Register for event
export async function registerForEvent(
  req: Request<any, any, { eventId: number | string }>,
  res: Response
) {
  try {
    const studentId = (req as any).user.id;
    const eventId = Number(req.body.eventId);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: "Invalid Event ID" });
    }

    // START TRANSACTION
    // We wrap logic in a transaction to ensure either ALL succeeds or NONE succeeds
    const result = await db.transaction(async (tx) => {
      
      // 1. Check for Duplicate Registration (Inside TX for safety)
      const existingTicket = await tx.query.ticketsAndFeedback.findFirst({
        where: and(
          eq(ticketsAndFeedback.eventId, eventId),
          eq(ticketsAndFeedback.studentId, studentId)
        ),
      });

      if (existingTicket) {
        throw new Error("ALREADY_REGISTERED"); // Throw to exit transaction
      }

      // 2. Get Event Data
      const eventData = await tx.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: { basePrice: true },
      });

      if (!eventData) {
        throw new Error("EVENT_NOT_FOUND");
      }

      let finalPrice = Number(eventData.basePrice);
      let studentIDBadge = null; // Track if we need to decrement a badge
      let teamIDBadge = null; // Track if we need to decrement a badge

      // 3. Get User Badge
      const userBadge = await tx.query.badges.findFirst({
        where: eq(badges.studentId, studentId),
      });

      // 4. Apply Calculation Logic AND Prepare Update
      if (userBadge && userBadge.usageNum && userBadge.usageNum > 0) {
        const badgeType = String(userBadge.type).toLowerCase();
        let discountApplied = false;

        switch (badgeType) {
          case "rising star":
            finalPrice = finalPrice * 0.9;
            discountApplied = true;
            break;
          case "old star":
            finalPrice = finalPrice * 0.8;
            discountApplied = true;
            break;
          case "top fan":
            finalPrice = finalPrice * 0.7;
            discountApplied = true;
            break;
        }

        if (discountApplied) {
            studentIDBadge = userBadge.studentId;
            teamIDBadge = userBadge.teamId;
        }
      }

      const dbPrice = Math.round(finalPrice);

      // 5. Decrement Badge Usage (CRITICAL MISSING STEP)
      if (studentIDBadge && teamIDBadge) {
        await tx
          .update(badges)
          .set({ usageNum: sql`${badges.usageNum} - 1` }) // Atomic decrement
          .where(and (eq(badges.studentId, studentIDBadge) , eq(badges.teamId, teamIDBadge)));
          
      }

      // 6. Insert Ticket
      const [ticket] = await tx
        .insert(ticketsAndFeedback)
        .values({
          eventId,
          studentId,
          certificationUrl:null,
          dateIssued: new Date().toISOString(), // Convert Date to ISO string
          price: dbPrice,
          scanned:0,
          rating:null,
          feedback:null,
        })
        .returning();

      return { ticket, finalPrice: dbPrice };
    });

    // SUCCESS RESPONSE
    return res.status(201).json({
      message: "Registered for event successfully",
      ticket: result.ticket,
      finalPrice: result.finalPrice,
    });

  } catch (error: any) {
    console.error("REGISTER ERROR:", error);

    // Handle Transaction Errors
    if (error.message === "ALREADY_REGISTERED") {
      return res.status(409).json({ error: "You are already registered for this event." });
    }
    if (error.message === "EVENT_NOT_FOUND") {
      return res.status(404).json({ error: "Event not found" });
    }

    // Generic Fallback
    return res.status(500).json({
      error: "Registration failed",
      details: error.message,
    });
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

// // 3. Apply to join team
// export async function applyToTeam(
//   req: Request<any, any, { teamId: number; cvUrl: string; role: string }>,
//   res: Response
// ) {
//   try {
//     const { teamId, cvUrl, role } = req.body;
//     const studentId = (req as any).user.id;

//     const [application] = await db
//       .insert(apply)
//       .values({
//         studentId,
//         teamId,
//         cvUrl,
//         role,
//       })
//       .returning();

//     return res.status(201).json({
//       message: "Application submitted successfully",
//       application,
//     });
//   } catch (error) {
//     console.error("Error applying to team:", error);
//     res.status(500).json({ error: "Failed to apply to team" });
//   }
// }

// 3. Apply to join team
export async function applyToTeam(
  // Update the type definition to match what Zod expects
  req: Request<any, any, { teamId: number; cv: string; desiredRole: string }>,
  res: Response
) {
  try {
    // 1. Destructure using the names defined in your Zod schema
    const { teamId, cv, desiredRole } = req.body; 
    const studentId = (req as any).user.id;

    // 2. Map those values to your Database columns
    // (Assuming your DB columns are named studentId, teamId, cvUrl, and role)
    const [application] = await db
      .insert(apply)
      .values({
        studentId,
        teamId,
        cvUrl: cv,          // mapping 'cv' from request to 'cvUrl' in DB
        role: desiredRole,  // mapping 'desiredRole' from request to 'role' in DB
      })
      .returning();

    return res.status(201).json({
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("Error applying to team:", error);
    // If you reach here, check your console; it might be a DB Unique Constraint error
    res.status(500).json({ error: "Failed to apply to team" });
  }
}

// 4. Rate and review session/speaker
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
    

    return res.status(200).json({
      message: "Rating submitted successfully",
      ticket,
    });
  } catch (error) {
    console.error("Error rating event:", error);
    res.status(500).json({ error: "Failed to rate event" });
  }
}


//====BY OMAR=====
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

// 13. Cancel event registration
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

//14. Get my upcoming registered events (sorted by nearest date)
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

//16. Get all attended events Registered for this student but not scanned
export async function getMyAttendedRegisteredEvents(req: Request, res: Response) {
  try {
    const studentId = (req as any).user.id;

    // Validate student is authenticated
    if (!studentId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    
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
export async function getMyOnlyRegisteredEvents(req: Request, res: Response) {
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
          eq(events.acceptanceStatus, "approved")
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
////////////////////////////////////////////////////////////////////////////////////////didn't continue
// 6. Post in blog
// DONE IN POST CONTROLLER

// 6. Comment on blog
//    DONE IN COMMENT CONTROLLER



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
      .select({
        certificationUrl: ticketsAndFeedback.certificationUrl,
        dateIssued: ticketsAndFeedback.dateIssued,
        event: {
          id: events.id,
          title: events.title,
          description: events.description,
          startTime: events.startTime,
          endTime: events.endTime,
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


