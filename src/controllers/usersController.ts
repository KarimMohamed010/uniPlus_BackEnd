import db from "../db/connection.ts";
import { users } from "../db/schema.ts";
import type { Request, Response } from "express";
import { eq, ilike, or, sql } from "drizzle-orm";
import { hashPassword } from "../utils/password.ts";
import bcrypt from "bcrypt";

export async function getUserByUsername(
  req: Request<{ username: string }, any, any>,
  res: Response
) {
  try {
    const { username } = req.params;

    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username is required" });
    }

    const user = await db
      .select({
        id: users.id,
        username: users.username,
        fname: users.fname,
        lname: users.lname,
        bio: users.bio,
        imgUrl: users.imgUrl,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      message: "User found",
      user: user[0],
    });
  } catch (error) {
    console.error("Error searching user:", error);
    res.status(500).json({ error: "Failed to search user" });
  }
}



export async function getUserById(
  req: Request<{ id: string }, any, any>,
  res: Response
) {
  try {
    const { id } = req.params;

    // 1. Basic validation and type conversion
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // 2. Database Query
    const user = await db
      .select({
        id: users.id,
        username: users.username,
        fname: users.fname,
        lname: users.lname,
        bio: users.bio,
        imgUrl: users.imgUrl,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // 3. Check result
    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // 4. Success response
    return res.status(200).json({
      message: "User found by ID",
      user: user[0],
    });
  } catch (error) {
    console.error("Error retrieving user by ID:", error);
    res.status(500).json({ error: "Failed to retrieve user by ID" });
  }
}

export async function searchUsers(req: Request, res: Response) {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }

    // ilike for case-insensitive matching
    const results = await db
      .select({
        id: users.id,
        fname: users.fname,
        lname: users.lname,
        username: users.username,
        imgUrl: users.imgUrl,
      })
      .from(users)
      .where(
        or(
          ilike(users.fname, `%${query}%`),
          ilike(users.lname, `%${query}%`),
          ilike(users.username, `%${query}%`),
          sql`concat(${users.fname}, ' ', ${users.lname}) ILIKE ${`%${query}%`}`
        )
      )
      .limit(10);

    return res.status(200).json({ users: results });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
}

export async function changePassword(
  req: Request<{}, any, { currentPassword: string; newPassword: string }>,
  res: Response
) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).user.id; // From auth middleware

    // Get user from database
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user[0].userPassword
    );

    if (!passwordMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await db
      .update(users)
      .set({ userPassword: hashedPassword })
      .where(eq(users.id, userId));

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
}

export async function updateProfilePic(
  req: Request<{}, any, { bio: string; imgUrl: string }>,
  res: Response
) {
  try {
    const { imgUrl } = req.body;
    const userId = (req as any).user.id; // From auth middleware

    console.log("updateProfilePic called with:", { userId, imgUrl });

    if (imgUrl === undefined) {
      return res
        .status(400)
        .json({ error: "Image URL is required" });
    }

    // Update profile in database
    const result = await db
      .update(users)
      .set({ imgUrl: imgUrl })
      .where(eq(users.id, userId));

    console.log("Update result:", result);

    return res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

export async function updateProfile(
  req: Request,
  res: Response
) {
  try {
    const userData = req.body;
    const userId = (req as any).user.id; // From auth middleware

    console.log("updateProfile called with:", { userId, userData });

    // Update profile in database
    const [user] = await db
      .update(users)
      .set({ ...userData })
      .where(eq(users.id, userId)).returning({
        id: users.id,
        email: users.email,
        fname: users.fname,
        lname: users.lname,
        username: users.username,
        bio: users.bio,
      });

    console.log("Update result:", user);

    return res.status(200).json({
      message: "Profile updated successfully", user: {
        id: user.id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        username: user.username,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    if ((error as any).cause.code === "23505") {
      if (/email/i.test(error.cause.constraint)) {
        return res.status(409).json({ error: "Email already exists" });
      }
      if (/username/i.test(error.cause.constraint)) {
        return res.status(409).json({ error: "Username already exists" });
      }
    }
    res.status(500).json({ error: "Failed to update profile" });
  }
}


