import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
    speakers,
    admins,
} from "../db/schema.ts";
import { eq } from "drizzle-orm";

// 1. Add a speaker (Admin only)
export async function AddSpeaker(
    req: Request<any, any, { name: string; bio?: string; fname?: string; lname?: string; contact?: number; email: string }>,
    res: Response
) {
    try {
        const { name, bio, fname, lname, contact, email } = req.body;
        const userId = (req as any).user.id;

        // Check if user is admin
        const adminRecord = await db
            .select()
            .from(admins)
            .where(eq(admins.id, userId));

        if (adminRecord.length === 0) {
            return res.status(403).json({ error: "Only admins can Add speakers" });
        }

        const [newSpeaker] = await db
            .insert(speakers)
            .values({
                name,
                bio,
                fname,
                lname,
                contact,
                email,
            })
            .returning();

        return res.status(201).json({
            message: "Speaker added successfully",
            speaker: newSpeaker,
        });
    } catch (error) {
        console.error("Error adding speaker:", error);
        res.status(500).json({ error: "Failed to add speaker" });
    }
}

// 2. Get all speakers
export async function getAllSpeakers(req: Request, res: Response) {
    try {
        const speakersData = await db
            .select()
            .from(speakers);

        return res.status(200).json({
            message: "Speakers retrieved successfully",
            speakers: speakersData,
        });
    } catch (error) {
        console.error("Error fetching speakers:", error);
        res.status(500).json({ error: "Failed to fetch speakers" });
    }
}

// 3. Get a single speaker
export async function getSpeaker(req: Request<{ speakerId: string }>, res: Response) {
    try {
        const { speakerId } = req.params;

        const speakerData = await db
            .select()
            .from(speakers)
            .where(eq(speakers.id, parseInt(speakerId)));

        if (speakerData.length === 0) {
            return res.status(404).json({ error: "Speaker not found" });
        }

        return res.status(200).json({
            message: "Speaker retrieved successfully",
            speaker: speakerData[0],
        });
    } catch (error) {
        console.error("Error fetching speaker:", error);
        res.status(500).json({ error: "Failed to fetch speaker" });
    }
}

// 4. Update a speaker (Admin only)
export async function updateSpeaker(req: Request<{ speakerId: string }>, res: Response) {
    try {
        const { speakerId } = req.params;
        const { name, bio, fname, lname, contact, email } = req.body;
        const userId = (req as any).user.id;

        // Check if user is admin
        const adminRecord = await db
            .select()
            .from(admins)
            .where(eq(admins.id, userId));

        if (adminRecord.length === 0) {
            return res.status(403).json({ error: "Only admins can update speakers" });
        }
        // update specific fields of speaker
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (bio !== undefined) updateData.bio = bio;
        if (fname !== undefined) updateData.fname = fname;
        if (lname !== undefined) updateData.lname = lname;
        if (contact !== undefined) updateData.contact = contact;
        if (email !== undefined) updateData.email = email;

        await db
            .update(speakers)
            .set(updateData)
            .where(eq(speakers.id, parseInt(speakerId)));

        return res.status(200).json({
            message: "Speaker updated successfully",
        });
    } catch (error) {
        console.error("Error updating speaker:", error);
        res.status(500).json({ error: "Failed to update speaker" });
    }
}

// 5. Delete a speaker (Admin only)
export async function deleteSpeaker(req: Request<{ speakerId: string }>, res: Response) {
    try {
        const { speakerId } = req.params;
        const userId = (req as any).user.id;

        // Check if user is admin
        const adminRecord = await db
            .select()
            .from(admins)
            .where(eq(admins.id, userId));

        if (adminRecord.length === 0) {
            return res.status(403).json({ error: "Only admins can delete speakers" });
        }

        await db.delete(speakers).where(eq(speakers.id, parseInt(speakerId)));

        return res.status(200).json({ message: "Speaker deleted successfully" });
    } catch (error) {
        console.error("Error deleting speaker:", error);
        res.status(500).json({ error: "Failed to delete speaker" });
    }
}
