import db from "../db/connection.ts";
import { users } from "../db/schema.ts";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";


export async function usersController() {
  const uploadProfilePic = async (req, res) => {
    const { cdnUrl } = req.body;
    await db
      .insert(users)
      .values({ ...req.body, imgUrl: cdnUrl })
      .returning({
        id: users.id,
        email: users.email,
        fname: users.fname,
        lname: users.lname,
        imgUrl: users.imgUrl,
      });
    return res.status(200).json({
      message: "Done added to db",
    });
  };
}


export async function getUserByUsername(
  req: Request<{username : string}, any, any>,
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
