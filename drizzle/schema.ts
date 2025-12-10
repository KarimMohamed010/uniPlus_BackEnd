import {
  pgTable,
  integer,
  varchar,
  text,
  foreignKey,
  timestamp,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: integer()
    .primaryKey()
    .generatedAlwaysAsIdentity({
      name: "users_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
  email: varchar({ length: 255 }).notNull().unique(),
  fname: varchar({ length: 50 }).notNull(),
  lname: varchar({ length: 50 }).notNull(),
  bio: text(),
  imgUrl: varchar("img_url", { length: 255 }),
  userPassword: varchar("user_password", { length: 255 }).notNull(),
});

export const students = pgTable(
  "students",
  {
    id: integer().primaryKey().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [users.id],
      name: "students_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ]
);

export const admins = pgTable(
  "admins",
  {
    id: integer().primaryKey().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [users.id],
      name: "admins_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ]
);

export const teams = pgTable(
  "teams",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "teams_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    name: varchar({ length: 50 }).notNull(),
    description: text(),
    leaderId: integer("leader_id"),
    respondedBy: integer("responded_by"),
    acceptanceStatus: text("acceptance_status"),
  },
  (table) => [
    foreignKey({
      columns: [table.respondedBy],
      foreignColumns: [admins.id],
      name: "teams_responded_by_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.leaderId],
      foreignColumns: [students.id],
      name: "teams_leader_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
  ]
);

export const events = pgTable(
  "events",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "events_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    title: varchar({ length: 50 }).notNull(),
    description: text(),
    type: varchar({ length: 50 }),
    issuedAt: timestamp("issued_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    startTime: timestamp("start_time", {
      withTimezone: true,
      mode: "string",
    }),
    endTime: timestamp("end_time", {
      withTimezone: true,
      mode: "string",
    }),
    teamId: integer("team_id"),
    respondedBy: integer("responded_by"),
    acceptanceStatus: text("acceptance_status"),
  },
  (table) => [
    foreignKey({
      columns: [table.respondedBy],
      foreignColumns: [admins.id],
      name: "events_responded_by_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "events_team_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ]
);

export const rides = pgTable(
  "rides",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "rides_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    toLoc: text("to_loc"),
    fromLoc: text("from_loc"),
    price: integer(),
    seatsAvailable: integer("seats_available"),
    arrivalTime: timestamp("arrival_time", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    service: varchar({ length: 50 }),
    createdBy: integer("created_by").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [students.id],
      name: "rides_created_by_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ]
);

export const posts = pgTable("posts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity({
    name: "posts_id_seq",
    startWith: 1,
    increment: 1,
    minValue: 1,
    maxValue: 2147483647,
    cache: 1,
  }),
  description: text(),
  issuedAt: timestamp("issued_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
});

export const comments = pgTable(
  "comments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "comments_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    author: integer(),
    content: text(),
    postId: integer("post_id").notNull(),
    issuedAt: timestamp("issued_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    parentId: integer("parent_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [posts.id],
      name: "comments_post_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.author],
      foreignColumns: [users.id],
      name: "comments_author_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.postId],
      name: "comments_parent_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ]
);

export const takePlace = pgTable(
  "take_place",
  {
    eventId: integer("event_id").primaryKey().notNull(),
    roomId: integer("room_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: "take_place_event_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.roomId],
      foreignColumns: [rooms.id],
      name: "take_place_room_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ]
);

export const rooms = pgTable("rooms", {
  id: integer().primaryKey().generatedAlwaysAsIdentity({
    name: "rooms_id_seq",
    startWith: 1,
    increment: 1,
    minValue: 1,
    maxValue: 2147483647,
    cache: 1,
  }),
  name: varchar({ length: 50 }).notNull(),
  capacity: integer().notNull(),
  location: text(),
});

export const messages = pgTable(
  "messages",
  {
    msgId: integer("msg_id").primaryKey().notNull(),
    sendAt: timestamp("send_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    content: text(),
    senderId: integer("sender_id"),
    receiverId: integer("receiverer_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [users.id],
      name: "messages_sender_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.receiverId],
      foreignColumns: [users.id],
      name: "messages_receiver_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ]
);

export const speakers = pgTable("speakers", {
  id: integer().primaryKey().generatedAlwaysAsIdentity({
    name: "speakers_id_seq",
    startWith: 1,
    increment: 1,
    minValue: 1,
    maxValue: 2147483647,
    cache: 1,
  }),
  name: varchar({ length: 50 }).notNull(),
  bio: text(),
  fname: varchar({ length: 50 }),
  lname: varchar({ length: 50 }),
  contact: integer(),
  email: varchar({ length: 50 }).notNull(),
});

export const createPost = pgTable(
  "create_post",
  {
    postId: integer("post_id").primaryKey().notNull(),
    teamId: integer("team_id").notNull(),
    userId: integer("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [posts.id],
      name: "create_post_post_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "create_post_team_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "create_post_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ]
);

export const speak = pgTable(
  "speak",
  {
    speakerId: integer("speaker_id").notNull(),
    eventId: integer("event_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: "speak_event_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.speakerId],
      foreignColumns: [speakers.id],
      name: "speak_speaker_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.speakerId, table.eventId],
      name: "speak_pkey",
    }),
  ]
);

export const subscribe = pgTable(
  "subscibe",
  {
    userId: integer("user_id").notNull(),
    teamId: integer("team_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "subscibe_team_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "subscibe_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.userId, table.teamId],
      name: "subscibe_pkey",
    }),
  ]
);

export const joinRide = pgTable(
  "join_ride",
  {
    studentId: integer("student_id").notNull(),
    rideId: integer("ride_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: "join_ride_student_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.rideId],
      foreignColumns: [rides.id],
      name: "join_ride_ride_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.studentId, table.rideId],
      name: "join_ride_pkey",
    }),
  ]
);

export const reports = pgTable(
  "reports",
  {
    studentId: integer("student_id").notNull(),
    postId: integer("post_id").notNull(),
    describtion: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [posts.id],
      name: "reports_post_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: "reports_student_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.studentId, table.postId],
      name: "reports_pkey",
    }),
  ]
);

export const belongTo = pgTable(
  "belong_to",
  {
    studentId: integer("student_id").notNull(),
    teamId: integer("team_id").notNull(),
    role: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: "belong_to_student_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "belong_to_team_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.studentId, table.teamId],
      name: "belong_to_pkey",
    }),
  ]
);

export const apply = pgTable(
  "apply",
  {
    studentId: integer("student_id").notNull(),
    teamId: integer("team_id").notNull(),
    cvUrl: text("cv_url").notNull(),
    role: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: "apply_student_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "apply_team_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.studentId, table.teamId],
      name: "apply_pkey",
    }),
  ]
);

export const postmedia = pgTable(
  "postmedia",
  {
    id: integer().notNull(),
    description: text(),
    url: text(),
    type: varchar({ length: 50 }),
    postId: integer("post_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [posts.id],
      name: "postmedia_post_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({ columns: [table.id, table.postId], name: "postmedia_pkey" }),
  ]
);

export const badges = pgTable(
  "badges",
  {
    studentId: integer("student_id").notNull(),
    teamId: integer("team_id").notNull(),
    type: text("type_").notNull(),
    points: integer().default(0),
    expDate: timestamp("exp_date", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    usageNum: integer("usage_num"),
  },
  (table) => [
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: "badges_student_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "badges_team_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.studentId, table.teamId],
      name: "badges_pkey",
    }),
  ]
);

export const ticketsAndFeedback = pgTable(
  "tickets_and_feedback",
  {
    eventId: integer("event_id").notNull(),
    studentId: integer("student_id").notNull(),
    certificationUrl: text("certification_url"),
    dateIssued: timestamp("date_issued", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    price: integer().notNull(),
    scanned: integer(),
    rating: integer(),
    feedback: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: "tickets_and_feedback_event_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: "tickets_and_feedback_student_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.eventId, table.studentId],
      name: "tickets_and_feedback_pkey",
    }),
    check(
      "tickets_and_feedback_rating_check",
      sql`(rating >= 0) AND (rating <= 5)`
    ),
  ]
);
