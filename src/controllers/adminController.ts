import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
  admins,
  belongTo,
  events,
  rooms,
  speak,
  speakers,
  students,
  subscribe,
  takePlace,
  teams,
  users,
  messages,
  ticketsAndFeedback,
} from "../db/schema.ts";
import { eq, and, sql } from "drizzle-orm";
import type { NewUser } from "../db/schema.ts";
import { hashPassword } from "../utils/password.ts";
import type { AuthenticatedRequest } from "../middleware/auth.ts";
import { id } from "zod/v4/locales";
import { parse } from "path";

export async function getAllAdmins(req: Request<any, any, any>, res: Response) {
  try {
    const adminList = await db
      .select({
        id: users.id,
        fname: users.fname,
        lname: users.lname,
        username: users.username,
        email: users.email,
      })
      .from(users)
      .innerJoin(admins, eq(users.id, admins.id));
    return res.status(200).json({
      message: "Admins retrieved",
      admins: adminList,
    });
  } catch (error) {
    console.error("Error retrieving admins:", error);
    res.status(500).json({ error: "Failed to retrieve admins" });
  }

}

export async function getPendingApprovals(req: Request, res: Response) {
  try {
    const pendingEvents = await db
      .select({
        id: events.id,
        name: events.title,
        type: sql<string>`'event'`,
        submittedBy: sql<string>`COALESCE(${users.fname} || ' ' || ${users.lname}, ${teams.name})`,
        date: events.issuedAt,
        teamName: teams.name,
      })
      .from(events)
      .innerJoin(teams, eq(events.teamId, teams.id))
      .leftJoin(users, eq(teams.leaderId, users.id))
      .where(eq(events.acceptanceStatus, "pending"));

    const pendingTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        type: sql<string>`'team'`,
        submittedBy: sql<string>`COALESCE(${users.fname} || ' ' || ${users.lname}, '')`,
        date: sql<string>`NULL`,
      })
      .from(teams)
      .leftJoin(users, eq(teams.leaderId, users.id))
      .where(eq(teams.acceptanceStatus, "pending"));

    return res.status(200).json({
      message: "Pending approvals retrieved",
      items: [...pendingEvents, ...pendingTeams],
    });
  } catch (error) {
    console.error("Error retrieving pending approvals:", error);
    return res.status(500).json({ error: "Failed to retrieve pending approvals" });
  }
}

export async function approveOrRejectItem(
  req: Request<{ itemType: string; id: string }, any, { approved: boolean; reason?: string }>,
  res: Response
) {
  try {
    const { itemType, id } = req.params;
    const { approved } = req.body;
    const adminId = (req as any).user.id;

    const status = approved ? "approved" : "rejected";

    if (itemType === "team") {
      if (approved) {
        const team = await db.select().from(teams).where(eq(teams.id, parseInt(id)));
        if (team.length === 0) return res.status(404).json({ error: "Team not found" });

        const duplicateTeam = await db
          .select()
          .from(teams)
          .where(
            and(
              eq(teams.name, team[0].name),
              eq(teams.leaderId, team[0].leaderId),
              eq(teams.acceptanceStatus, "approved"),
              sql`${teams.id} != ${parseInt(id)}`
            )
          );

        if (duplicateTeam.length > 0) {
          return res.status(400).json({
            error: "Cannot approve team: Another approved team with this name already exists.",
          });
        }
      }

      const [team] = await db
        .update(teams)
        .set({ acceptanceStatus: status, respondedBy: adminId })
        .where(eq(teams.id, parseInt(id)))
        .returning();

      if (!team) return res.status(404).json({ error: "Team not found" });

      return res.status(200).json({ message: `Team ${status}`, team });
    }

    if (itemType === "event") {
      const [event] = await db
        .update(events)
        .set({ acceptanceStatus: status, respondedBy: adminId })
        .where(eq(events.id, parseInt(id)))
        .returning();

      if (!event) return res.status(404).json({ error: "Event not found" });
      return res.status(200).json({ message: `Event ${status}`, event });
    }

    return res.status(400).json({ error: "Invalid item type" });
  } catch (error) {
    console.error("Error approving/rejecting item:", error);
    return res.status(500).json({ error: "Failed to process approval" });
  }
}

export async function deleteApprovalItem(
  req: Request<{ itemType: string; id: string }>,
  res: Response
) {
  try {
    const { itemType, id } = req.params;

    if (itemType === "event") {
      await db.delete(events).where(eq(events.id, parseInt(id)));
      return res.status(200).json({ message: "Event deleted" });
    }

    if (itemType === "team") {
      await db.delete(teams).where(eq(teams.id, parseInt(id)));
      return res.status(200).json({ message: "Team deleted" });
    }

    return res.status(400).json({ error: "Invalid item type" });
  } catch (error) {
    console.error("Error deleting item:", error);
    return res.status(500).json({ error: "Failed to delete item" });
  }
}

export async function getApprovalItemDetails(
  req: Request<{ itemType: string; id: string }>,
  res: Response
) {
  try {
    const { itemType, id } = req.params;

    if (itemType === "team") {
      const [team] = await db
        .select({
          id: teams.id,
          name: teams.name,
          description: teams.description,
          leaderId: teams.leaderId,
          acceptanceStatus: teams.acceptanceStatus,
          leader: {
            id: users.id,
            fname: users.fname,
            lname: users.lname,
            email: users.email,
            username: users.username,
          },
        })
        .from(teams)
        .leftJoin(users, eq(teams.leaderId, users.id))
        .where(eq(teams.id, parseInt(id)));

      if (!team) return res.status(404).json({ error: "Team not found" });

      const members = await db
        .select({
          studentId: belongTo.studentId,
          role: belongTo.role,
          fname: users.fname,
          lname: users.lname,
          email: users.email,
          username: users.username,
        })
        .from(belongTo)
        .innerJoin(students, eq(belongTo.studentId, students.id))
        .innerJoin(users, eq(students.id, users.id))
        .where(eq(belongTo.teamId, parseInt(id)));

      const eventsForTeam = await db
        .select({
          id: events.id,
          title: events.title,
          startTime: events.startTime,
          endTime: events.endTime,
          type: events.type,
          acceptanceStatus: events.acceptanceStatus,
        })
        .from(events)
        .where(eq(events.teamId, parseInt(id)));

      const [subscriberAgg] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(subscribe)
        .where(eq(subscribe.teamId, parseInt(id)));

      return res.status(200).json({
        message: "Team details",
        team,
        members,
        events: eventsForTeam,
        subscribers: Number(subscriberAgg?.count ?? 0),
      });
    }

    if (itemType === "event") {
      const [event] = await db
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
          teamLeader: {
            id: users.id,
            fname: users.fname,
            lname: users.lname,
            email: users.email,
            username: users.username,
          },
        })
        .from(events)
        .innerJoin(teams, eq(events.teamId, teams.id))
        .leftJoin(users, eq(teams.leaderId, users.id))
        .where(eq(events.id, parseInt(id)));

      if (!event) return res.status(404).json({ error: "Event not found" });

      const organizers = await db
        .select({
          studentId: belongTo.studentId,
          fname: users.fname,
          lname: users.lname,
          email: users.email,
          username: users.username,
        })
        .from(belongTo)
        .innerJoin(students, eq(belongTo.studentId, students.id))
        .innerJoin(users, eq(students.id, users.id))
        .where(and(eq(belongTo.teamId, event.team.id), eq(belongTo.role, "organizer")));

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
        .where(eq(ticketsAndFeedback.eventId, parseInt(id)));

      const speakersForEvent = await db
        .select({
          id: speakers.id,
          name: speakers.name,
          bio: speakers.bio,
          email: speakers.email,
          fname: speakers.fname,
          lname: speakers.lname,
          contact: speakers.contact,
        })
        .from(speak)
        .innerJoin(speakers, eq(speak.speakerId, speakers.id))
        .where(eq(speak.eventId, parseInt(id)));

      const [roomRow] = await db
        .select({
          id: rooms.id,
          name: rooms.name,
          capacity: rooms.capacity,
          location: rooms.location,
        })
        .from(takePlace)
        .innerJoin(rooms, eq(takePlace.roomId, rooms.id))
        .where(eq(takePlace.eventId, parseInt(id)));

      const [stats] = await db
        .select({
          totalRegistrations: sql<number>`COUNT(*)`,
          totalCheckins: sql<number>`SUM(CASE WHEN ${ticketsAndFeedback.scanned} = 1 THEN 1 ELSE 0 END)`,
          avgRating: sql<number>`AVG(${ticketsAndFeedback.rating})`,
          feedbackCount: sql<number>`COUNT(${ticketsAndFeedback.feedback})`,
        })
        .from(ticketsAndFeedback)
        .where(eq(ticketsAndFeedback.eventId, parseInt(id)));

      return res.status(200).json({
        message: "Event details",
        event,
        organizers,
        speakers: speakersForEvent,
        room: roomRow ?? null,
        registrations,
        stats: {
          totalRegistrations: Number(stats?.totalRegistrations ?? 0),
          totalCheckins: Number(stats?.totalCheckins ?? 0),
          avgRating: stats?.avgRating ? Number(Number(stats.avgRating).toFixed(1)) : 0,
          feedbackCount: Number(stats?.feedbackCount ?? 0),
        },
      });
    }

    return res.status(400).json({ error: "Invalid item type" });
  } catch (error) {
    console.error("Error retrieving item details:", error);
    return res.status(500).json({ error: "Failed to retrieve item details" });
  }

}

export async function deleteAdmin(
  req: Request<{id : string }, any, any>,
  res: Response
) {
  try {
    const { id } = req.params;
    
    const [admin] = await db
      .delete(users)
      .where(eq(users.id, parseInt(id)))
      .returning({
        id: users.id,
        fname: users.fname,
        lname: users.lname,
        email: users.email,
        username: users.username,
      });
    return res.status(200).json({
      message: "Admin removed successfully",
    });
  } catch (error) {
    console.error("Error removing admin:", error);
    res.status(500).json({ error: "Failed to remove admin" });
  }
}

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
    const user = await db.transaction(async (tx) => {
      const [result] = await tx
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

      await tx.insert(admins).values({ id: result.id });
      return result;
    });

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
    if ((error as any).cause.code === "23505") {
      if (/email/i.test(error.cause.constraint)) {
        return res.status(409).json({ error: "Email already exists" });
      }
      if (/username/i.test(error.cause.constraint)) {
        return res.status(409).json({ error: "Username already exists" });
      }
    } else return res.status(500).json({ error: "Failed to add admin" });
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
    await db.insert(messages).values({
      senderId: adminId,
      receiverId: userId,
      content: `WARNING: ${warningMessage}`,
      sentAt: new Date().toISOString(),
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

    const messages_data = recipientIds.map((recipientId) => ({
      senderId: adminId,
      receiverId: recipientId,
      content,
      sentAt: new Date().toISOString(),
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

// 8. Get pending items for approval (events and organizations)
// export async function getPendingApprovals(
//   req: Request<any, any, any>,
//   res: Response
// ) {
//   try {
//     // Get pending events
//     const pendingEvents = await db
//       .select()
//       .from(events)
//       .where(eq(events.status, "pending"));

//     // TODO: Add pending teams/organizations when teams schema is updated with status field

//     return res.status(200).json({
//       message: "Pending approvals retrieved",
//       events: pendingEvents,
//       teams: [],
//     });
//   } catch (error) {
//     console.error("Error retrieving pending approvals:", error);
//     res.status(500).json({ error: "Failed to retrieve pending approvals" });
//   }
// }

// // 9. Approve or reject an item
// export async function approveItem(
//   req: Request<
//     { itemId: string },
//     any,
//     { approved: boolean; reason?: string; itemType: "event" | "team" }
//   >,
//   res: Response
// ) {
//   try {
//     const { itemId } = req.params;
//     const { approved, reason, itemType } = req.body;
//     const adminId = (req as any).user.id;

//     if (itemType === "event") {
//       await db
//         .update(events)
//         .set({
//           status: approved ? "approved" : "rejected",
//           updatedAt: new Date(),
//         })
//         .where(eq(events.id, parseInt(itemId)));
//     } else if (itemType === "team") {
//       // TODO: Update teams table when status field is added
//     }

//     return res.status(200).json({
//       message: `Item ${approved ? "approved" : "rejected"} successfully`,
//     });
//   } catch (error) {
//     console.error("Error approving item:", error);
//     res.status(500).json({ error: "Failed to approve item" });
//   }
// }

// // 10. Add new admin
// export async function addAdmin(
//   req: Request<any, any, { userId: string }>,
//   res: Response
// ) {
//   try {
//     const { userId } = req.body;
//     const adminId = (req as any).user.id;

//     // Check if user exists
//     const user = await db
//       .select()
//       .from(users)
//       .where(eq(users.id, parseInt(userId)))
//       .limit(1);

//     if (user.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Add admin role to user
//     await db
//       .update(users)
//       .set({ role: "admin" })
//       .where(eq(users.id, parseInt(userId)));

//     return res.status(200).json({
//       message: "Admin added successfully",
//     });
//   } catch (error) {
//     console.error("Error adding admin:", error);
//     res.status(500).json({ error: "Failed to add admin" });
//   }
// }

// // 11. Get all admins
// export async function getAllAdmins(req: Request<any, any, any>, res: Response) {
//   try {
//     const adminList = await db
//       .select({
//         id: users.id,
//         fname: users.fname,
//         lname: users.lname,
//         username: users.username,
//         email: users.email,
//         role: users.role,
//       })
//       .from(users)
//       .where(eq(users.role, "admin"));

//     return res.status(200).json({
//       message: "Admins retrieved",
//       admins: adminList,
//     });
//   } catch (error) {
//     console.error("Error retrieving admins:", error);
//     res.status(500).json({ error: "Failed to retrieve admins" });
//   }
// }

// // 12. Generate participation report
// export async function generateParticipationReport(
//   req: Request<any, any, any>,
//   res: Response
// ) {
//   try {
//     // TODO: Implement report generation based on event registrations and attendance
//     const report = {
//       totalEvents: 0,
//       totalParticipants: 0,
//       averageAttendance: 0,
//       events: [],
//     };

//     return res.status(200).json({
//       message: "Participation report generated",
//       report,
//     });
//   } catch (error) {
//     console.error("Error generating report:", error);
//     res.status(500).json({ error: "Failed to generate report" });
//   }
// }

// // 13. Generate engagement report
// export async function generateEngagementReport(
//   req: Request<any, any, any>,
//   res: Response
// ) {
//   try {
//     // TODO: Implement engagement metrics based on user activity
//     const report = {
//       totalUsers: 0,
//       activeUsers: 0,
//       engagementScore: 0,
//       userActivity: [],
//     };

//     return res.status(200).json({
//       message: "Engagement report generated",
//       report,
//     });
//   } catch (error) {
//     console.error("Error generating report:", error);
//     res.status(500).json({ error: "Failed to generate report" });
//   }
// }

// // 14. Issue behavior warning
// export async function issueWarning(
//   req: Request<any, any, { userId: string; reason: string }>,
//   res: Response
// ) {
//   try {
//     const { userId, reason } = req.body;
//     const adminId = (req as any).user.id;

//     // Check if user exists
//     const user = await db
//       .select()
//       .from(users)
//       .where(eq(users.id, parseInt(userId)))
//       .limit(1);

//     if (user.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // TODO: Create a warnings table and insert warning record
//     // For now, just log the warning action
//     console.log(
//       `Warning issued to user ${userId} by admin ${adminId}: ${reason}`
//     );

//     return res.status(200).json({
//       message: "Warning issued successfully",
//     });
//   } catch (error) {
//     console.error("Error issuing warning:", error);
//     res.status(500).json({ error: "Failed to issue warning" });
//   }
// }

// // 15. Get user warnings
// export async function getUserWarnings(
//   req: Request<{ userId: string }, any, any>,
//   res: Response
// ) {
//   try {
//     const { userId } = req.params;

//     // TODO: Query warnings table when it's created
//     const warnings: any[] = [];

//     return res.status(200).json({
//       message: "User warnings retrieved",
//       warnings,
//     });
//   } catch (error) {
//     console.error("Error retrieving warnings:", error);
//     res.status(500).json({ error: "Failed to retrieve warnings" });
//   }
// }

// // 16. Get all users (for management)
// export async function getAllUsers(req: Request<any, any, any>, res: Response) {
//   try {
//     const allUsers = await db
//       .select({
//         id: users.id,
//         fname: users.fname,
//         lname: users.lname,
//         username: users.username,
//         email: users.email,
//         role: users.role,
//         isActive: users.isActive,
//       })
//       .from(users);

//     return res.status(200).json({
//       message: "Users retrieved",
//       users: allUsers,
//     });
//   } catch (error) {
//     console.error("Error retrieving users:", error);
//     res.status(500).json({ error: "Failed to retrieve users" });
//   }
// }

// // 17. Toggle user status (activate/deactivate)
// export async function toggleUserStatus(
//   req: Request<{ userId: string }, any, any>,
//   res: Response
// ) {
//   try {
//     const { userId } = req.params;

//     // Get current user status
//     const user = await db
//       .select()
//       .from(users)
//       .where(eq(users.id, parseInt(userId)))
//       .limit(1);

//     if (user.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Toggle the status
//     const newStatus = !user[0].isActive;
//     await db
//       .update(users)
//       .set({ isActive: newStatus })
//       .where(eq(users.id, parseInt(userId)));

//     return res.status(200).json({
//       message: `User ${newStatus ? "activated" : "deactivated"} successfully`,
//     });
//   } catch (error) {
//     console.error("Error toggling user status:", error);
//     res.status(500).json({ error: "Failed to toggle user status" });
//   }
// }

// // 18. Send system announcement
// export async function sendAnnouncement(
//   req: Request<any, any, { title: string; message: string }>,
//   res: Response
// ) {
//   try {
//     const { title, message } = req.body;
//     const adminId = (req as any).user.id;

//     if (!title || !message) {
//       return res.status(400).json({ error: "Title and message are required" });
//     }

//     // TODO: Create an announcements table and insert announcement
//     // For now, just log it
//     console.log(`Announcement sent by admin ${adminId}: ${title}`);

//     return res.status(200).json({
//       message: "Announcement sent successfully",
//     });
//   } catch (error) {
//     console.error("Error sending announcement:", error);
//     res.status(500).json({ error: "Failed to send announcement" });
//   }
// }

// // 19. Get all announcements
// export async function getAnnouncements(
//   req: Request<any, any, any>,
//   res: Response
// ) {
//   try {
//     // TODO: Query announcements table when it's created
//     const announcements: any[] = [];

//     return res.status(200).json({
//       message: "Announcements retrieved",
//       announcements,
//     });
//   } catch (error) {
//     console.error("Error retrieving announcements:", error);
//     res.status(500).json({ error: "Failed to retrieve announcements" });
//   }
// }
