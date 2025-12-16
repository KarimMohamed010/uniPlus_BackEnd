import type { Request, Response } from "express";
import db from "../db/connection.ts";
import { teams, belongTo, users, students, admins, badges, subscribe } from "../db/schema.ts";
import { eq, and, sql } from "drizzle-orm";

// Get all teams
export async function getAllTeams(req: Request, res: Response) {
  try {
    const allTeams = await db.select().from(teams).where(eq(teams.acceptanceStatus, 'approved'));
    res.json(allTeams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
}

// Get team by ID
export async function getTeamById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const team = await db.select().from(teams).where(and(
      eq(teams.id, parseInt(id)),
      eq(teams.acceptanceStatus, 'approved')
    ));

    if (team.length === 0) {
      return res.status(404).json({ error: "Team not found" });
    }

    res.json(team[0]);
  } catch (error) {
    console.error("Error fetching team:", error);
    res.status(500).json({ error: "Failed to fetch team" });
  }
}

// Create team
export async function createTeam(req: Request, res: Response) {
  try {
    const { name, description, acceptanceStatus } = req.body;
    const leaderId = (req as any).user.id;

    // Check if team with same name already exists and is approved
    const existingTeam = await db.select().from(teams).where(and(
      eq(teams.name, name),
      eq(teams.acceptanceStatus, 'approved')
    ));

    if (existingTeam.length > 0) {
      return res.status(400).json({ error: "Team with this name is already active" });
    }

    const [newTeam] = await db.insert(teams).values({
      name,
      description,
      leaderId,
      acceptanceStatus: "pending"// Default to pending
    }).returning();

    res.status(201).json(newTeam);
  } catch (error) {
    console.error("Error creating team:", error);
    res.status(500).json({ error: "Failed to create team" });
  }
}

export async function updateTeam(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const [updatedTeam] = await db.update(teams)
      .set({ name, description })
      .where(eq(teams.id, parseInt(id)))
      .returning();

    if (!updatedTeam) {
      return res.status(404).json({ error: "Team not found" });
    }
    res.json(updatedTeam);
  } catch (error) {
    console.error("Error updating team", error);
    res.status(500).json({ error: "Failed to update team" });
  }
}

// // 4. Get team members (Admin and Team Leader only)
// export async function getTeamMembers(req: Request<{ id: string }>, res: Response) {
//   try {
//     const { id } = req.params;
//     const userId = (req as any).user.id;
//     const teamId = parseInt(id);

//     // 1. Get Team
//     const team = await db.select().from(teams).where(eq(teams.id, teamId));
//     if (team.length === 0) return res.status(404).json({ error: "Team not found" });

//     // 2. Check Permissions (Leader or Admin)
//     const isAdmin = await db.select().from(admins).where(eq(admins.id, userId));

//     if (team[0].leaderId !== userId && isAdmin.length === 0) {
//       return res.status(403).json({ error: "Only the team leader or an admin can view members" });
//     }

//     const members = await db
//       .select({
//         studentId: belongTo.studentId,
//         role: belongTo.role,
//         fname: users.fname,
//         lname: users.lname,
//         email: users.email
//       })
//       .from(belongTo)
//       .innerJoin(students, eq(belongTo.studentId, students.id))
//       .innerJoin(users, eq(students.id, users.id))
//       .where(eq(belongTo.teamId, teamId));

//     res.json({
//       message: "Team members retrieved successfully",
//       members
//     });
//   } catch (error) {
//     console.error("Error fetching team members:", error);
//     res.status(500).json({ error: "Failed to fetch team members" });
//   }
// }

// 4. Get team members (All authenticated users) sorry if i cant change this 
export async function getTeamMembers(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const teamId = parseInt(id);

    // 1. Get Team (Still needed to ensure the team exists)
    const team = await db.select().from(teams).where(eq(teams.id, teamId));
    if (team.length === 0) return res.status(404).json({ error: "Team not found" });

    const members = await db
      .select({
        studentId: belongTo.studentId,
        role: belongTo.role,
        fname: users.fname,
        lname: users.lname,
        email: users.email
      })
      .from(belongTo)
      .innerJoin(students, eq(belongTo.studentId, students.id))
      .innerJoin(users, eq(students.id, users.id))
      .where(eq(belongTo.teamId, teamId));

    res.json({
      message: "Team members retrieved successfully",
      members
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
}

// 5. Remove a member (Leader only)
export async function removeMember(
  req: Request<any, any, { teamId: number; studentId: number }>,
  res: Response
) {
  try {
    const { teamId, studentId } = req.body;
    const currentUserId = (req as any).user.id; // The leader

    // 1. Verify Team Exists
    const team = await db.select().from(teams).where(eq(teams.id, teamId));
    if (team.length === 0) return res.status(404).json({ error: "Team not found" });

    // 2. Verify Requester is Leader
    if (team[0].leaderId !== currentUserId) {
      return res.status(403).json({ error: "Only the team leader can remove members" });
    }

    // 3. Remove Member
    await db.delete(belongTo)
      .where(and(eq(belongTo.teamId, teamId), eq(belongTo.studentId, studentId)));

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ error: "Failed to remove member" });
  }
}

// 6. Update a member's role (Leader only)
export async function updateMemberRole(
  req: Request<any, any, { teamId: number; studentId: number; newRole: string }>,
  res: Response
) {
  try {
    const { teamId, studentId, newRole } = req.body;
    const currentUserId = (req as any).user.id;

    // 1. Verify Team Exists
    const team = await db.select().from(teams).where(eq(teams.id, teamId));
    if (team.length === 0) return res.status(404).json({ error: "Team not found" });

    // 2. Verify Requester is Leader
    if (team[0].leaderId !== currentUserId) {
      return res.status(403).json({ error: "Only the team leader can update roles" });
    }

    // 3. Update Role
    await db.update(belongTo)
      .set({ role: newRole })
      .where(and(eq(belongTo.teamId, teamId), eq(belongTo.studentId, studentId)));

    res.json({ message: "Member role updated successfully" });
  } catch (error) {
    console.error("Error updating member role:", error);
    res.status(500).json({ error: "Failed to update member role" });
  }
}

// 7. Leave team
export async function leaveTeam(req: Request<{ teamId: string }>, res: Response) {
  try {
    const { teamId } = req.params;
    const userId = (req as any).user.id;

    // Check if member exists
    const member = await db
      .select()
      .from(belongTo)
      .where(and(eq(belongTo.teamId, parseInt(teamId)), eq(belongTo.studentId, userId)));

    if (member.length === 0) {
      return res.status(400).json({ error: "You are not a member of this team" });
    }

    // Delete membership
    await db.delete(belongTo)
      .where(and(eq(belongTo.teamId, parseInt(teamId)), eq(belongTo.studentId, userId)));

    res.json({ message: "Left team successfully" });
  } catch (error) {
    console.error("Error leaving team:", error);
    res.status(500).json({ error: "Failed to leave team" });
  }
}

// 8. Delete team (Admin only)
export async function deleteTeam(req: Request<{ teamId: string }>, res: Response) {
  try {
    const { teamId } = req.params;
    const userId = (req as any).user.id;

    // 1. Check if Admin
    const isAdmin = await db.select().from(admins).where(eq(admins.id, userId));

    if (isAdmin.length === 0) {
      return res.status(403).json({ error: "Only admins can delete teams" });
    }

    // 2. Delete Team
    await db.delete(teams).where(eq(teams.id, parseInt(teamId)));

    res.json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error("Error deleting team:", error);
    res.status(500).json({ error: "Failed to delete team" });
  }
}

// 9. Accept Team (Admin only)
export async function acceptTeam(req: Request<{ teamId: string }>, res: Response) {
  try {
    const { teamId } = req.params;
    const userId = (req as any).user.id;

    // 1. Verify Admin
    const isAdmin = await db.select().from(admins).where(eq(admins.id, userId));
    if (isAdmin.length === 0) {
      return res.status(403).json({ error: "Only admins can approve teams" });
    }

    // 2. Get Team
    const team = await db.select().from(teams).where(eq(teams.id, parseInt(teamId)));
    if (team.length === 0) return res.status(404).json({ error: "Team not found" });

    // 3. Check for Collision (Same name AND approved)
    // We exclude the current team just in case (though it shouldn't be approved yet)
    const duplicateTeam = await db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.name, team[0].name),
          eq(teams.leaderId, team[0].leaderId),
          eq(teams.acceptanceStatus, 'approved'),
          sql`${teams.id} != ${parseInt(teamId)}`
        )
      );

    if (duplicateTeam.length > 0) {
      return res.status(400).json({
        error: "Cannot approve team: Another approved team with this name already exists."
      });
    }

    // 4. Approve Team
    const [updatedTeam] = await db
      .update(teams)
      .set({
        acceptanceStatus: 'approved',
        respondedBy: userId
      })
      .where(eq(teams.id, parseInt(teamId)))
      .returning();

    res.json({
      message: "Team approved successfully",
      team: updatedTeam
    });

  } catch (error) {
    console.error("Error approving team:", error);
    res.status(500).json({ error: "Failed to approve team" });
  }
}


// get all team's members (not organizer nor member)
export async function getStudentsWithBadges(req: Request, res: Response) {
  try {
    const studentsWithBadges = await db
      .select({
        studentId: badges.studentId,
        teamId: badges.teamId,
        badgeType: badges.type,
        points: badges.points,
        expDate: badges.expDate,
        usageNum: badges.usageNum,
        // Student info from users table
        fname: users.fname,
        lname: users.lname,
        email: users.email,
        imgUrl: users.imgUrl,
      })
      .from(badges)
      .innerJoin(students, eq(badges.studentId, students.id))
      .innerJoin(users, eq(students.id, users.id));
    return res.status(200).json({
      message: "Students with badges retrieved",
      students: studentsWithBadges,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch students with badges" });
  }
}
// 10. Get My Teams (Subscribed)
export async function getMyTeams(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;

    const myTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        leaderId: teams.leaderId,
        respondedBy: teams.respondedBy,
        acceptanceStatus: teams.acceptanceStatus,
      })
      .from(subscribe)
      .innerJoin(teams, eq(subscribe.teamId, teams.id))
      .where(eq(subscribe.userId, userId));

    res.json(myTeams);
  } catch (error) {
    console.error("Error fetching my teams:", error);
    res.status(500).json({ error: "Failed to fetch my teams" });
  }
}

// 11. Get Teams by User ID (Public/Profile View)
export async function getUserTeams(req: Request<{ userId: string }>, res: Response) {
  try {
    const { userId } = req.params;

    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
      })
      .from(subscribe)
      .innerJoin(teams, eq(subscribe.teamId, teams.id))
      .where(eq(subscribe.userId, parseInt(userId)));

    res.json(userTeams);
  } catch (error) {
    console.error("Error fetching user teams:", error);
    res.status(500).json({ error: "Failed to fetch user teams" });
  }
}
