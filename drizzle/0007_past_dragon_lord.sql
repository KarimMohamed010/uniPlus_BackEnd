ALTER TABLE "subscribe" ADD COLUMN "type_" text NOT NULL;--> statement-breakpoint
ALTER TABLE "subscribe" ADD COLUMN "exp_date" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "subscribe" ADD COLUMN "usage_num" integer;