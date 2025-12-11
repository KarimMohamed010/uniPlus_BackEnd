ALTER TABLE "events" RENAME COLUMN "discription" TO "description";--> statement-breakpoint
ALTER TABLE "messages" RENAME COLUMN "reciever_id" TO "receiverer_id";--> statement-breakpoint
ALTER TABLE "badges" RENAME COLUMN "pionts" TO "points";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_reciever_id_fkey";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "img_url" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "user_password" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "start_time" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "end_time" DROP DEFAULT;--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'comments'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

ALTER TABLE "comments" DROP CONSTRAINT "comments_pkey";--> statement-breakpoint
ALTER TABLE "comments" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiverer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");