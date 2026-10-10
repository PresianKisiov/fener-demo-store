CREATE TABLE "shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"courier" text NOT NULL,
	"mode" text NOT NULL,
	"tracking_number" text,
	"label_url" text,
	"weight_grams" integer NOT NULL,
	"cost_cents" integer,
	"cost_currency" text,
	"status" text NOT NULL,
	"status_text" text,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "courier_offices" ADD COLUMN "code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "courier_offices" ADD COLUMN "post_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "courier_offices" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "post_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "address_line" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight_grams" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_one_active_per_order" ON "shipments" USING btree ("order_id") WHERE "shipments"."cancelled_at" is null;