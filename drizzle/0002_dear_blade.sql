ALTER TABLE "messages" RENAME COLUMN "receiverer_id" TO "receiver_id";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_receiver_id_fkey";
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;