ALTER TABLE "subscibe" RENAME TO "subscribe";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_receiver_id_fkey";
--> statement-breakpoint
ALTER TABLE "subscribe" DROP CONSTRAINT "subscibe_team_id_fkey";
--> statement-breakpoint
ALTER TABLE "subscribe" DROP CONSTRAINT "subscibe_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "subscribe" DROP CONSTRAINT "subscibe_pkey";--> statement-breakpoint
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

-- ALTER TABLE "comments" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "comments" ADD PRIMARY KEY ("post_id");--> statement-breakpoint
ALTER TABLE "subscribe" ADD CONSTRAINT "subscribe_pkey" PRIMARY KEY("user_id","team_id");--> statement-breakpoint
ALTER TABLE "subscribe" ADD CONSTRAINT "subscribe_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subscribe" ADD CONSTRAINT "subscribe_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;