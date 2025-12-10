import { relations } from "drizzle-orm/relations";
import {
  users,
  students,
  admins,
  teams,
  events,
  rides,
  posts,
  comments,
  takePlace,
  rooms,
  messages,
  createPost,
  speak,
  speakers,
  subscibe,
  joinRide,
  reports,
  belongTo,
  apply,
  postmedia,
  badges,
  ticketsAndFeedback,
} from "./schema.ts";

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.id],
    references: [users.id],
  }),
  teams: many(teams),
  rides: many(rides),
  joinRides: many(joinRide),
  reports: many(reports),
  belongTos: many(belongTo),
  applies: many(apply),
  badges: many(badges),
  ticketsAndFeedbacks: many(ticketsAndFeedback),
}));

export const usersRelations = relations(users, ({ many }) => ({
  students: many(students),
  admins: many(admins),
  comments: many(comments),
  messages_senderId: many(messages, {
    relationName: "messages_senderId_users_id",
  }),
  messages_recieverId: many(messages, {
    relationName: "messages_recieverId_users_id",
  }),
  createPosts: many(createPost),
  subscibes: many(subscibe),
}));

export const adminsRelations = relations(admins, ({ one, many }) => ({
  user: one(users, {
    fields: [admins.id],
    references: [users.id],
  }),
  teams: many(teams),
  events: many(events),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  admin: one(admins, {
    fields: [teams.respondedBy],
    references: [admins.id],
  }),
  student: one(students, {
    fields: [teams.leaderId],
    references: [students.id],
  }),
  events: many(events),
  createPosts: many(createPost),
  subscibes: many(subscibe),
  belongTos: many(belongTo),
  applies: many(apply),
  badges: many(badges),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  admin: one(admins, {
    fields: [events.respondedBy],
    references: [admins.id],
  }),
  team: one(teams, {
    fields: [events.teamId],
    references: [teams.id],
  }),
  takePlaces: many(takePlace),
  speaks: many(speak),
  ticketsAndFeedbacks: many(ticketsAndFeedback),
}));

export const ridesRelations = relations(rides, ({ one, many }) => ({
  student: one(students, {
    fields: [rides.createdBy],
    references: [students.id],
  }),
  joinRides: many(joinRide),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [comments.author],
    references: [users.id],
  }),
  comment: one(comments, {
    fields: [comments.parentId],
    references: [comments.postId],
    relationName: "comments_parentId_comments_postId",
  }),
  comments: many(comments, {
    relationName: "comments_parentId_comments_postId",
  }),
}));

export const postsRelations = relations(posts, ({ many }) => ({
  comments: many(comments),
  createPosts: many(createPost),
  reports: many(reports),
  postmedias: many(postmedia),
}));

export const takePlaceRelations = relations(takePlace, ({ one }) => ({
  event: one(events, {
    fields: [takePlace.eventId],
    references: [events.id],
  }),
  room: one(rooms, {
    fields: [takePlace.roomId],
    references: [rooms.id],
  }),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  takePlaces: many(takePlace),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user_senderId: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "messages_senderId_users_id",
  }),
  user_recieverId: one(users, {
    fields: [messages.recieverId],
    references: [users.id],
    relationName: "messages_recieverId_users_id",
  }),
}));

export const createPostRelations = relations(createPost, ({ one }) => ({
  post: one(posts, {
    fields: [createPost.postId],
    references: [posts.id],
  }),
  team: one(teams, {
    fields: [createPost.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [createPost.userId],
    references: [users.id],
  }),
}));

export const speakRelations = relations(speak, ({ one }) => ({
  event: one(events, {
    fields: [speak.eventId],
    references: [events.id],
  }),
  speaker: one(speakers, {
    fields: [speak.speakerId],
    references: [speakers.id],
  }),
}));

export const speakersRelations = relations(speakers, ({ many }) => ({
  speaks: many(speak),
}));

export const subscibeRelations = relations(subscibe, ({ one }) => ({
  team: one(teams, {
    fields: [subscibe.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [subscibe.userId],
    references: [users.id],
  }),
}));

export const joinRideRelations = relations(joinRide, ({ one }) => ({
  student: one(students, {
    fields: [joinRide.studentId],
    references: [students.id],
  }),
  ride: one(rides, {
    fields: [joinRide.rideId],
    references: [rides.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  post: one(posts, {
    fields: [reports.postId],
    references: [posts.id],
  }),
  student: one(students, {
    fields: [reports.studentId],
    references: [students.id],
  }),
}));

export const belongToRelations = relations(belongTo, ({ one }) => ({
  student: one(students, {
    fields: [belongTo.studentId],
    references: [students.id],
  }),
  team: one(teams, {
    fields: [belongTo.teamId],
    references: [teams.id],
  }),
}));

export const applyRelations = relations(apply, ({ one }) => ({
  student: one(students, {
    fields: [apply.studentId],
    references: [students.id],
  }),
  team: one(teams, {
    fields: [apply.teamId],
    references: [teams.id],
  }),
}));

export const postmediaRelations = relations(postmedia, ({ one }) => ({
  post: one(posts, {
    fields: [postmedia.postId],
    references: [posts.id],
  }),
}));

export const badgesRelations = relations(badges, ({ one }) => ({
  student: one(students, {
    fields: [badges.studentId],
    references: [students.id],
  }),
  team: one(teams, {
    fields: [badges.teamId],
    references: [teams.id],
  }),
}));

export const ticketsAndFeedbackRelations = relations(
  ticketsAndFeedback,
  ({ one }) => ({
    event: one(events, {
      fields: [ticketsAndFeedback.eventId],
      references: [events.id],
    }),
    student: one(students, {
      fields: [ticketsAndFeedback.studentId],
      references: [students.id],
    }),
  })
);
