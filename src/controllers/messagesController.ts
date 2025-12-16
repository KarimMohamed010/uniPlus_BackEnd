import type { Request, Response } from "express";
import db from "../db/connection.ts";
import { messages, users } from "../db/schema.ts";
import { eq, and, or, desc, sql } from "drizzle-orm";

export async function getNotifications(req: Request, res: Response) {
  // Get unread messages with user info and grouped by conversation
  try {
    const studentId = (req as any).user.id;

    const unreadMessages = await db
      .select({
        msgId: messages.msgId,
        content: messages.content,
        sentAt: messages.sentAt,
        senderId: messages.senderId,
        receiverId: messages.receiverId,
        fname: users.fname,
        lname: users.lname,
        username: users.username,
        imgUrl: users.imgUrl,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(and(eq(messages.receiverId, studentId), eq(messages.seen, false)))
      .orderBy(desc(messages.sentAt));

    return res.status(200).json({
      message: "Notifications retrieved",
      notifications: unreadMessages,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    res.status(500).json({ error: "Failed to retrieve notifications" });
  }
}

export async function getRecievedMessages(req: Request, res: Response) {
  try {
    const studentId = (req as any).user.id;

    // Get all conversations (received messages) grouped by sender with last message
    const receivedMessages = await db
      .select({
        userId: messages.senderId,
        fname: users.fname,
        lname: users.lname,
        username: users.username,
        imgUrl: users.imgUrl,
        lastMessage: messages.content,
        lastMessageTime: messages.sentAt,
        seen: messages.seen,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.receiverId, studentId))
      .orderBy(desc(messages.sentAt));

    // Remove duplicates, keeping the most recent message per user
    const conversationMap = new Map();
    receivedMessages.forEach((msg) => {
      if (!conversationMap.has(msg.userId)) {
        conversationMap.set(msg.userId, msg);
      }
    });

    const conversations = Array.from(conversationMap.values()).sort(
      (a, b) =>
        new Date(b.lastMessageTime || 0).getTime() -
        new Date(a.lastMessageTime || 0).getTime()
    );

    return res.status(200).json({
      message: "Received Messages retrieved",
      notifications: conversations,
    });
  } catch (error) {
    console.error("Error retrieving received messages:", error);
    res.status(500).json({ error: "Failed to retrieve recieved messages" });
  }
}

export async function getSentMessages(req: Request, res: Response) {
  try {
    const studentId = (req as any).user.id;

    // Get all conversations (sent messages) grouped by receiver with last message
    const sentMessages = await db
      .select({
        userId: messages.receiverId,
        fname: users.fname,
        lname: users.lname,
        username: users.username,
        imgUrl: users.imgUrl,
        lastMessage: messages.content,
        lastMessageTime: messages.sentAt,
        seen: messages.seen,
      })
      .from(messages)
      .innerJoin(users, eq(messages.receiverId, users.id))
      .where(eq(messages.senderId, studentId))
      .orderBy(desc(messages.sentAt));

    // Remove duplicates, keeping the most recent message per user
    const conversationMap = new Map();
    sentMessages.forEach((msg) => {
      if (!conversationMap.has(msg.userId)) {
        conversationMap.set(msg.userId, msg);
      }
    });

    const conversations = Array.from(conversationMap.values()).sort(
      (a, b) =>
        new Date(b.lastMessageTime || 0).getTime() -
        new Date(a.lastMessageTime || 0).getTime()
    );

    return res.status(200).json({
      message: "Sent Messages retrieved",
      notifications: conversations,
    });
  } catch (error) {
    console.error("Error retrieving sent messages:", error);
    res.status(500).json({ error: "Failed to retrieve sent messages" });
  }
}

export async function sendMessage(
  req: Request<any, any, { receiverId: number; content: string }>,
  res: Response
) {
  try {
    const { receiverId, content } = req.body;
    const senderId = (req as any).user.id;

    await db.insert(messages).values({
      senderId,
      receiverId,
      content,
      sentAt: new Date().toISOString(),
    });

    return res.status(201).json({
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
}


