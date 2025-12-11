import { relations } from "drizzle-orm/relations";
import { users, admins, events, teams, posts, comments, messages, createPost, takePlace, rooms, students, rides, joinRide, subscribe, speak, speakers, belongTo, reports, apply, postmedia, badges, ticketsAndFeedback } from "./schema";

export const adminsRelations = relations(admins, ({one, many}) => ({
	user: one(users, {
		fields: [admins.id],
		references: [users.id]
	}),
	events: many(events),
	teams: many(teams),
}));

export const usersRelations = relations(users, ({many}) => ({
	admins: many(admins),
	comments: many(comments),
	messages: many(messages),
	createPosts: many(createPost),
	students: many(students),
	subscribes: many(subscribe),
}));

export const eventsRelations = relations(events, ({one, many}) => ({
	admin: one(admins, {
		fields: [events.respondedBy],
		references: [admins.id]
	}),
	team: one(teams, {
		fields: [events.teamId],
		references: [teams.id]
	}),
	takePlaces: many(takePlace),
	speaks: many(speak),
	ticketsAndFeedbacks: many(ticketsAndFeedback),
}));

export const teamsRelations = relations(teams, ({one, many}) => ({
	events: many(events),
	createPosts: many(createPost),
	admin: one(admins, {
		fields: [teams.respondedBy],
		references: [admins.id]
	}),
	student: one(students, {
		fields: [teams.leaderId],
		references: [students.id]
	}),
	subscribes: many(subscribe),
	belongTos: many(belongTo),
	applies: many(apply),
	badges: many(badges),
}));

export const commentsRelations = relations(comments, ({one, many}) => ({
	post: one(posts, {
		fields: [comments.postId],
		references: [posts.id]
	}),
	user: one(users, {
		fields: [comments.author],
		references: [users.id]
	}),
	comment: one(comments, {
		fields: [comments.parentId],
		references: [comments.postId],
		relationName: "comments_parentId_comments_postId"
	}),
	comments: many(comments, {
		relationName: "comments_parentId_comments_postId"
	}),
}));

export const postsRelations = relations(posts, ({many}) => ({
	comments: many(comments),
	createPosts: many(createPost),
	reports: many(reports),
	postmedias: many(postmedia),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	user: one(users, {
		fields: [messages.senderId],
		references: [users.id]
	}),
}));

export const createPostRelations = relations(createPost, ({one}) => ({
	post: one(posts, {
		fields: [createPost.postId],
		references: [posts.id]
	}),
	team: one(teams, {
		fields: [createPost.teamId],
		references: [teams.id]
	}),
	user: one(users, {
		fields: [createPost.userId],
		references: [users.id]
	}),
}));

export const takePlaceRelations = relations(takePlace, ({one}) => ({
	event: one(events, {
		fields: [takePlace.eventId],
		references: [events.id]
	}),
	room: one(rooms, {
		fields: [takePlace.roomId],
		references: [rooms.id]
	}),
}));

export const roomsRelations = relations(rooms, ({many}) => ({
	takePlaces: many(takePlace),
}));

export const ridesRelations = relations(rides, ({one, many}) => ({
	student: one(students, {
		fields: [rides.createdBy],
		references: [students.id]
	}),
	joinRides: many(joinRide),
}));

export const studentsRelations = relations(students, ({one, many}) => ({
	rides: many(rides),
	user: one(users, {
		fields: [students.id],
		references: [users.id]
	}),
	teams: many(teams),
	joinRides: many(joinRide),
	belongTos: many(belongTo),
	reports: many(reports),
	applies: many(apply),
	badges: many(badges),
	ticketsAndFeedbacks: many(ticketsAndFeedback),
}));

export const joinRideRelations = relations(joinRide, ({one}) => ({
	student: one(students, {
		fields: [joinRide.studentId],
		references: [students.id]
	}),
	ride: one(rides, {
		fields: [joinRide.rideId],
		references: [rides.id]
	}),
}));

export const subscribeRelations = relations(subscribe, ({one}) => ({
	team: one(teams, {
		fields: [subscribe.teamId],
		references: [teams.id]
	}),
	user: one(users, {
		fields: [subscribe.userId],
		references: [users.id]
	}),
}));

export const speakRelations = relations(speak, ({one}) => ({
	event: one(events, {
		fields: [speak.eventId],
		references: [events.id]
	}),
	speaker: one(speakers, {
		fields: [speak.speakerId],
		references: [speakers.id]
	}),
}));

export const speakersRelations = relations(speakers, ({many}) => ({
	speaks: many(speak),
}));

export const belongToRelations = relations(belongTo, ({one}) => ({
	student: one(students, {
		fields: [belongTo.studentId],
		references: [students.id]
	}),
	team: one(teams, {
		fields: [belongTo.teamId],
		references: [teams.id]
	}),
}));

export const reportsRelations = relations(reports, ({one}) => ({
	post: one(posts, {
		fields: [reports.postId],
		references: [posts.id]
	}),
	student: one(students, {
		fields: [reports.studentId],
		references: [students.id]
	}),
}));

export const applyRelations = relations(apply, ({one}) => ({
	student: one(students, {
		fields: [apply.studentId],
		references: [students.id]
	}),
	team: one(teams, {
		fields: [apply.teamId],
		references: [teams.id]
	}),
}));

export const postmediaRelations = relations(postmedia, ({one}) => ({
	post: one(posts, {
		fields: [postmedia.postId],
		references: [posts.id]
	}),
}));

export const badgesRelations = relations(badges, ({one}) => ({
	student: one(students, {
		fields: [badges.studentId],
		references: [students.id]
	}),
	team: one(teams, {
		fields: [badges.teamId],
		references: [teams.id]
	}),
}));

export const ticketsAndFeedbackRelations = relations(ticketsAndFeedback, ({one}) => ({
	event: one(events, {
		fields: [ticketsAndFeedback.eventId],
		references: [events.id]
	}),
	student: one(students, {
		fields: [ticketsAndFeedback.studentId],
		references: [students.id]
	}),
}));