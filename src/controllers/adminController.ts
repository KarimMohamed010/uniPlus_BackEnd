import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
  admins,
  events,
  teams,
  users,
  messages,
  ticketsAndFeedback,
} from "../db/schema.ts";
import { eq, and, sql } from "drizzle-orm";
import type { NewUser } from "../db/schema.ts";
import { hashPassword } from "../utils/password.ts";
import type { AuthenticatedRequest } from "../middleware/auth.ts";

// 1. Approve or reject events
//NOTE: el ai by3oly tetshal 3shan da elmafrod yt3ml fy el event w hwa mawgod
// export async function approveEvent(
//   req: Request<{ eventId: string }, any, { acceptanceStatus: string }>,
//   res: Response
// ) {
//   try {
//     const { eventId } = req.params;
//     const { acceptanceStatus } = req.body;
//     const adminId = (req as any).user.id; //auth middleware will always attach the payload to the req

//     if (!["approved", "rejected"].includes(acceptanceStatus)) {
//       return res.status(400).json({
//         error: "Invalid status. Must be 'approved' or 'rejected'",
//       });
//     }

//     const [event] = await db
//       .update(events)
//       .set({
//         acceptanceStatus,
//         respondedBy: adminId,
//       })
//       .where(eq(events.id, parseInt(eventId)))
//       .returning();

//     return res.status(200).json({
//       message: `Event ${acceptanceStatus}`,
//       event,
//     });
//   } catch (error) {
//     console.error("Error approving event:", error);
//     res.status(500).json({ error: "Failed to approve event" });
//   }
// }

// 1. Approve or reject teams
export async function approveTeam(
  req: Request<{ teamId: string }, any, { acceptanceStatus: string }>,
  res: Response
) {
  try {
    const { teamId } = req.params;
    const { acceptanceStatus } = req.body;
    const adminId = (req as any).user.id;

    if (!["approved", "rejected"].includes(acceptanceStatus)) {
      return res.status(400).json({
        error: "Invalid status. Must be 'approved' or 'rejected'",
      });
    }

    const [team] = await db
      .update(teams)
      .set({
        acceptanceStatus,
        respondedBy: adminId,
      })
      .where(eq(teams.id, parseInt(teamId)))
      .returning();

    return res.status(200).json({
      message: `Team ${acceptanceStatus}`,
      team,
    });
  } catch (error) {
    console.error("Error approving team:", error);
    res.status(500).json({ error: "Failed to approve team" });
  }
}

// 2. Add new admin to the system
export async function addAdmin(req: Request<any, any, NewUser>, res: Response) {
  try {
    const userData = req.body;

    const hashedPass = await hashPassword(userData.userPassword);

    // Create user as student
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        userPassword: hashedPass,
      })
      .returning({
        id: users.id,
        email: users.email,
        fname: users.fname,
        lname: users.lname,
      });

    await db.insert(admins).values({ id: user.id });

    if (!user) {
      return res.status(500).json({ error: "Failed to create admin user" });
    }

    return res.status(201).json({
      message: "Admin Created Successfully",
      user: {
        id: user.id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        roles: {
          global: "admin",
          team: [],
        },
      },
    });
  } catch (error) {
    console.error("Error adding admin:", error);

    // Check if email already exists
    if ((error as any).code === "23505") {
      return res.status(409).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Failed to add admin" });
  }
}

// Update admin details
export async function updateAdmin(
  req: Request<any, any, NewUser>,
  res: Response
) {
  try {
    let userData = req.body;
    if (req.body.userPassword) {
      const hashedPass = await hashPassword(userData.userPassword);
      userData.userPassword = hashedPass;
    }
    // update admin
    const [user] = await db
      .update(users)
      .set({ ...userData })
      .where(eq(users.id, parseInt(req.params.adminId)))
      .returning({
        id: users.id,
        email: users.email,
        fname: users.fname,
        lname: users.lname,
      });
    if (!user) {
      return res.status(500).json({ error: "Failed to update admin user" });
    }
    return res.status(201).json({
      message: "Admin Created Successfully",
      user: {
        id: user.id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        roles: {
          global: "admin",
          team: [],
        },
      },
    });
  } catch (error) {
    console.error("Error adding admin:", error);

    // Check if email already exists
    if ((error as any).code === "23505") {
      return res.status(409).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Failed to add admin" });
  }
}

// 3. Generate participation and engagement reports
export async function getEventParticipationReport(
  req: Request<{ eventId: string }>,
  res: Response
) {
  try {
    const { eventId } = req.params;
    const userId = (req as any).user.id;

    // Check if user is admin
    const adminRecord = await db
      .select()
      .from(admins)
      .where(eq(admins.id, userId));

    if (adminRecord.length === 0) {
      return res
        .status(403)
        .json({ error: "Only admins can view participation reports" });
    }

    const report = await db
      .select({
        eventId: ticketsAndFeedback.eventId,
        totalAttendees: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
        averageRating: sql<number>`AVG(${ticketsAndFeedback.rating})`,
        totalCheckins: sql<number>`SUM(CASE WHEN ${ticketsAndFeedback.scanned} = 1 THEN 1 ELSE 0 END)`,
        feedbackCount: sql<number>`COUNT(${ticketsAndFeedback.feedback} )`,
      })
      .from(ticketsAndFeedback)
      .where(eq(ticketsAndFeedback.eventId, parseInt(eventId)))
      .groupBy(ticketsAndFeedback.eventId);

    if (report.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.status(200).json({
      message: "Event participation report",
      report: report[0],
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
}

// 3. Get team engagement report
export async function getTeamEngagementReport(
  req: Request<{ teamId: string }>,
  res: Response
) {
  try {
    const { teamId } = req.params;

    // This can be expanded based on your business logic
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, parseInt(teamId)));

    if (team.length === 0) {
      return res.status(404).json({ error: "Team not found" });
    }

    return res.status(200).json({
      message: "Team engagement report",
      team: team[0],
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
}

// 4. Issue behavior warning
export async function issueWarning(
  req: Request<any, any, { userId: number; message: string }>,
  res: Response
) {
  try {
    const { userId, message: warningMessage } = req.body;
    const adminId = (req as any).user.id;

    // Send warning message to user
    const msgId = Date.now();
    await db.insert(messages).values({
      msgId,
      senderId: adminId,
      receiverId: userId,
      content: `WARNING: ${warningMessage}`,
      sendAt: new Date().toISOString(),
    });

    return res.status(201).json({
      message: "Warning issued successfully",
      userId,
    });
  } catch (error) {
    console.error("Error issuing warning:", error);
    res.status(500).json({ error: "Failed to issue warning" });
  }
}

// 5. Activate/Deactivate user
export async function toggleUserStatus(
  req: Request<{ userId: string }, any, { isActive: boolean }>,
  res: Response
) {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    // Note: You may want to add an 'isActive' column to the users table
    // For now, this is a placeholder for the functionality
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(userId)));

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      message: `User ${isActive ? "activated" : "deactivated"}`,
      userId,
    });
  } catch (error) {
    console.error("Error toggling user status:", error);
    res.status(500).json({ error: "Failed to toggle user status" });
  }
}

// 6. Send system announcement
export async function sendAnnouncement(
  req: Request<any, any, { recipientIds: number[]; content: string }>,
  res: Response
) {
  try {
    const { recipientIds, content } = req.body;
    const adminId = (req as any).user.id;

    const messages_data = recipientIds.map((recipientId, index) => ({
      msgId: Date.now() + index,
      senderId: adminId,
      receiverId: recipientId,
      content,
      sendAt: new Date().toISOString(),
    }));

    await db.insert(messages).values(messages_data);

    return res.status(201).json({
      message: "Announcement sent successfully",
      recipientCount: recipientIds.length,
    });
  } catch (error) {
    console.error("Error sending announcement:", error);
    res.status(500).json({ error: "Failed to send announcement" });
  }
}

// 7. Get received messages
export async function getAdminMessages(
  req: Request<any, any, any>,
  res: Response
) {
  try {
    const adminId = (req as any).user.id;

    const adminMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.receiverId, adminId));

    return res.status(200).json({
      message: "Admin messages retrieved",
      messages: adminMessages,
    });
  } catch (error) {
    console.error("Error retrieving messages:", error);
    res.status(500).json({ error: "Failed to retrieve messages" });
  }
}
