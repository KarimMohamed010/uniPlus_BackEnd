import db from "../db/connection.ts";
import { sql } from "drizzle-orm";

export async function awardPoints(studentId: number, teamId: number, pointsToAdd: number) {
    try {
        await db.execute(sql`CALL award_points(${studentId}, ${teamId}, ${pointsToAdd})`);
    } catch (error) {
        console.error("Error awarding points via stored procedure:", error);
    }
}
