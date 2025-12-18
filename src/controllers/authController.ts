import bcrypt from "bcrypt";
import db from "../db/connection.ts";
import { generateToken } from "../utils/jwt.ts";
import { users, students, admins, belongTo, teams } from "../db/schema.ts";
import type { NewUser } from "../db/schema.ts";
import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "../utils/password.ts";
import { sendEmailVerificationCode } from "../utils/mailer.ts";
import {
  assertEmailVerifiedForSignup,
  consumeEmailVerification,
  requestEmailVerification,
  verifyEmailCode,
} from "../utils/emailVerification.ts";

export async function sendVerificationCode(
  req: Request<any, any, { email: string }>,
  res: Response
) {
  try {
    const email = req.body.email.toLowerCase().trim();
    const result = requestEmailVerification(email);

    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }

    await sendEmailVerificationCode(email, result.code);
    return res.status(200).json({
      message: "Verification code sent",
      verificationId: result.verificationId,
    });
  } catch (error) {
    console.error("Send verification code error:", error);
    return res.status(500).json({ error: "Failed to send verification code" });
  }
}

export async function verifyVerificationCode(
  req: Request<any, any, { email: string; verificationId: string; code: string }>,
  res: Response
) {
  try {
    const result = verifyEmailCode({
      email: req.body.email,
      verificationId: req.body.verificationId,
      code: req.body.code,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({ message: "Email verified" });
  } catch (error) {
    console.error("Verify code error:", error);
    return res.status(500).json({ error: "Failed to verify code" });
  }
}

export async function signUp(
  req: Request<any, any, NewUser & { verificationId: string }>,
  res: Response
) {
  try {
    const { verificationId, ...userData } = req.body;
    userData.email = userData.email.toLowerCase();

    const verified = assertEmailVerifiedForSignup({
      verificationId,
      email: userData.email,
    });

    if (!verified.ok) {
      return res.status(verified.status).json({ error: verified.error });
    }

    const hashedPass = await hashPassword(userData.userPassword);

    // Create user as student

    const user = await db.transaction(async (tx) => {
      const [result] = await tx
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
          imgUrl: users.imgUrl,
          username: users.username,
          bio: users.bio,
        });

      // Always create as student
      await tx.insert(students).values({ id: result.id });
      return result;
    });
    const token = await generateToken({
      id: user.id,
      email: user.email,
      roles: {
        global: "student",
        team: [],
      },
    });

    consumeEmailVerification(verificationId);

    return res.status(201).json({
      message: "User Created Successfully",
      user: {
        id: user.id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        imgUrl: user.imgUrl,
        username: user.username,
        bio: user.bio,
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
    let { email: userEmail, userPassword: providedPassword } = req.body;
    userEmail = userEmail.toLowerCase();
    // Find user by email
    const foundUsers = await db
      .select({
        id: users.id,
        email: users.email,
        fname: users.fname,
        lname: users.lname,
        username: users.username,
        imgUrl: users.imgUrl,
        userPassword: users.userPassword,
        bio: users.bio,
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

    const result = await db
      .select({
        teamId: teams.id,
        role: sql<string>`'leader'`,
      })
      .from(teams)
      .where(eq(teams.leaderId, user.id));

    teamRoles.push(...result);
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
        imgUrl: user.imgUrl,
        username: user.username,
        bio: user.bio,
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
