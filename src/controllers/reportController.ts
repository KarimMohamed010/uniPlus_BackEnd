import type { Request, Response } from "express";
import db from "../db/connection.ts";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import {
  admins,
  apply,
  belongTo,
  comments,
  events,
  messages,
  posts,
  rides,
  students,
  teams,
  ticketsAndFeedback,
  users,
} from "../db/schema.ts";
import { z } from "zod";

// Input validation schemas
const reportQuerySchema = z.object({
  scope: z.enum(['event', 'team']).default('event'),
  timeRange: z.enum(['week', 'month', 'year', 'all']).default('month'),
  type: z.enum(['participation', 'engagement']).default('participation'),
});

const teamReportQuerySchema = z.object({
  scope: z.enum(['event', 'team']).default('event'),
  timeRange: z.enum(['week', 'month', 'year', 'all']).default('month'),
});

// Helper function to get date range based on time range
const getDateRange = (timeRange: string) => {
  const now = new Date();
  const start = new Date();
  
  switch (timeRange) {
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
    default:
      return { start: new Date(0), end: now };
  }
  
  return { start, end: now };
};

 const requireAdmin = async (req: Request) => {
   const userId = (req as any).user?.id;
   const adminRecord = await db.select().from(admins).where(eq(admins.id, userId));
   return adminRecord.length > 0;
 };

const requireTeamReportAccess = async (req: Request, teamId: number) => {
  const userId = (req as any).user?.id;
  if (!userId) return false;

  const adminRecord = await db.select().from(admins).where(eq(admins.id, userId));
  if (adminRecord.length > 0) return true;

  const teamRecord = await db.select().from(teams).where(eq(teams.id, teamId));
  if (teamRecord.length === 0) return false;

  if (teamRecord[0].leaderId === userId) return true;

  const organizerMembership = await db
    .select()
    .from(belongTo)
    .where(
      and(
        eq(belongTo.teamId, teamId),
        eq(belongTo.studentId, userId),
        eq(belongTo.role, "organizer")
      )
    );

  return organizerMembership.length > 0;
};

export const getTeamParticipationReport = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params as { teamId: string };
    const parsedTeamId = parseInt(teamId);
    if (Number.isNaN(parsedTeamId)) {
      return res.status(400).json({ error: "Invalid teamId" });
    }

    const { scope, timeRange } = teamReportQuerySchema.parse(req.query);
    const { start, end } = getDateRange(timeRange);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    if (!(await requireTeamReportAccess(req, parsedTeamId))) {
      return res.status(403).json({ error: "Not allowed to view this team's reports" });
    }

    if (scope === "team") {
      const rows = await db
        .select({
          id: teams.id,
          name: teams.name,
          participants: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
          checkins: sql<number>`SUM(CASE WHEN ${ticketsAndFeedback.scanned} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(teams)
        .innerJoin(events, eq(events.teamId, teams.id))
        .leftJoin(ticketsAndFeedback, eq(ticketsAndFeedback.eventId, events.id))
        .where(
          and(
            eq(teams.id, parsedTeamId),
            isNotNull(events.startTime),
            gte(events.startTime, startIso),
            lte(events.startTime, endIso)
          )
        )
        .groupBy(teams.id, teams.name);

      const data = rows.map((r) => {
        const participants = Number(r.participants ?? 0);
        const checkins = Number(r.checkins ?? 0);
        const attendanceRate = participants > 0 ? Math.round((checkins / participants) * 100) : 0;
        return {
          id: r.id,
          name: r.name,
          participants,
          attendanceRate,
          date: endIso.split("T")[0],
        };
      });

      return res.json({ success: true, data });
    }

    const rows = await db
      .select({
        id: events.id,
        name: events.title,
        date: events.startTime,
        participants: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
        checkins: sql<number>`SUM(CASE WHEN ${ticketsAndFeedback.scanned} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(events)
      .leftJoin(ticketsAndFeedback, eq(ticketsAndFeedback.eventId, events.id))
      .where(
        and(
          eq(events.teamId, parsedTeamId),
          isNotNull(events.startTime),
          gte(events.startTime, startIso),
          lte(events.startTime, endIso)
        )
      )
      .groupBy(events.id, events.title, events.startTime)
      .orderBy(desc(events.startTime));

    const data = rows.map((r) => {
      const participants = Number(r.participants ?? 0);
      const checkins = Number(r.checkins ?? 0);
      const attendanceRate = participants > 0 ? Math.round((checkins / participants) * 100) : 0;
      return {
        id: r.id,
        name: r.name,
        participants,
        attendanceRate,
        date: (r.date ?? endIso).split("T")[0],
      };
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Error generating team participation report:", error);
    return res.status(500).json({ error: "Failed to generate team participation report" });
  }
};

export const getTeamEngagementReportScoped = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params as { teamId: string };
    const parsedTeamId = parseInt(teamId);
    if (Number.isNaN(parsedTeamId)) {
      return res.status(400).json({ error: "Invalid teamId" });
    }

    const { scope, timeRange } = teamReportQuerySchema.parse(req.query);
    const { start, end } = getDateRange(timeRange);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    if (!(await requireTeamReportAccess(req, parsedTeamId))) {
      return res.status(403).json({ error: "Not allowed to view this team's reports" });
    }

    if (scope === "team") {
      const rows = await db
        .select({
          id: teams.id,
          name: teams.name,
          participants: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
          engagementScore: sql<number>`AVG(${ticketsAndFeedback.rating})`,
          totalInteractions: sql<number>`COUNT(${ticketsAndFeedback.feedback})`,
        })
        .from(teams)
        .innerJoin(events, eq(events.teamId, teams.id))
        .leftJoin(ticketsAndFeedback, eq(ticketsAndFeedback.eventId, events.id))
        .where(
          and(
            eq(teams.id, parsedTeamId),
            isNotNull(events.startTime),
            gte(events.startTime, startIso),
            lte(events.startTime, endIso)
          )
        )
        .groupBy(teams.id, teams.name);

      const data = rows.map((r) => ({
        id: r.id,
        name: r.name,
        participants: Number(r.participants ?? 0),
        engagementScore: r.engagementScore ? Number(Number(r.engagementScore).toFixed(1)) : 0,
        totalInteractions: Number(r.totalInteractions ?? 0),
        date: endIso.split("T")[0],
      }));

      return res.json({ success: true, data });
    }

    const rows = await db
      .select({
        id: events.id,
        name: events.title,
        date: events.startTime,
        participants: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
        engagementScore: sql<number>`AVG(${ticketsAndFeedback.rating})`,
        totalInteractions: sql<number>`COUNT(${ticketsAndFeedback.feedback})`,
      })
      .from(events)
      .leftJoin(ticketsAndFeedback, eq(ticketsAndFeedback.eventId, events.id))
      .where(
        and(
          eq(events.teamId, parsedTeamId),
          isNotNull(events.startTime),
          gte(events.startTime, startIso),
          lte(events.startTime, endIso)
        )
      )
      .groupBy(events.id, events.title, events.startTime)
      .orderBy(desc(events.startTime));

    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      participants: Number(r.participants ?? 0),
      engagementScore: r.engagementScore ? Number(Number(r.engagementScore).toFixed(1)) : 0,
      totalInteractions: Number(r.totalInteractions ?? 0),
      date: (r.date ?? endIso).split("T")[0],
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Error generating team engagement report:", error);
    return res.status(500).json({ error: "Failed to generate team engagement report" });
  }
};

// Get participation report
export const getParticipationReport = async (req: Request, res: Response) => {
  try {
    const { scope, timeRange } = reportQuerySchema.parse(req.query);
    const { start, end } = getDateRange(timeRange);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    if (!(await requireAdmin(req))) {
      return res.status(403).json({ error: "Only admins can view reports" });
    }

    if (scope === "team") {
      const rows = await db
        .select({
          id: teams.id,
          name: teams.name,
          participants: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
          checkins: sql<number>`SUM(CASE WHEN ${ticketsAndFeedback.scanned} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(teams)
        .innerJoin(events, eq(events.teamId, teams.id))
        .leftJoin(ticketsAndFeedback, eq(ticketsAndFeedback.eventId, events.id))
        .where(
          and(
            isNotNull(events.startTime),
            gte(events.startTime, startIso),
            lte(events.startTime, endIso)
          )
        )
        .groupBy(teams.id, teams.name)
        .orderBy(desc(teams.id));

      const data = rows.map((r) => {
        const participants = Number(r.participants ?? 0);
        const checkins = Number(r.checkins ?? 0);
        const attendanceRate = participants > 0 ? Math.round((checkins / participants) * 100) : 0;
        return {
          id: r.id,
          name: r.name,
          participants,
          attendanceRate,
          date: endIso.split("T")[0],
        };
      });

      return res.json({ success: true, data });
    }

    const rows = await db
      .select({
        id: events.id,
        name: events.title,
        date: events.startTime,
        participants: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
        checkins: sql<number>`SUM(CASE WHEN ${ticketsAndFeedback.scanned} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(events)
      .leftJoin(ticketsAndFeedback, eq(ticketsAndFeedback.eventId, events.id))
      .where(
        and(
          isNotNull(events.startTime),
          gte(events.startTime, startIso),
          lte(events.startTime, endIso)
        )
      )
      .groupBy(events.id, events.title, events.startTime)
      .orderBy(desc(events.startTime));

    const reportData = rows.map((r) => {
      const participants = Number(r.participants ?? 0);
      const checkins = Number(r.checkins ?? 0);
      const attendanceRate = participants > 0 ? Math.round((checkins / participants) * 100) : 0;
      return {
        id: r.id,
        name: r.name,
        participants,
        attendanceRate,
        date: (r.date ?? endIso).split("T")[0],
      };
    });

    res.json({
      success: true,
      data: reportData,
      meta: {
        total: reportData.length,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        scope,
        timeRange,
        type: 'participation',
      },
    });
  } catch (error) {
    console.error('Error generating participation report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate participation report',
    });
  }
};

export const getManagerialReport = async (req: Request, res: Response) => {
  try {
    if (!(await requireAdmin(req))) {
      return res.status(403).json({ error: "Only admins can view reports" });
    }

    const [
      usersAgg,
      studentsAgg,
      adminsAgg,
      teamsAgg,
      eventsAgg,
      registrationsAgg,
      postsAgg,
      commentsAgg,
      messagesAgg,
      ridesAgg,
      applicationsAgg,
    ] = await Promise.all([
      db.select({ value: sql<number>`COUNT(*)` }).from(users),
      db.select({ value: sql<number>`COUNT(*)` }).from(students),
      db.select({ value: sql<number>`COUNT(*)` }).from(admins),
      db.select({ value: sql<number>`COUNT(*)` }).from(teams),
      db
        .select({
          total: sql<number>`COUNT(*)`,
          approved: sql<number>`SUM(CASE WHEN ${events.acceptanceStatus} = 'approved' THEN 1 ELSE 0 END)`,
          pending: sql<number>`SUM(CASE WHEN ${events.acceptanceStatus} = 'pending' THEN 1 ELSE 0 END)`,
          rejected: sql<number>`SUM(CASE WHEN ${events.acceptanceStatus} = 'rejected' THEN 1 ELSE 0 END)`,
        })
        .from(events),
      db
        .select({
          totalRegistrations: sql<number>`COUNT(*)`,
          uniqueRegistrants: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
          totalCheckins: sql<number>`SUM(CASE WHEN ${ticketsAndFeedback.scanned} = 1 THEN 1 ELSE 0 END)`,
          avgTicketPrice: sql<number>`AVG(${ticketsAndFeedback.price})`,
          minTicketPrice: sql<number>`MIN(${ticketsAndFeedback.price})`,
          maxTicketPrice: sql<number>`MAX(${ticketsAndFeedback.price})`,
          avgRating: sql<number>`AVG(${ticketsAndFeedback.rating})`,
          feedbackCount: sql<number>`COUNT(${ticketsAndFeedback.feedback})`,
        })
        .from(ticketsAndFeedback),
      db.select({ value: sql<number>`COUNT(*)` }).from(posts),
      db.select({ value: sql<number>`COUNT(*)` }).from(comments),
      db.select({ value: sql<number>`COUNT(*)` }).from(messages),
      db.select({ value: sql<number>`COUNT(*)` }).from(rides),
      db.select({ value: sql<number>`COUNT(*)` }).from(apply),
    ]);

    const totalUsers = Number(usersAgg[0]?.value ?? 0);
    const totalStudents = Number(studentsAgg[0]?.value ?? 0);
    const totalAdmins = Number(adminsAgg[0]?.value ?? 0);
    const totalTeams = Number(teamsAgg[0]?.value ?? 0);
    const totalPosts = Number(postsAgg[0]?.value ?? 0);
    const totalComments = Number(commentsAgg[0]?.value ?? 0);
    const totalMessages = Number(messagesAgg[0]?.value ?? 0);
    const totalRides = Number(ridesAgg[0]?.value ?? 0);
    const totalApplications = Number(applicationsAgg[0]?.value ?? 0);

    const totalEvents = Number(eventsAgg[0]?.total ?? 0);
    const approvedEvents = Number(eventsAgg[0]?.approved ?? 0);
    const pendingEvents = Number(eventsAgg[0]?.pending ?? 0);
    const rejectedEvents = Number(eventsAgg[0]?.rejected ?? 0);

    const totalRegistrations = Number(registrationsAgg[0]?.totalRegistrations ?? 0);
    const uniqueRegistrants = Number(registrationsAgg[0]?.uniqueRegistrants ?? 0);
    const totalCheckins = Number(registrationsAgg[0]?.totalCheckins ?? 0);

    const avgTicketPriceRaw = registrationsAgg[0]?.avgTicketPrice;
    const minTicketPriceRaw = registrationsAgg[0]?.minTicketPrice;
    const maxTicketPriceRaw = registrationsAgg[0]?.maxTicketPrice;
    const avgRatingRaw = registrationsAgg[0]?.avgRating;
    const feedbackCount = Number(registrationsAgg[0]?.feedbackCount ?? 0);

    const avgTicketPrice = avgTicketPriceRaw ? Number(Number(avgTicketPriceRaw).toFixed(2)) : 0;
    const minTicketPrice = minTicketPriceRaw ? Number(minTicketPriceRaw) : 0;
    const maxTicketPrice = maxTicketPriceRaw ? Number(maxTicketPriceRaw) : 0;
    const avgRating = avgRatingRaw ? Number(Number(avgRatingRaw).toFixed(1)) : 0;

    const checkinRate = totalRegistrations > 0 ? Number(((totalCheckins / totalRegistrations) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalStudents,
        totalAdmins,
        totalTeams,
        totalEvents,
        approvedEvents,
        pendingEvents,
        rejectedEvents,
        totalRegistrations,
        uniqueRegistrants,
        totalCheckins,
        checkinRate,
        avgTicketPrice,
        minTicketPrice,
        maxTicketPrice,
        avgRating,
        feedbackCount,
        totalPosts,
        totalComments,
        totalMessages,
        totalRides,
        totalApplications,
      },
    });
  } catch (error) {
    console.error("Error generating managerial report:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate managerial report",
    });
  }
};

// Get engagement report
export const getEngagementReport = async (req: Request, res: Response) => {
  try {
    const { scope, timeRange } = reportQuerySchema.parse(req.query);
    const { start, end } = getDateRange(timeRange);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    if (!(await requireAdmin(req))) {
      return res.status(403).json({ error: "Only admins can view reports" });
    }

    if (scope === "team") {
      const rows = await db
        .select({
          id: teams.id,
          name: teams.name,
          participants: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
          engagementScore: sql<number>`AVG(${ticketsAndFeedback.rating})`,
          totalInteractions: sql<number>`COUNT(${ticketsAndFeedback.feedback})`,
        })
        .from(teams)
        .innerJoin(events, eq(events.teamId, teams.id))
        .leftJoin(ticketsAndFeedback, eq(ticketsAndFeedback.eventId, events.id))
        .where(
          and(
            isNotNull(events.startTime),
            gte(events.startTime, startIso),
            lte(events.startTime, endIso)
          )
        )
        .groupBy(teams.id, teams.name)
        .orderBy(desc(teams.id));

      const data = rows.map((r) => ({
        id: r.id,
        name: r.name,
        participants: Number(r.participants ?? 0),
        engagementScore: r.engagementScore ? Number(Number(r.engagementScore).toFixed(1)) : 0,
        totalInteractions: Number(r.totalInteractions ?? 0),
        date: endIso.split("T")[0],
      }));

      return res.json({ success: true, data });
    }

    const rows = await db
      .select({
        id: events.id,
        name: events.title,
        date: events.startTime,
        participants: sql<number>`COUNT(DISTINCT ${ticketsAndFeedback.studentId})`,
        engagementScore: sql<number>`AVG(${ticketsAndFeedback.rating})`,
        totalInteractions: sql<number>`COUNT(${ticketsAndFeedback.feedback})`,
      })
      .from(events)
      .leftJoin(ticketsAndFeedback, eq(ticketsAndFeedback.eventId, events.id))
      .where(
        and(
          isNotNull(events.startTime),
          gte(events.startTime, startIso),
          lte(events.startTime, endIso)
        )
      )
      .groupBy(events.id, events.title, events.startTime)
      .orderBy(desc(events.startTime));

    const reportData = rows.map((r) => ({
      id: r.id,
      name: r.name,
      participants: Number(r.participants ?? 0),
      engagementScore: r.engagementScore ? Number(Number(r.engagementScore).toFixed(1)) : 0,
      totalInteractions: Number(r.totalInteractions ?? 0),
      date: (r.date ?? endIso).split("T")[0],
    }));

    res.json({
      success: true,
      data: reportData,
      meta: {
        total: reportData.length,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        scope,
        timeRange,
        type: 'engagement',
      },
    });
  } catch (error) {
    console.error('Error generating engagement report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate engagement report',
    });
  }
};

// Get team engagement report (if needed)
export const getTeamEngagementReport = async (req: Request, res: Response) => {
  // Implementation for team-level engagement reports
  // This would join with teams and team_members tables
  res.status(501).json({
    success: false,
    error: 'Team engagement reports are not yet implemented',
  });
};
