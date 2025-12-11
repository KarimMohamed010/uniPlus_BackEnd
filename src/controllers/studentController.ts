import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
  events,
  ticketsAndFeedback,
  apply,
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
import { eq, and , gt, isNotNull} from "drizzle-orm";

// 1. Browse and register for events
export async function getAvailableEvents(req: Request, res: Response) {
  try {
    const availableEvents = await db
      .select()
      .from(events)
      .where(eq(events.acceptanceStatus, "approved"));

    return res.status(200).json({
      message: "Available events retrieved",
      events: availableEvents,
    });
  } catch (error) {
    console.error("Error retrieving events:", error);
    res.status(500).json({ error: "Failed to retrieve events" });
  }
}

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

    return res.status(200).json({
      message: "Rating submitted successfully",
      ticket,
    });
  } catch (error) {
    console.error("Error rating event:", error);
    res.status(500).json({ error: "Failed to rate event" });
  }
}

// 5. Participate in chat (send message)
export async function sendMessage(
  req: Request<any, any, { receiverId: number; content: string }>,
  res: Response
) {
  try {
    const { receiverId, content } = req.body;
    const senderId = (req as any).user.id;
    const msgId = Date.now();

    await db.insert(messages).values({
      msgId,
      senderId,
      receiverId,
      content,
      sendAt: new Date().toISOString(),
    });

    return res.status(201).json({
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
}
////////////////////////////////////////////////////////////////////////////////////////didn't continue
// 6. Post in blog
export async function createBlogPost(
  req: Request<any, any, { description: string }>,
  res: Response
) {
  try {
    const { description } = req.body;

    const [post] = await db
      .insert(posts)
      .values({
        description,
      })
      .returning();

    return res.status(201).json({
      message: "Blog post created successfully",
      post,
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
}

// 6. Comment on blog
export async function commentOnPost(
  req: Request<
    any,
    any,
    { postId: number; content: string; parentId?: number }
  >,
  res: Response
) {
  try {
    const { postId, content, parentId } = req.body;
    const userId = (req as any).user.id;

    const [comment] = await db
      .insert(comments)
      .values({
        postId,
        content,
        author: userId,
        parentId,
      })
      .returning();

    return res.status(201).json({
      message: "Comment posted successfully",
      comment,
    });
  } catch (error) {
    console.error("Error posting comment:", error);
    res.status(500).json({ error: "Failed to post comment" });
  }
}

// 7. Get notifications and warnings
export async function getNotifications(req: Request, res: Response) {
  try {
    const studentId = (req as any).user.id;

    const notifications = await db
      .select()
      .from(messages)
      .where(eq(messages.receiverId, studentId));

    return res.status(200).json({
      message: "Notifications retrieved",
      notifications,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    res.status(500).json({ error: "Failed to retrieve notifications" });
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

// 9. View certificates and achievements
export async function getCertificates(req: Request, res: Response) {
  try {
    const studentId = (req as any).user.id;

    const certificates = await db
      .select()
      .from(ticketsAndFeedback)
      .where(
        and(
          eq(ticketsAndFeedback.studentId, studentId),
          isNotNull(ticketsAndFeedback.certificationUrl)
        )
      );

    return res.status(200).json({
      message: "Certificates retrieved",
      certificates,
    });
  } catch (error) {
    console.error("Error retrieving certificates:", error);
    res.status(500).json({ error: "Failed to retrieve certificates" });
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

// 10. Calendar view - Get upcoming events
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

// 11. Create carpool
export async function createCarpool(
  req: Request<any, any, any>,
  res: Response
) {
  try {
    const { fromLoc, toLoc, price, seatsAvailable, arrivalTime, service } =
      req.body;
    const studentId = (req as any).user.id;

    const [ride] = await db
      .insert(rides)
      .values({
        fromLoc,
        toLoc,
        price,
        seatsAvailable,
        arrivalTime,
        service,
        createdBy: studentId,
      })
      .returning();

    return res.status(201).json({
      message: "Carpool created successfully",
      ride,
    });
  } catch (error) {
    console.error("Error creating carpool:", error);
    res.status(500).json({ error: "Failed to create carpool" });
  }
}

// 11. Get available carpools
export async function getAvailableCarpools(req: Request, res: Response) {
  try {
    const availableRides = await db
      .select()
      .from(rides)
      .where(gt(rides.seatsAvailable , 0));

    return res.status(200).json({
      message: "Available carpools retrieved",
      carpools: availableRides,
    });
  } catch (error) {
    console.error("Error retrieving carpools:", error);
    res.status(500).json({ error: "Failed to retrieve carpools" });
  }
}

// 11. Register for carpool
export async function joinCarpool(
  req: Request<any, any, { rideId: number }>,
  res: Response
) {
  try {
    const { rideId } = req.body;
    const studentId = (req as any).user.id;

    await db.insert(joinRide).values({
      studentId,
      rideId,
    });

    // Decrease available seats
    const ride = await db.select().from(rides).where(eq(rides.id, rideId));

    if (ride[0].seatsAvailable! > 0) {
      await db
        .update(rides)
        .set({
          seatsAvailable: ride[0].seatsAvailable! - 1,
        })
        .where(eq(rides.id, rideId));
    }

    return res.status(201).json({
      message: "Joined carpool successfully",
    });
  } catch (error) {
    console.error("Error joining carpool:", error);
    res.status(500).json({ error: "Failed to join carpool" });
  }
}
