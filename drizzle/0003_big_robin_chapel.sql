ALTER TABLE "messages" RENAME COLUMN "send_at" TO "sent_at";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "seen" boolean DEFAULT false;