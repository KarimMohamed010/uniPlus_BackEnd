import z, { email } from "zod";
import env from "../../env.ts";
import bcrypt from "bcrypt";
import db from "../db/connection.ts";
import { generateToken } from "../utils/jwt.ts";
import { users, students, admins, belongTo } from "../db/schema.ts";
import type { messages, NewUser, User } from "../db/schema.ts";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { hashPassword } from "../utils/password.ts";
import { DrizzleQueryError } from "drizzle-orm";
import type { errorMonitor } from "events";

export async function signUp(req: Request<any, any, NewUser>, res: Response) {
  try {
    const userData = req.body;

    const hashedPass = await hashPassword(userData.userPassword);

    // Create user as student
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        userPassword: hashedPass,
      })
      .returning({
        id: users.id,
        email: users.email,
        fname: users.fname,
        lname: users.lname,
        username: users.username,
      });

    // Always create as student
    await db.insert(students).values({ id: user.id });

    const token = await generateToken({
      id: user.id,
      email: user.email,
      roles: {
        global: "student",
        team: [],
      },
    });

    return res.status(201).json({
      message: "User Created Successfully",
      user: {
        id: user.id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        roles: {
          global: "student",
          team: [],
        },
      },
      token,
    });
  } catch (error) {
    console.log("Registration error:", error);
    // Check if email already exists
    if ((error as any).cause.code === "23505") {
      if (/email/i.test(error.cause.constraint)) {
        return res.status(409).json({ error: "Email already exists" });
      }
      if (/username/i.test(error.cause.constraint)) {
        return res.status(409).json({ error: "Username already exists" });
      }
    }
    res.status(500).json({ error: "Failed to create user" });
  }
}

export async function signIn(
  req: Request<any, any, { email: string; userPassword: string }>,
  res: Response
) {
  try {
    const { email: userEmail, userPassword: providedPassword } = req.body;

    // Find user by email
    const foundUsers = await db
      .select({
        id: users.id,
        email: users.email,
        fname: users.fname,
        lname: users.lname,
        username: users.username,
        userPassword: users.userPassword,
      })
      .from(users)
      .where(eq(users.email, userEmail));

    if (foundUsers.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = foundUsers[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(
      providedPassword,
      user.userPassword
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Determine global role (student or admin)
    const studentCheck = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.id, user.id));

    const adminCheck = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.id, user.id));

    let globalRole: "student" | "admin" = "student"; // default
    if (adminCheck.length > 0) {
      globalRole = "admin";
    } else if (studentCheck.length > 0) {
      globalRole = "student";
    }

    // Fetch all team roles for this user
    const teamRoles = await db
      .select({
        teamId: belongTo.teamId,
        role: belongTo.role,
      })
      .from(belongTo)
      .where(eq(belongTo.studentId, user.id));

    const token = await generateToken({
      id: user.id,
      email: user.email,
      roles: {
        global: globalRole,
        team: teamRoles,
      },
    });

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        roles: {
          global: globalRole,
          team: teamRoles,
        },
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
}
