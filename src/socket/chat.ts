import { Server, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import db from "../db/connection.ts";
import env from "../../env.ts";
import { messages, users } from "../db/schema.ts";
import { eq, or, and, desc } from "drizzle-orm";
import { verify } from "crypto";
import { verifyToken } from "../utils/jwt.ts";
import type { jwtPayLoad } from "../utils/jwt.ts";

// Extend Socket interface to include userId
interface AuthenticatedSocket extends Socket {
  userId?: number;
}

// Store connected users: userId -> socketId
const connectedUsers = new Map<number, string>();

export function initializeSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: [env.FRONTEND_URL, "http://localhost:5173"],
      credentials: true,
    },
  });

  // Middleware to authenticate socket connection
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    // Token verification happens in the client by sending it in handshake
    try {
      const payload = await verifyToken(token as string);
      (socket as any).userId = payload.id;
    } catch (err) {
      console.error("Socket authentication failed:", err);
      return next(new Error("Authentication failed"));
    }
    next();
  });

  io.on("connection", (socket: any) => {
    console.log("User connected:", socket.id, "userId:", socket.userId);

    if (socket.userId) {
      connectedUsers.set(socket.userId, socket.id);
      io.emit("user_online", {
        userId: socket.userId,
        status: "online",
      });
    }

    // ===== 1-on-1 Chat Events =====

    /**
     * Event: send_message
     * Sends a message to a specific user (1-on-1 chat)
     */
    socket.on(
      "send_message",
      async (data: { receiverId: number; content: string }, callback) => {
        try {
          const senderId = socket.userId;
          if (!senderId) {
            callback({ error: "Not authenticated" });
            return;
          }

          // Save message to database
          const [inserted] = await db
            .insert(messages)
            .values({
              senderId,
              receiverId: data.receiverId,
              content: data.content,
              sentAt: new Date().toISOString(),
            })
            .returning({ msgId: messages.msgId });

          const msgId = inserted.msgId;

          // Emit message to receiver if online
          const receiverSocketId = connectedUsers.get(data.receiverId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("receive_message", {
              msgId,
              senderId,
              senderName: socket.handshake.auth.senderName || "Unknown",
              content: data.content,
              sentAt: new Date().toISOString(),
              isOnline: true,
            });
          }

          // Acknowledge to sender
          callback({
            success: true,
            msgId,
            sentAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error sending message:", error);
          callback({ error: "Failed to send message" });
        }
      }
    );

    /**
     * Event: typing
     * Notify receiver when sender is typing
     */
    socket.on("typing", (data: { receiverId: number; isTyping: boolean }) => {
      const receiverSocketId = connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("user_typing", {
          senderId: socket.userId,
          isTyping: data.isTyping,
        });
      }
    });

    /**
     * Event: mark_as_read
     * Mark messages as read
     */
    socket.on(
      "mark_as_read",
      async (data: { senderId: number; messageIds: number[] }) => {
        try {
          // You can add a 'read' column to messages table if needed
          // For now, just emit acknowledgment
          const senderSocketId = connectedUsers.get(data.senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit("messages_read", {
              readBy: socket.userId,
              messageIds: data.messageIds,
            });
          }
        } catch (error) {
          console.error("Error marking as read:", error);
        }
      }
    );

    /**
     * Event: mark_messages_as_seen
     * Mark messages from a specific user as seen
     */
    socket.on(
      "mark_messages_as_seen",
      async (data: { otherUserId: number }) => {
        try {
          const userId = socket.userId;
          if (!userId) return;

          // Update all messages from otherUserId to userId to seen=true
          await db
            .update(messages)
            .set({ seen: true })
            .where(
              and(
                eq(messages.senderId, data.otherUserId),
                eq(messages.receiverId, userId),
                eq(messages.seen, false)
              )
            );

          // Notify the other user that their messages were seen
          const otherUserSocketId = connectedUsers.get(data.otherUserId);
          if (otherUserSocketId) {
            io.to(otherUserSocketId).emit("messages_seen", {
              seenBy: userId,
              otherUserId: data.otherUserId,
            });
          }
        } catch (error) {
          console.error("Error marking messages as seen:", error);
        }
      }
    );

    /**
     * Event: get_chat_history
     * Fetch message history between two users
     */
    socket.on(
      "get_chat_history",
      async (data: { otherUserId: number; limit?: number }, callback) => {
        try {
          const userId = socket.userId;
          if (!userId) {
            callback({ error: "Not authenticated" });
            return;
          }

          const limit = data.limit || 50;

          // Fetch messages between current user and other user
          const chatHistory = await db
            .select()
            .from(messages)
            .where(
              or(
                and(
                  eq(messages.senderId, userId),
                  eq(messages.receiverId, data.otherUserId)
                ),
                and(
                  eq(messages.senderId, data.otherUserId),
                  eq(messages.receiverId, userId)
                )
              )
            )
            .orderBy(desc(messages.sentAt))
            .limit(limit);

          callback({
            success: true,
            messages: chatHistory.reverse(),
          });
        } catch (error) {
          console.error("Error fetching chat history:", error);
          callback({ error: "Failed to fetch chat history" });
        }
      }
    );

    // ===== Group/Team Chat Events (Optional) =====

    /**
     * Event: join_team_chat
     * Join a team's chat room
     */
    socket.on("join_team_chat", (data: { teamId: number }) => {
      const roomName = `team_${data.teamId}`;
      socket.join(roomName);
      console.log(`User ${socket.userId} joined ${roomName}`);

      // Notify team members
      io.to(roomName).emit("user_joined_team", {
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Event: send_team_message
     * Send message to team chat
     */
    socket.on(
      "send_team_message",
      async (data: { teamId: number; content: string }, callback) => {
        try {
          const senderId = socket.userId;
          if (!senderId) {
            callback({ error: "Not authenticated" });
            return;
          }

          const roomName = `team_${data.teamId}`;

          // Save team message to database
          const [inserted] = await db
            .insert(messages)
            .values({
              senderId,
              receiverId: null, // null for team messages
              content: `[TEAM_${data.teamId}] ${data.content}`,
              sentAt: new Date().toISOString(),
            })
            .returning({ msgId: messages.msgId });

          const msgId = inserted.msgId;

          // Broadcast to team
          io.to(roomName).emit("receive_team_message", {
            msgId,
            senderId,
            senderName: socket.handshake.auth.senderName || "Unknown",
            content: data.content,
            teamId: data.teamId,
            sentAt: new Date().toISOString(),
          });

          callback({ success: true, msgId });
        } catch (error) {
          console.error("Error sending team message:", error);
          callback({ error: "Failed to send message" });
        }
      }
    );

    /**
     * Event: leave_team_chat
     * Leave a team's chat room
     */
    socket.on("leave_team_chat", (data: { teamId: number }) => {
      const roomName = `team_${data.teamId}`;
      socket.leave(roomName);
      console.log(`User ${socket.userId} left ${roomName}`);

      io.to(roomName).emit("user_left_team", {
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });

    // ===== Disconnect Event =====

    socket.on("disconnect", () => {
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        io.emit("user_offline", {
          userId: socket.userId,
          status: "offline",
        });
      }
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
}

export { connectedUsers };
