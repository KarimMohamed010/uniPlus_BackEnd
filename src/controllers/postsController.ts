import type { Request, Response } from "express";
import db from "../db/connection.ts";
import {
    posts,
    createPost,
    postmedia,
    users,
    teams,
    admins,
    belongTo,
    subscribe,
    reports,
    students,
} from "../db/schema.ts";
import { eq, or, desc, and, sql, count } from "drizzle-orm";
import { awardPoints } from "../utils/badgeUtils.ts";


// 1. Create a new post
export async function createPostHandler(
    req: Request<any, any, { description: string; teamId: number; media?: { url: string; type: string; description?: string }[] }>,
    res: Response
) {
    try {
        const { description, teamId, media } = req.body;
        const userId = (req as any).user.id;

        const teamRecord = await db.select().from(teams).where(eq(teams.id, teamId));
        if (teamRecord.length === 0) {
            return res.status(404).json({ error: "Team not found" });
        }

        const adminRecord = await db.select().from(admins).where(eq(admins.id, userId));
        const isAdmin = adminRecord.length > 0;

        const isLeader = teamRecord[0].leaderId === userId;

        const membership = await db
            .select()
            .from(belongTo)
            .where(and(eq(belongTo.teamId, teamId), eq(belongTo.studentId, userId)));

        const subscribers = await db
            .select()
            .from(subscribe)
            .where(and(eq(subscribe.teamId, teamId), eq(subscribe.userId, userId)));

        const canPost =
            isAdmin ||
            isLeader ||
            membership.length > 0 ||
            subscribers.length > 0;

        if (!canPost) {
            return res.status(403).json({
                error: "Only team leaders, organizers, media team, or admins can post in this team",
            });
        }

        // 1. Create the post entry
        const [newPost] = await db
            .insert(posts)
            .values({
                description,
            })
            .returning();

        // 2. Link post to user and team
        await db.insert(createPost).values({
            postId: newPost.id,
            userId,
            teamId,
        });

        // 3. Add media if present
        if (media && media.length > 0) {
            const mediaValues = media.map((item, index) => ({
                id: index + 1, //to make the media ID is 1,2,3... for each post and the ID value is according to there order of media while uploading
                postId: newPost.id,
                url: item.url,
                type: item.type,
                description: item.description,
            }));

            await db.insert(postmedia).values(mediaValues);
        }

        // Award points for creating a post (10 points)
        // Note: awardPoints checks eligibility internally
        await awardPoints(userId, teamId, 10);

        return res.status(201).json({
            message: "Post created successfully",
            post: newPost,
        });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ error: "Failed to create post" });
    }
}

// 2. Get all posts (Discover)
export async function getAllPosts(req: Request, res: Response) {
    try {
        // This query joins posts with their creators, teams, and media
        // We use a raw SQL aggregation for media to get a clean JSON structure per post

        const postsData = await db
            .select({
                id: posts.id,
                description: posts.description,
                issuedAt: posts.issuedAt,
                author: {
                    id: users.id,
                    fname: users.fname,
                    lname: users.lname,
                    imgUrl: users.imgUrl,
                },
                team: {
                    id: teams.id,
                    name: teams.name,
                },
                // returning the media
                media: sql`COALESCE(
          json_agg(
 
            json_build_object(
              'url', ${postmedia.url}, 
              'type', ${postmedia.type},
              'description', ${postmedia.description}
            )
    
          ) FILTER (WHERE ${postmedia.url} IS NOT NULL), 
          '[]'
        )`,
            })
            .from(posts)
            .innerJoin(createPost, eq(posts.id, createPost.postId))// to link the post with the author and the team
            .innerJoin(users, eq(createPost.userId, users.id))// to get the author of the post
            .innerJoin(teams, eq(createPost.teamId, teams.id))// to get the team of the post
            .leftJoin(postmedia, eq(posts.id, postmedia.postId))// to get the media of the post
            .groupBy(posts.id, users.id, teams.id)
            .orderBy(desc(posts.issuedAt));

        return res.status(200).json({
            message: "Posts retrieved successfully",
            posts: postsData,
        });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ error: "Failed to fetch posts" });
    }
}

// 3. Get User Feed (Subscribed Teams Only)
// export async function getUserFeed(req: Request, res: Response) {
//     try {
//         const userId = (req as any).user.id;

//         const postsData = await db
//             .select({
//                 id: posts.id,
//                 description: posts.description,
//                 issuedAt: posts.issuedAt,
//                 author: {
//                     id: users.id,
//                     fname: users.fname,
//                     lname: users.lname,
//                     imgUrl: users.imgUrl,
//                 },
//                 team: {
//                     id: teams.id,
//                     name: teams.name,
//                 },
//                 media: sql`COALESCE(
//           json_agg(
//             json_build_object(
//               'url', ${postmedia.url}, 
//               'type', ${postmedia.type},
//               'description', ${postmedia.description}
//             )
//           ) FILTER (WHERE ${postmedia.url} IS NOT NULL), 
//           '[]'
//         )`,
//             })
//             .from(posts)
//             .innerJoin(createPost, eq(posts.id, createPost.postId))// to link the post with the author and the team
//             .innerJoin(users, eq(createPost.userId, users.id))// to get the author of the post
//             .innerJoin(teams, eq(createPost.teamId, teams.id))// to get the team of the post
//             .innerJoin(subscribe, and(
//                 eq(subscribe.teamId, createPost.teamId),
//                 eq(subscribe.userId, userId)
//             ))// to check if the user is subscribed to the team
//             .leftJoin(postmedia, eq(posts.id, postmedia.postId))// to get the media of the post
//             .groupBy(posts.id, users.id, teams.id)
//             .orderBy(desc(posts.issuedAt));

//         return res.status(200).json({
//             message: "User feed retrieved successfully",
//             posts: postsData,
//         });
//     } catch (error) {
//         console.error("Error fetching user feed:", error);
//         res.status(500).json({ error: "Failed to fetch user feed" });
//     }
// }
export async function getUserFeed(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;

        const postsData = await db
            .select({
                id: posts.id,
                description: posts.description,
                issuedAt: posts.issuedAt,
                author: {
                    id: users.id,
                    fname: users.fname,
                    lname: users.lname,
                    imgUrl: users.imgUrl,
                },
                team: {
                    id: teams.id,
                    name: teams.name,
                },
                media: sql`COALESCE(
                    json_agg(
                        json_build_object(
                            'url', ${postmedia.url}, 
                            'type', ${postmedia.type},
                            'description', ${postmedia.description}
                        )
                    ) FILTER (WHERE ${postmedia.url} IS NOT NULL), 
                    '[]'
                )`,
            })
            .from(posts)
            .innerJoin(createPost, eq(posts.id, createPost.postId))
            .innerJoin(users, eq(createPost.userId, users.id))
            .innerJoin(teams, eq(createPost.teamId, teams.id))
            // Left joins for membership/subscription to avoid filtering out posts 
            // before we check the "OR" condition
            .leftJoin(subscribe, eq(subscribe.teamId, teams.id))
            .leftJoin(belongTo, eq(belongTo.teamId, teams.id))
            .leftJoin(postmedia, eq(posts.id, postmedia.postId))
            .where(
                or(
                    // 1. User is the Leader of the team
                    eq(teams.leaderId, userId),
                    // 2. User is a Member (belong to)
                    eq(belongTo.studentId, userId),
                    // 3. User is Subscribed
                    eq(subscribe.userId, userId)
                )
            )
            .groupBy(posts.id, users.id, teams.id)
            .orderBy(desc(posts.issuedAt));

        return res.status(200).json({
            message: "User feed retrieved successfully",
            posts: postsData,
        });
    } catch (error) {
        console.error("Error fetching user feed:", error);
        res.status(500).json({ error: "Failed to fetch user feed" });
    }
}

// 4. Get posts for a specific team
export async function getTeamPosts(req: Request<{ teamId: string }>, res: Response) {
    try {
        const { teamId } = req.params;

        const postsData = await db
            .select({
                id: posts.id,
                description: posts.description,
                issuedAt: posts.issuedAt,
                author: {
                    id: users.id,
                    fname: users.fname,
                    lname: users.lname,
                    imgUrl: users.imgUrl,
                },
                media: sql`COALESCE(
          json_agg(
            json_build_object(
              'url', ${postmedia.url}, 
              'type', ${postmedia.type},
              'description', ${postmedia.description}
            )
          ) FILTER (WHERE ${postmedia.url} IS NOT NULL), 
          '[]'
        )`,
            })
            .from(posts)
            .innerJoin(createPost, eq(posts.id, createPost.postId))
            .innerJoin(users, eq(createPost.userId, users.id))
            .leftJoin(postmedia, eq(posts.id, postmedia.postId))
            .where(eq(createPost.teamId, parseInt(teamId)))
            .groupBy(posts.id, users.id)
            .orderBy(desc(posts.issuedAt));

        return res.status(200).json({
            message: "Team posts retrieved successfully",
            posts: postsData,
        });
    } catch (error) {
        console.error("Error fetching team posts:", error);
        res.status(500).json({ error: "Failed to fetch team posts" });
    }
}

// 5. Delete a post
export async function deletePost(req: Request<{ postId: string }>, res: Response) {
    try {
        const { postId } = req.params;
        const userId = (req as any).user.id;

        // First check ownership or admin status (or media role -- if needed)
        // For simplicity, we'll check if the user is the one who created it
        // In a real app, you'd also check if user is an admin or team leader

        const [postRecord] = await db
            .select({
                postId: createPost.postId,
                authorId: createPost.userId,
                teamId: createPost.teamId,
                leaderId: teams.leaderId
            })
            .from(createPost)
            .innerJoin(teams, eq(teams.id, createPost.teamId))
            .where(eq(createPost.postId, parseInt(postId)));

        if (!postRecord) {
            return res.status(404).json({ error: "Post not found" });
        }

        // 1. Check if user is the Author
        const isAuthor = postRecord.authorId === userId;
        const isLeader = postRecord.leaderId === userId;

        // 2. Check if user is an Admin
        const adminRecord = await db
            .select()
            .from(admins)
            .where(eq(admins.id, userId));
        const isAdmin = adminRecord.length > 0;

        // 3. Check if user has "mediaTeam" role in the team
        const teamRole = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, postRecord.teamId),
                    eq(belongTo.role, "mediaTeam")
                )
            );
        const isMedia = teamRole.length > 0;

        if (!isAuthor && !isAdmin && !isMedia&& !isLeader) {
            return res.status(403).json({ error: "Unauthorized to delete this post" });
        }

        // Delete the post (Cascading deletes in DB should handle relations)
        await db.delete(posts).where(eq(posts.id, parseInt(postId)));

        return res.status(200).json({
            message: "Post deleted successfully",
            postId,
        });
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ error: "Failed to delete post" });
    }
}

// 6. Report a post
// export async function reportPost(req: Request<{ postId: string }>, res: Response) {
//     try {
//         const { postId } = req.params;
//         const { description } = req.body;
//         const userId = (req as any).user.id;

//         // 1. Check if user is a student (not admin)
//         const studentRecord = await db
//             .select()
//             .from(students)
//             .where(eq(students.id, userId));

//         if (studentRecord.length === 0) {
//             return res.status(403).json({ error: "Only students can report posts." });
//         }

//         // 2. Get the post's team and author
//         const postRecord = await db
//             .select({
//                 teamId: createPost.teamId,
//                 authorId: createPost.userId,
//             })
//             .from(posts)
//             .innerJoin(createPost, eq(posts.id, createPost.postId))
//             .where(eq(posts.id, parseInt(postId)));

//         if (postRecord.length === 0) {
//             return res.status(404).json({ error: "Post not found" });
//         }

//         // 2.5 Check if the user is reporting their own post
//         if (postRecord[0].authorId === userId) {
//             return res.status(403).json({ error: "You cannot report your own post." });
//         }

//         const teamId = postRecord[0].teamId;

//         // 3. Check if user is subscribed to the team
//         const subscription = await db
//             .select()
//             .from(subscribe)
//             .where(
//                 and(
//                     eq(subscribe.userId, userId),
//                     eq(subscribe.teamId, teamId)
//                 )
//             );

//         if (subscription.length === 0) {
//             return res.status(403).json({ error: "You must be subscribed to the team to report this post." });
//         }

//         await db.insert(reports).values({
//             postId: parseInt(postId),
//             studentId: userId,
//             describtion: description,
//         });

//         return res.status(201).json({
//             message: "Post reported successfully",
//         });
//     } catch (error: any) {
//         // Handle unique constraint violation (studentId + postId)
//         if (error.code === '23505') {
//             return res.status(409).json({ error: "You have already reported this post." });
//         }
//         console.error("Error reporting post:", error);
//         res.status(500).json({ error: "Failed to report post" });
//     }
// }

export async function reportPost(req: Request<{ postId: string }>, res: Response) {
    try {
        const { postId } = req.params;
        const { description } = req.body;
        const userId = (req as any).user.id;

        // 1. Get the post's team, author, and team leader
        const [postRecord] = await db
            .select({
                id: posts.id,
                teamId: createPost.teamId,
                authorId: createPost.userId,
                leaderId: teams.leaderId
            })
            .from(posts)
            .innerJoin(createPost, eq(posts.id, createPost.postId))
            .innerJoin(teams, eq(teams.id, createPost.teamId))
            .where(eq(posts.id, parseInt(postId)));

        if (!postRecord) {
            return res.status(404).json({ error: "Post not found" });
        }

        // 2. Security Check: Cannot report your own post
        if (postRecord.authorId === userId) {
            return res.status(403).json({ error: "You cannot report your own post." });
        }

        const teamId = postRecord.teamId;

        // 3. Gather Roles (Same as addComment logic)
        
        // Check Admin
        const adminRecord = await db.select().from(admins).where(eq(admins.id, userId));
        const isAdmin = adminRecord.length > 0;

        // Check Leader
        const isLeader = postRecord.leaderId === userId;

        // Check Membership (Organizer/Media)
        const membership = await db
                .select()
                .from(belongTo)
                .where(and(eq(belongTo.teamId, teamId), eq(belongTo.studentId, userId)));
        
        // Check Subscription
        const subscription = await db
            .select()
            .from(subscribe)
            .where(
                and(
                    eq(subscribe.userId, userId),
                    eq(subscribe.teamId, teamId)
                )
            );

        // 4. Combined Permission Logic
        const canReport =
            isAdmin ||
            isLeader ||
            membership.length > 0 ||
            subscription.length > 0;

        if (!canReport) {
            return res.status(403).json({
                error: "You do not have permission to report posts in this team. You must be an admin, leader, staff, or subscriber.",
            });
        }

        // 5. Insert Report
        await db.insert(reports).values({
            postId: parseInt(postId),
            studentId: userId,
            describtion: description,
        });

        return res.status(201).json({
            message: "Post reported successfully",
        });
    } catch (error: any) {
        // Handle unique constraint violation (studentId + postId)
        if (error.code === '23505') {
            return res.status(409).json({ error: "You have already reported this post." });
        }
        console.error("Error reporting post:", error);
        res.status(500).json({ error: "Failed to report post" });
    }
}

// 7. Edit a post (Author only)
// export async function editPost(req: Request<{ postId: string }>, res: Response) {
//     try {
//         const { postId } = req.params;
//         const { description, media } = req.body;
//         const userId = (req as any).user.id;

//         // 1. Check if user is the author
//         const postRecord = await db
//             .select()
//             .from(createPost)
//             .where(eq(createPost.postId, parseInt(postId)));

//         if (postRecord.length === 0) {
//             return res.status(404).json({ error: "Post not found" });
//         }

//         if (postRecord[0].userId !== userId) {
//             return res.status(403).json({ error: "Only the author can edit this post" });
//         }

//         // 2. Update description if provided
//         if (description !== undefined) {
//             await db
//                 .update(posts)
//                 .set({ description })
//                 .where(eq(posts.id, parseInt(postId)));
//         }

//         // 3. Update specific media items if provided
//         if (media && media.length > 0) {
//             // update the chosen media items
//             for (const item of media) {
//                 await db
//                     .update(postmedia)
//                     .set({
//                         url: item.url,
//                         type: item.type,
//                         description: item.description,
//                     })
//                     .where(
//                         and(
//                             eq(postmedia.postId, parseInt(postId)),
//                             eq(postmedia.id, item.id)
//                         )
//                     );
//             }
//         }

//         return res.status(200).json({
//             message: "Post updated successfully",
//         });
//     } catch (error) {
//         console.error("Error editing post:", error);
//         res.status(500).json({ error: "Failed to edit post" });
//     }
// }

export async function editPost(req: Request<{ postId: string }>, res: Response) {
    try {
        const { postId } = req.params;
        const { description, media } = req.body; // Expecting JSON structure
        const userId = (req as any).user.id;

        // 1. Validation: Check if the post exists and the user is the author
        const postRecord = await db
            .select()
            .from(createPost)
            .where(eq(createPost.postId, parseInt(postId)));

        if (postRecord.length === 0) {
            return res.status(404).json({ error: "Post not found" });
        }

        if (postRecord[0].userId !== userId) {
            return res.status(403).json({ error: "Only the author can edit this post" });
        }

        // 2. Database Transaction to ensure atomicity
        await db.transaction(async (tx) => {
            
            // Update Description in 'posts' table
            if (description !== undefined) {
                await tx
                    .update(posts)
                    .set({ description })
                    .where(eq(posts.id, parseInt(postId)));
            }

            // 3. Sync Media items
            // If the user provided a media array, we overwrite the old ones to match the new state
            if (media && Array.isArray(media)) {
                // Remove all current media for this post
                await tx
                    .delete(postmedia)
                    .where(eq(postmedia.postId, parseInt(postId)));

                // If there's new media to add, insert it (Following your createPostHandler logic)
                if (media.length > 0) {
                    const mediaValues = media.map((item: any, index: number) => ({
                        id: index + 1, // Consistent with your createPostHandler logic
                        postId: parseInt(postId),
                        url: item.url,
                        type: item.type,
                        description: item.description || null,
                    }));

                    await tx.insert(postmedia).values(mediaValues);
                }
            }
        });

        return res.status(200).json({
            message: "Post updated successfully",
        });
    } catch (error) {
        console.error("Error editing post:", error);
        res.status(500).json({ error: "Failed to edit post" });
    }
}

// 8. Get single post by ID
export async function getPostById(req: Request<{ postId: string }>, res: Response) {
    try {
        const { postId } = req.params;

        const postData = await db
            .select({
                id: posts.id,
                description: posts.description,
                issuedAt: posts.issuedAt,
                author: {
                    id: users.id,
                    fname: users.fname,
                    lname: users.lname,
                    imgUrl: users.imgUrl,
                },
                team: {
                    id: teams.id,
                    name: teams.name,
                },
                media: sql`COALESCE(
          json_agg(
            json_build_object(
              'url', ${postmedia.url}, 
              'type', ${postmedia.type},
              'description', ${postmedia.description}
            )
          ) FILTER (WHERE ${postmedia.url} IS NOT NULL), 
          '[]'
        )`,
            })
            .from(posts)
            .innerJoin(createPost, eq(posts.id, createPost.postId))
            .innerJoin(users, eq(createPost.userId, users.id))
            .innerJoin(teams, eq(createPost.teamId, teams.id))
            .leftJoin(postmedia, eq(posts.id, postmedia.postId))
            .where(eq(posts.id, parseInt(postId)))
            .groupBy(posts.id, users.id, teams.id);

        if (postData.length === 0) {
            return res.status(404).json({ error: "Post not found" });
        }

        return res.status(200).json({
            message: "Post retrieved successfully",
            post: postData[0],
        });
    } catch (error) {
        console.error("Error fetching post:", error);
        res.status(500).json({ error: "Failed to fetch post" });
    }
}

// 9. Get posts by User ID
export async function getUserPosts(req: Request<{ userId: string }>, res: Response) {
    try {
        const { userId } = req.params;

        const postsData = await db
            .select({
                id: posts.id,
                description: posts.description,
                issuedAt: posts.issuedAt,
                author: {
                    id: users.id,
                    fname: users.fname,
                    lname: users.lname,
                    imgUrl: users.imgUrl,
                },
                team: {
                    id: teams.id,
                    name: teams.name,
                },
                media: sql`COALESCE(
          json_agg(
            json_build_object(
              'url', ${postmedia.url}, 
              'type', ${postmedia.type},
              'description', ${postmedia.description}
            )
          ) FILTER (WHERE ${postmedia.url} IS NOT NULL), 
          '[]'
        )`,
            })
            .from(posts)
            .innerJoin(createPost, eq(posts.id, createPost.postId))
            .innerJoin(users, eq(createPost.userId, users.id))
            .innerJoin(teams, eq(createPost.teamId, teams.id))
            .leftJoin(postmedia, eq(posts.id, postmedia.postId))
            .where(eq(createPost.userId, parseInt(userId)))
            .groupBy(posts.id, users.id, teams.id)
            .orderBy(desc(posts.issuedAt));

        return res.status(200).json({
            message: "User posts retrieved successfully",
            posts: postsData,
        });
    } catch (error) {
        console.error("Error fetching user posts:", error);
        res.status(500).json({ error: "Failed to fetch user posts" });
    }
}


// 10. Get reported posts for a specific team (Media Team/Leader only)
export async function getReportedPosts(req: Request<{ teamId: string }>, res: Response) {
    try {
        const { teamId } = req.params;
        const userId = (req as any).user.id;

        // 1. Check if user has media role or is leader
        const teamRecord = await db.select().from(teams).where(eq(teams.id, parseInt(teamId)));
        if (teamRecord.length === 0) {
            return res.status(404).json({ error: "Team not found" });
        }

        const isLeader = teamRecord[0].leaderId === userId;

        const mediaRole = await db
            .select()
            .from(belongTo)
            .where(
                and(
                    eq(belongTo.studentId, userId),
                    eq(belongTo.teamId, parseInt(teamId)),
                    eq(belongTo.role, "mediaTeam")
                )
            );

        if (!isLeader && mediaRole.length === 0) {
            return res.status(403).json({ error: "Unauthorized to view reported posts" });
        }

        // 2. Call the SQL procedure and fetch results from cursor
        // Cursors require a transaction
        console.log(`Fetching reported posts for teamId: ${teamId}`);
        const result = await db.transaction(async (tx) => {
            const cursorName = 'reported_posts_cursor';
            // Call the procedure
            await tx.execute(sql`CALL get_reported_posts(${parseInt(teamId)}, ${sql.raw(`'${cursorName}'`)})`);
            // Fetch rows from the cursor
            const fetchResult = await tx.execute(sql`FETCH ALL FROM ${sql.raw(cursorName)}`);
            return fetchResult;
        });

        console.log(`Fetched ${result.rows.length} reported posts for teamId: ${teamId}`);

        return res.status(200).json({
            message: "Reported posts retrieved successfully",
            posts: result.rows,
        });
    } catch (error) {
        console.error("Error fetching reported posts:", error);
        res.status(500).json({ error: "Failed to fetch reported posts" });
    }
}
