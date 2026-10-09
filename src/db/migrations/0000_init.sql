CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"cart_id" uuid NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "cart_items_cart_id_product_id_pk" PRIMARY KEY("cart_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_offices" (
	"id" text PRIMARY KEY NOT NULL,
	"courier" text NOT NULL,
	"kind" text NOT NULL,
	"city" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"hours" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"order_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"vat_rate" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"public_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"courier" text NOT NULL,
	"delivery_type" text NOT NULL,
	"office_id" text,
	"delivery_label" text NOT NULL,
	"city" text NOT NULL,
	"payment_method" text NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer NOT NULL,
	"cod_fee_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"vat_cents" integer NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"tracking_number" text,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"changed_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"short_description" text NOT NULL,
	"description" text NOT NULL,
	"illustration" text NOT NULL,
	"price_cents" integer NOT NULL,
	"prior_price_cents" integer,
	"reduction_started_at" timestamp with time zone,
	"vat_rate" integer DEFAULT 20 NOT NULL,
	"measure_unit" text,
	"measure_quantity_milli" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"specs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"model_number" text DEFAULT '' NOT NULL,
	"manufacturer_name" text DEFAULT '' NOT NULL,
	"manufacturer_address" text DEFAULT '' NOT NULL,
	"manufacturer_email" text DEFAULT '' NOT NULL,
	"manufacturer_in_eu" boolean DEFAULT true NOT NULL,
	"eu_responsible_name" text DEFAULT '' NOT NULL,
	"eu_responsible_address" text DEFAULT '' NOT NULL,
	"eu_responsible_email" text DEFAULT '' NOT NULL,
	"safety_warnings" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"goods_received_at" timestamp with time zone,
	"refunded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_id" ON "webhook_events" USING btree ("provider","event_id");