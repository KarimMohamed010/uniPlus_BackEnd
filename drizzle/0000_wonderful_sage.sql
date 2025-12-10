-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" varchar(50) NOT NULL,
	"fname" varchar(50) NOT NULL,
	"lname" varchar(50) NOT NULL,
	"bio" text,
	"img_url" varchar(200),
	"user_password" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(50) NOT NULL,
	"description" text,
	"leader_id" integer,
	"responded_by" integer,
	"acceptance_status" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar(50) NOT NULL,
	"discription" text,
	"type" varchar(50),
	"issued_at" timestamp with time zone DEFAULT now(),
	"start_time" timestamp with time zone DEFAULT now(),
	"end_time" timestamp with time zone DEFAULT now(),
	"team_id" integer,
	"responded_by" integer,
	"acceptance_status" text
);
--> statement-breakpoint
CREATE TABLE "rides" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"to_loc" text,
	"from_loc" text,
	"price" integer,
	"seats_available" integer,
	"arrival_time" timestamp with time zone DEFAULT now(),
	"service" varchar(50),
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"description" text,
	"issued_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"author" integer,
	"content" text,
	"post_id" integer PRIMARY KEY NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now(),
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "take_place" (
	"event_id" integer PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rooms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(50) NOT NULL,
	"capacity" integer NOT NULL,
	"location" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"msg_id" integer PRIMARY KEY NOT NULL,
	"send_at" timestamp with time zone DEFAULT now(),
	"content" text,
	"sender_id" integer,
	"reciever_id" integer
);
--> statement-breakpoint
CREATE TABLE "speakers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "speakers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(50) NOT NULL,
	"bio" text,
	"fname" varchar(50),
	"lname" varchar(50),
	"contact" integer,
	"email" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "create_post" (
	"post_id" integer PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speak" (
	"speaker_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	CONSTRAINT "speak_pkey" PRIMARY KEY("speaker_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "subscibe" (
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	CONSTRAINT "subscibe_pkey" PRIMARY KEY("user_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "join_ride" (
	"student_id" integer NOT NULL,
	"ride_id" integer NOT NULL,
	CONSTRAINT "join_ride_pkey" PRIMARY KEY("student_id","ride_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"student_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"describtion" text NOT NULL,
	CONSTRAINT "reports_pkey" PRIMARY KEY("student_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "belong_to" (
	"student_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "belong_to_pkey" PRIMARY KEY("student_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "apply" (
	"student_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"cv_url" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "apply_pkey" PRIMARY KEY("student_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "postmedia" (
	"id" integer NOT NULL,
	"description" text,
	"url" text,
	"type" varchar(50),
	"post_id" integer NOT NULL,
	CONSTRAINT "postmedia_pkey" PRIMARY KEY("id","post_id")
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"student_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"type_" text NOT NULL,
	"pionts" integer DEFAULT 0,
	"exp_date" timestamp with time zone DEFAULT now(),
	"usage_num" integer,
	CONSTRAINT "badges_pkey" PRIMARY KEY("student_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "tickets_and_feedback" (
	"event_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"certification_url" text,
	"date_issued" timestamp with time zone DEFAULT now(),
	"price" integer NOT NULL,
	"scanned" integer,
	"rating" integer,
	"feedback" text,
	CONSTRAINT "tickets_and_feedback_pkey" PRIMARY KEY("event_id","student_id"),
	CONSTRAINT "tickets_and_feedback_rating_check" CHECK ((rating >= 0) AND (rating <= 5))
);
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_fkey" FOREIGN KEY ("author") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("post_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "take_place" ADD CONSTRAINT "take_place_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "take_place" ADD CONSTRAINT "take_place_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reciever_id_fkey" FOREIGN KEY ("reciever_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "create_post" ADD CONSTRAINT "create_post_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "create_post" ADD CONSTRAINT "create_post_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "create_post" ADD CONSTRAINT "create_post_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "speak" ADD CONSTRAINT "speak_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "speak" ADD CONSTRAINT "speak_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subscibe" ADD CONSTRAINT "subscibe_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subscibe" ADD CONSTRAINT "subscibe_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "join_ride" ADD CONSTRAINT "join_ride_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "join_ride" ADD CONSTRAINT "join_ride_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "belong_to" ADD CONSTRAINT "belong_to_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "belong_to" ADD CONSTRAINT "belong_to_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "apply" ADD CONSTRAINT "apply_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "apply" ADD CONSTRAINT "apply_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "postmedia" ADD CONSTRAINT "postmedia_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tickets_and_feedback" ADD CONSTRAINT "tickets_and_feedback_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tickets_and_feedback" ADD CONSTRAINT "tickets_and_feedback_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE cascade;
*/