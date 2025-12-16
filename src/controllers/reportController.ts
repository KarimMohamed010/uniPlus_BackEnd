import type { Request, Response } from "express";
import db from "../db/connection.ts";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { admins, events, teams, ticketsAndFeedback } from "../db/schema.ts";
import { z } from "zod";

// Input validation schemas
const reportQuerySchema = z.object({
  scope: z.enum(['event', 'team']).default('event'),
  timeRange: z.enum(['week', 'month', 'year', 'all']).default('month'),
  type: z.enum(['participation', 'engagement']).default('participation'),
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
