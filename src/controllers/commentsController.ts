import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
    comments,
    posts,
    createPost,
    subscribe,
    admins,
    belongTo,
    users,
    teams,
} from "../db/schema.ts";
import { eq, and, desc } from "drizzle-orm";
import { awardPoints } from "../utils/badgeUtils.ts";

// 1. Add a comment
export async function addComment(
    req: Request<any, any, { postId: number; content: string; parentId?: number }>,
    res: Response
) {
    try {
        const { postId, content, parentId } = req.body;
        const userId = (req as any).user.id;

        // 1. Check if the post exists and get its teamId
        const [postRecord] = await db
            .select({
                id: posts.id,
                teamId: createPost.teamId,
                leaderId: teams.leaderId
            })
            .from(posts)
            .innerJoin(createPost, eq(posts.id, createPost.postId))
            .innerJoin(teams, eq(teams.id, createPost.teamId))
            .where(eq(posts.id, postId));

        if (!postRecord) {
            return res.status(404).json({ error: "Post not found" });
        }

        const teamId = postRecord.teamId;

        const adminRecord = await db.select().from(admins).where(eq(admins.id, userId));
        const isAdmin = adminRecord.length > 0;

        const isLeader = postRecord.leaderId === userId;
        const membership = await db
                .select()
                .from(belongTo)
                .where(and(eq(belongTo.teamId, teamId), eq(belongTo.studentId, userId)));
        
        // 2. Check if user is subscribed to the team
        const subscription = await db
            .select()
            .from(subscribe)
            .where(
                and(
                    eq(subscribe.userId, userId),
                    eq(subscribe.teamId, teamId)
                )
            );

        // if (subscription.length === 0) {
        //     return res.status(403).json({ error: "You must be subscribed to the team to comment." });
        // }
        const canComment =
            isAdmin ||
            isLeader ||
            membership.some((m) => m.role === "organizer" || m.role === "mediaTeam")||
            subscription.length > 0;

        if (!canComment) {
            return res.status(403).json({
                error: "Only team leaders, organizers, media team, or admins can post in this team",
            });
        }

        // 3. Create the comment
        const [newComment] = await db
            .insert(comments)
            .values({
                content,
                postId,
                author: userId,
                parentId: parentId || null,
            })
            .returning();

            

        // Award points for creating a comment (5 points)
        if (postRecord.teamId) {
            await awardPoints(userId, postRecord.teamId, 5);
        }

        return res.status(201).json({
            message: "Comment added successfully",
            comment: newComment,
        });
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ error: "Failed to add comment" });
    }
}

// Add a reply to an existing comment (parentId comes from route param or body)
export async function addReply(
    req: Request<{ commentId: string }, any, { content: string; postId?: number }>,
    res: Response
) {
    try {
        const { content, postId: bodyPostId } = req.body;
        const parentId = parseInt(req.params.commentId);
        const userId = (req as any).user.id;

        // Ensure parent comment exists
        const parentComment = await db
            .select()
            .from(comments)
            .where(eq(comments.id, parentId));

        if (parentComment.length === 0) {
            return res.status(404).json({ error: "Parent comment not found" });
        }

        // Determine the postId (either provided or from parent)
        const postId = bodyPostId ?? parentComment[0].postId;

        // Reuse permission checks similar to addComment
        const [postRecord] = await db
            .select({
                id: posts.id,
                teamId: createPost.teamId,
                leaderId: teams.leaderId,
            })
            .from(posts)
            .innerJoin(createPost, eq(posts.id, createPost.postId))
            .innerJoin(teams, eq(teams.id, createPost.teamId))
            .where(eq(posts.id, postId));

        if (!postRecord) {
            return res.status(404).json({ error: "Post not found" });
        }

        const teamId = postRecord.teamId;

        const adminRecord = await db.select().from(admins).where(eq(admins.id, userId));
        const isAdmin = adminRecord.length > 0;

        const isLeader = postRecord.leaderId === userId;
        const membership = await db
            .select()
            .from(belongTo)
            .where(and(eq(belongTo.teamId, teamId), eq(belongTo.studentId, userId)));

        const subscription = await db
            .select()
            .from(subscribe)
            .where(and(eq(subscribe.userId, userId), eq(subscribe.teamId, teamId)));

        const canComment =
            isAdmin ||
            isLeader ||
            membership.some((m) => m.role === "organizer" || m.role === "mediaTeam") ||
            subscription.length > 0;

        if (!canComment) {
            return res.status(403).json({ error: "Only team leaders, organizers, media team, or admins can post in this team" });
        }

        // Create the reply (as a comment with parentId)
        const [newComment] = await db
            .insert(comments)
            .values({
                content,
                postId,
                author: userId,
                parentId: parentId,
            })
            .returning();

        if (postRecord.teamId) {
            await awardPoints(userId, postRecord.teamId, 5);
        }

        return res.status(201).json({ message: "Reply added successfully", comment: newComment });
    } catch (error) {
        console.error("Error adding reply:", error);
        res.status(500).json({ error: "Failed to add reply" });
    }
}

// Get direct replies for a comment
export async function getCommentReplies(req: Request<{ commentId: string }>, res: Response) {
    try {
        const { commentId } = req.params;

        const replies = await db
            .select()
            .from(comments)
            .where(eq(comments.parentId, parseInt(commentId)))
            .orderBy(desc(comments.issuedAt));

        return res.status(200).json({ message: "Replies retrieved successfully", replies });
    } catch (error) {
        console.error("Error fetching replies:", error);
        res.status(500).json({ error: "Failed to fetch replies" });
    }
}

// 2. Get comments for a post
export async function getPostComments(req: Request<{ postId: string }>, res: Response) {
    try {
        const { postId } = req.params;

        const allComments = await db
            .select()
            .from(comments)
            .where(eq(comments.postId, parseInt(postId)))
            .orderBy(desc(comments.issuedAt));

        // Note: The frontend will likely handle the nesting of replies based on 'parentId'

        return res.status(200).json({
            message: "Comments retrieved successfully",
            comments: allComments,
        });
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ error: "Failed to fetch comments" });
    }
}

// 3. Delete a comment
export async function deleteComment(req: Request<{ commentId: string }>, res: Response) {
    try {
        const { commentId } = req.params;
        const userId = (req as any).user.id;

        const commentRecord = await db
            .select()
            .from(comments)
            .where(eq(comments.id, parseInt(commentId)));

        if (commentRecord.length === 0) {
            return res.status(404).json({ error: "Comment not found" });
        }

        // We need the Post's details to check for Media Role permissions (if we were using it)
        const postRecord = await db
            .select({
                teamId: createPost.teamId
            })
            .from(createPost)
            .where(eq(createPost.postId, commentRecord[0].postId));

        if (postRecord.length === 0) {
            // Should not happen if data integrity is good
            return res.status(404).json({ error: "Associated post not found" });
        }

        const teamId = postRecord[0].teamId;

        // Permission Check Flow:

        // 1. Author?
        if (commentRecord[0].author === userId) {
            await db.delete(comments).where(eq(comments.id, parseInt(commentId)));
            return res.status(200).json({ message: "Comment deleted successfully" });
        } else {
            // 2. Admin?
            const adminRecord = await db
                .select()
                .from(admins)
                .where(eq(admins.id, userId));

            if (adminRecord.length > 0) {
                await db.delete(comments).where(eq(comments.id, parseInt(commentId)));
                return res.status(200).json({ message: "Comment deleted successfully" });
            } else {
                // 3. Media Role? (COMMENTED OUT)
                /*
                const teamRole = await db
                    .select()
                    .from(belongTo)
                    .where(
                        and(
                            eq(belongTo.studentId, userId),
                            eq(belongTo.teamId, teamId),
                            eq(belongTo.role, "media")
                        )
                    );
                
                if (teamRole.length > 0) {
                    await db.delete(comments).where(eq(comments.id, parseInt(commentId)));
                    return res.status(200).json({ message: "Comment deleted successfully" });
                } else {
                     return res.status(403).json({ error: "Unauthorized to delete this comment" });
                }
                */

                // Default Deny
                return res.status(403).json({ error: "Unauthorized to delete this comment" });
            }
        }
    } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ error: "Failed to delete comment" });
    }
}

// 4. Edit a comment (Author only)
export async function editComment(req: Request<{ commentId: string }>, res: Response) {
    try {
        const { commentId } = req.params;
        const { content } = req.body;
        const userId = (req as any).user.id;

        // Get comment to check author
        const commentRecord = await db
            .select()
            .from(comments)
            .where(eq(comments.id, parseInt(commentId)));

        if (commentRecord.length === 0) {
            return res.status(404).json({ error: "Comment not found" });
        }

        // Check if user is the author
        if (commentRecord[0].author !== userId) {
            return res.status(403).json({ error: "Only the author can edit this comment" });
        }

        // Update comment content
        await db
            .update(comments)
            .set({ content })
            .where(eq(comments.id, parseInt(commentId)));

        return res.status(200).json({
            message: "Comment updated successfully",
        });
    } catch (error) {
        console.error("Error editing comment:", error);
        res.status(500).json({ error: "Failed to edit comment" });
    }
}

// 5. Get comment by ID
export async function getCommentById(req: Request<{ commentId: string }>, res: Response) {
    try {
        const { commentId } = req.params;

        const commentData = await db
            .select({
                id: comments.id,
                content: comments.content,
                issuedAt: comments.issuedAt,
                parentId: comments.parentId,
                author: {
                    id: users.id,
                    fname: users.fname,
                    lname: users.lname,
                    imgUrl: users.imgUrl,
                },
            })
            .from(comments)
            .leftJoin(users, eq(comments.author, users.id))
            .where(eq(comments.id, parseInt(commentId)));

        if (commentData.length === 0) {
            return res.status(404).json({ error: "Comment not found" });
        }

        return res.status(200).json({
            message: "Comment retrieved successfully",
            comment: commentData[0],
        });
    } catch (error) {
        console.error("Error fetching comment:", error);
        res.status(500).json({ error: "Failed to fetch comment" });
    }
}
