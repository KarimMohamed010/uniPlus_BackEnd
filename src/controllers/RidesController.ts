import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
    rides,
    users,
    students,
    joinRide,
} from "../db/schema.ts";
import { eq, and, desc, sql } from "drizzle-orm";

// 1. Create a ride
export async function createRide(
    req: Request<any, any, { toLoc: string; fromLoc: string; price: number; seatsAvailable: number; arrivalTime: string; service: string }>,
    res: Response
) {
    try {
        const { toLoc, fromLoc, price, seatsAvailable, arrivalTime, service } = req.body;
        const userId = (req as any).user.id;


        const [newRide] = await db
            .insert(rides)
            .values({
                toLoc,
                fromLoc,
                price,
                seatsAvailable,
                arrivalTime,
                service,
                createdBy: userId,
            })
            .returning();

        return res.status(201).json({
            message: "Ride created successfully",
            ride: newRide,
        });
    } catch (error) {
        console.error("Error creating ride:", error);
        res.status(500).json({ error: "Failed to create ride" });
    }
}

// 2. Get all rides with search and filter
export async function getAllRides(req: Request, res: Response) {
    try {
        const { to, from, maxPrice, date, availableOnly } = req.query;

        const filters = [];

        if (to) {
            filters.push(sql`${rides.toLoc} ILIKE ${'%' + to + '%'}`);
        }
        if (from) {
            filters.push(sql`${rides.fromLoc} ILIKE ${'%' + from + '%'}`);
        }
        if (maxPrice) {
            filters.push(sql`${rides.price} <= ${parseInt(maxPrice as string)}`);
        }
        if (date) {
            // Filter for rides on or after the specified date
            filters.push(sql`${rides.arrivalTime} >= ${date}`);
        }
        // Return only available rides
        filters.push(sql`${rides.seatsAvailable} > 0`);

        const ridesData = await db
            .select({
                id: rides.id,
                toLoc: rides.toLoc,
                fromLoc: rides.fromLoc,
                price: rides.price,
                seatsAvailable: rides.seatsAvailable,
                arrivalTime: rides.arrivalTime,
                service: rides.service,
                driver: {
                    id: users.id,
                    fname: users.fname,
                    lname: users.lname,
                    imgUrl: users.imgUrl,
                }
            })
            .from(rides)
            .innerJoin(students, eq(rides.createdBy, students.id))
            .innerJoin(users, eq(students.id, users.id))
            .where(and(...filters))
            .orderBy(desc(rides.arrivalTime));

        return res.status(200).json({
            message: "Rides retrieved successfully",
            rides: ridesData,
        });
    } catch (error) {
        console.error("Error fetching rides:", error);
        res.status(500).json({ error: "Failed to fetch rides" });
    }
}

// 3. Get ride by ID
export async function getRideById(req: Request<{ rideId: string }>, res: Response) {
    try {
        const { rideId } = req.params;

        const ride = await db
            .select({
                id: rides.id,
                toLoc: rides.toLoc,
                fromLoc: rides.fromLoc,
                price: rides.price,
                seatsAvailable: rides.seatsAvailable,
                arrivalTime: rides.arrivalTime,
                service: rides.service,
                driver: {
                    id: users.id,
                    fname: users.fname,
                    lname: users.lname,
                    imgUrl: users.imgUrl,
                }
            })
            .from(rides)
            .innerJoin(students, eq(rides.createdBy, students.id))
            .innerJoin(users, eq(students.id, users.id))
            .where(eq(rides.id, parseInt(rideId)));

        if (ride.length === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }

        // Fetch passengers
        const passengers = await db
            .select({
                id: users.id,
                fname: users.fname,
                lname: users.lname,
                imgUrl: users.imgUrl,
            })
            .from(joinRide)
            .innerJoin(students, eq(joinRide.studentId, students.id))
            .innerJoin(users, eq(students.id, users.id))
            .where(eq(joinRide.rideId, parseInt(rideId)));

        return res.status(200).json({
            message: "Ride retrieved successfully",
            ride: {
                ...ride[0],
                passengers
            },
        });
    } catch (error) {
        console.error("Error fetching ride:", error);
        res.status(500).json({ error: "Failed to fetch ride" });
    }
}

// 4. Join a ride
export async function joinRideHandler(req: Request<{ rideId: string }>, res: Response) {
    try {
        const { rideId } = req.params;
        const userId = (req as any).user.id;

        // Using a transaction to ensure atomicity and preventing race conditions 
        // by using atomic SQL decrement for seats.

        await db.transaction(async (tx) => {
            const ride = await tx
                .select()
                .from(rides)
                .where(eq(rides.id, parseInt(rideId)));

            if (ride.length === 0) throw new Error("Ride not found");

            if ((ride[0].seatsAvailable ?? 0) <= 0) {
                throw new Error("No seats available");
            }

            // Check if already joined
            const existing = await tx
                .select()
                .from(joinRide)
                .where(and(eq(joinRide.rideId, parseInt(rideId)), eq(joinRide.studentId, userId)));

            if (existing.length > 0) {
                throw new Error("Already joined this ride");
            }

            // Join
            await tx.insert(joinRide).values({
                rideId: parseInt(rideId),
                studentId: userId,
            });

            // Decrement seats atomically
            await tx
                .update(rides)
                .set({
                    seatsAvailable: sql`${rides.seatsAvailable} - 1`,
                })
                .where(eq(rides.id, parseInt(rideId)));
        });

        return res.status(200).json({ message: "Joined ride successfully" });

    } catch (error: any) {
        if (error.message === "Ride not found") return res.status(404).json({ error: "Ride not found" });
        if (error.message === "No seats available") return res.status(400).json({ error: "No seats available" });
        if (error.message === "Already joined this ride") return res.status(409).json({ error: "Already joined this ride" });

        console.error("Error joining ride:", error);
        res.status(500).json({ error: "Failed to join ride" });
    }
}

// 5. Leave a ride
export async function leaveRideHandler(req: Request<{ rideId: string }>, res: Response) {
    try {
        const { rideId } = req.params;
        const userId = (req as any).user.id;

        await db.transaction(async (tx) => {
            // Check if joined
            const existing = await tx
                .select()
                .from(joinRide)
                .where(and(eq(joinRide.rideId, parseInt(rideId)), eq(joinRide.studentId, userId)));

            if (existing.length === 0) {
                throw new Error("Not part of this ride");
            }

            // Leave
            await tx
                .delete(joinRide)
                .where(and(eq(joinRide.rideId, parseInt(rideId)), eq(joinRide.studentId, userId)));

            // Increment seats atomically
            const ride = await tx
                .select()
                .from(rides)
                .where(eq(rides.id, parseInt(rideId)));

            if (ride.length > 0) {
                await tx
                    .update(rides)
                    .set({
                        seatsAvailable: sql`${rides.seatsAvailable} + 1`,
                    })
                    .where(eq(rides.id, parseInt(rideId)));
            }
        });

        return res.status(200).json({ message: "Left ride successfully" });

    } catch (error: any) {
        if (error.message === "Not part of this ride") return res.status(400).json({ error: "Not part of this ride" });
        console.error("Error leaving ride:", error);
        res.status(500).json({ error: "Failed to leave ride" });
    }
}

// 6. Delete a ride
export async function deleteRide(req: Request<{ rideId: string }>, res: Response) {
    try {
        const { rideId } = req.params;
        const userId = (req as any).user.id;

        const ride = await db
            .select()
            .from(rides)
            .where(eq(rides.id, parseInt(rideId)));

        if (ride.length === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }

        if (ride[0].createdBy !== userId) {
            // Strict check: Only the Ride creator can delete this ride.
            return res.status(403).json({ error: "Only the Ride creator can delete this ride" });
        }

        await db.delete(rides).where(eq(rides.id, parseInt(rideId)));

        return res.status(200).json({ message: "Ride deleted successfully" });
    } catch (error) {
        console.error("Error deleting ride:", error);
        res.status(500).json({ error: "Failed to delete ride" });
    }
}
