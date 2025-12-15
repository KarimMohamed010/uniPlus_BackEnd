import type { Request, Response } from "express";
import db from "../db/connection.ts";
import { systemAnnouncements, users } from "../db/schema.ts";
import { eq, asc, desc } from "drizzle-orm";

export async function createAnnouncement(req: Request, res: Response) {
  try {
    const {content} = req.body;
    const authorId = (req as any).user.id;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const [announcement] = await db
      .insert(systemAnnouncements)
      .values({
        content,
        authorId,
      })
      .returning();

    return res.status(201).json({
      message: "Announcement created successfully",
      announcement,
    });
  } catch (error) {
    console.error("Error creating announcement:", error);
    return res.status(500).json({ error: "Failed to create announcement" });
  }
}

export async function getAnnouncements(req: Request, res: Response) {
  try {
    const announcements = await db
      .select({
        id: systemAnnouncements.id,
        content: systemAnnouncements.content,
        createdAt: systemAnnouncements.createdAt,
        author: {
          id: users.id,
          fname: users.fname,
          lname: users.lname,
          imgUrl: users.imgUrl,
        },
      })
      .from(systemAnnouncements)
      .leftJoin(users, eq(systemAnnouncements.authorId, users.id))
      .orderBy(asc(systemAnnouncements.createdAt));

    return res.status(200).json({ announcements });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
}

export async function deleteAnnouncement(req: Request, res: Response) {
    try {
        const { id } = req.params;
        
        await db.delete(systemAnnouncements).where(eq(systemAnnouncements.id, parseInt(id)));

        return res.status(200).json({ message: "Announcement deleted successfully" });
    } catch (error) {
        console.error("Error deleting announcement:", error);
        return res.status(500).json({ error: "Failed to delete announcement" });
    }
}
