import type { Request, Response } from "express";
import db from "../db/connection.ts";
import { teams } from "../db/schema.ts";
import { eq } from "drizzle-orm";

// Get all teams
export async function getAllTeams(req: Request, res: Response) {
  try {
    const allTeams = await db.select().from(teams);
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
    const team = await db.select().from(teams).where(eq(teams.id, parseInt(id)));
    
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
    const { name, description } = req.body;
    const leaderId = (req as any).user.id;
    
    const [newTeam] = await db.insert(teams).values({
      name,
      description,
      leaderId,
      acceptanceStatus: "pending" // Default to pending
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
