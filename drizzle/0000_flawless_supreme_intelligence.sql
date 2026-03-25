CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'credit', 'student_loan', 'standard_loan');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('monthly', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."import_format" AS ENUM('csv', 'qbo', 'ofx');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."recurring_txn_status" AS ENUM('expected', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."recurring_type" AS ENUM('bill', 'income', 'subscription', 'credit_payment', 'transfer', 'investment');--> statement-breakpoint
CREATE TYPE "public"."schedule_type" AS ENUM('specific_dates', 'weekly', 'biweekly', 'semimonthly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."vendor_type" AS ENUM('vendor', 'payee');--> statement-breakpoint
CREATE TABLE "household_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"email" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending',
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text,
	"max_members" integer DEFAULT 2,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"household_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"opening_balance_cents" integer DEFAULT 0 NOT NULL,
	"as_of_date" text,
	"credit_limit_cents" integer,
	"interest_rate_basis_points" integer,
	"minimum_payment_cents" integer,
	"statement_date" integer,
	"interest_date" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_sub_period_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"allocated_cents" integer DEFAULT 0 NOT NULL,
	"auto_split" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL,
	CONSTRAINT "uq_allocation_sub_period_category" UNIQUE("budget_sub_period_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "budget_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"pay_schedule_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"is_customized" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"closed_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_sub_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_period_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"surplus_carry_forward_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"is_carry_only" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_sub_period_id" integer NOT NULL,
	"from_category_id" integer NOT NULL,
	"to_category_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"reversal_of_id" integer,
	"from_category_name" text NOT NULL,
	"to_category_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"household_id" integer NOT NULL,
	CONSTRAINT "ck_transfer_amount_positive" CHECK ("budget_transfers"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_group_id" integer NOT NULL,
	"parent_id" integer,
	"name" text NOT NULL,
	"ref_number" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL,
	CONSTRAINT "uq_categories_ref_number_household" UNIQUE("ref_number","household_id")
);
--> statement-breakpoint
CREATE TABLE "category_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_system" integer DEFAULT 0,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_schedule_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"pay_schedule_id" integer NOT NULL,
	"effective_date" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Primary' NOT NULL,
	"schedule_type" "schedule_type" NOT NULL,
	"day_of_month_1" integer,
	"day_of_month_2" integer,
	"day_of_week" integer,
	"anchor_date" text,
	"is_primary" integer DEFAULT 0 NOT NULL,
	"amount_cents" integer,
	"household_member_id" integer,
	"income_category_id" integer,
	"vendor_id" integer,
	"end_date" text,
	"recurring_template_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_sub_period_id" integer,
	"changed_at" timestamp with time zone DEFAULT now(),
	"changed_field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"reason" text,
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_income_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_sub_period_id" integer NOT NULL,
	"label" text NOT NULL,
	"expected_cents" integer DEFAULT 0 NOT NULL,
	"actual_cents" integer,
	"category_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_category_id" integer,
	"type" "vendor_type" DEFAULT 'vendor' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"household_id" integer NOT NULL,
	CONSTRAINT "uq_app_settings_key_household" UNIQUE("key","household_id")
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"initials" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"budget_sub_period_id" integer,
	"date" text NOT NULL,
	"description" text NOT NULL,
	"original_description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"is_debit" integer DEFAULT 1 NOT NULL,
	"category_id" integer,
	"vendor_id" integer,
	"member_id" integer,
	"reconciled_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"recurring_template_id" integer,
	"recurring_status" "recurring_txn_status",
	"estimated_amount_cents" integer,
	"fitid" text,
	"import_batch_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_dismissed_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL,
	CONSTRAINT "uq_dismissed_fingerprint_household" UNIQUE("fingerprint","household_id")
);
--> statement-breakpoint
CREATE TABLE "recurring_generation_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"budget_sub_period_id" integer NOT NULL,
	"scheduled_date" text NOT NULL,
	"transaction_id" integer,
	"user_deleted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL,
	CONSTRAINT "uq_gen_log_template_date" UNIQUE("template_id","scheduled_date")
);
--> statement-breakpoint
CREATE TABLE "recurring_template_dates" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"day_value" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vendor_id" integer,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"is_debit" integer DEFAULT 1 NOT NULL,
	"category_id" integer,
	"account_id" integer NOT NULL,
	"member_id" integer,
	"type" "recurring_type" DEFAULT 'bill' NOT NULL,
	"frequency" "frequency" DEFAULT 'monthly' NOT NULL,
	"interval_n" integer DEFAULT 1 NOT NULL,
	"start_date" text,
	"end_date" text,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"auto_confirm" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"profile_name" text,
	"account_id" integer NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"format" "import_format" DEFAULT 'csv' NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"header_fingerprint" text NOT NULL,
	"mapping_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"household_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"statement_date" text NOT NULL,
	"statement_balance_cents" integer NOT NULL,
	"status" "reconciliation_status" DEFAULT 'in_progress' NOT NULL,
	"cleared_transaction_ids" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"household_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_budget_sub_period_id_budget_sub_periods_id_fk" FOREIGN KEY ("budget_sub_period_id") REFERENCES "public"."budget_sub_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_pay_schedule_id_pay_schedules_id_fk" FOREIGN KEY ("pay_schedule_id") REFERENCES "public"."pay_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_sub_periods" ADD CONSTRAINT "budget_sub_periods_budget_period_id_budget_periods_id_fk" FOREIGN KEY ("budget_period_id") REFERENCES "public"."budget_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_sub_periods" ADD CONSTRAINT "budget_sub_periods_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_budget_sub_period_id_budget_sub_periods_id_fk" FOREIGN KEY ("budget_sub_period_id") REFERENCES "public"."budget_sub_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_from_category_id_categories_id_fk" FOREIGN KEY ("from_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_to_category_id_categories_id_fk" FOREIGN KEY ("to_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_reversal_of_id_budget_transfers_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."budget_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_category_group_id_category_groups_id_fk" FOREIGN KEY ("category_group_id") REFERENCES "public"."category_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_groups" ADD CONSTRAINT "category_groups_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_schedule_history" ADD CONSTRAINT "pay_schedule_history_pay_schedule_id_pay_schedules_id_fk" FOREIGN KEY ("pay_schedule_id") REFERENCES "public"."pay_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_schedule_history" ADD CONSTRAINT "pay_schedule_history_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_schedules" ADD CONSTRAINT "pay_schedules_income_category_id_categories_id_fk" FOREIGN KEY ("income_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_schedules" ADD CONSTRAINT "pay_schedules_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_schedules" ADD CONSTRAINT "pay_schedules_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_audit_log" ADD CONSTRAINT "period_audit_log_budget_sub_period_id_budget_sub_periods_id_fk" FOREIGN KEY ("budget_sub_period_id") REFERENCES "public"."budget_sub_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_audit_log" ADD CONSTRAINT "period_audit_log_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_income_lines" ADD CONSTRAINT "period_income_lines_budget_sub_period_id_budget_sub_periods_id_fk" FOREIGN KEY ("budget_sub_period_id") REFERENCES "public"."budget_sub_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_income_lines" ADD CONSTRAINT "period_income_lines_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_income_lines" ADD CONSTRAINT "period_income_lines_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_default_category_id_categories_id_fk" FOREIGN KEY ("default_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_budget_sub_period_id_budget_sub_periods_id_fk" FOREIGN KEY ("budget_sub_period_id") REFERENCES "public"."budget_sub_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_dismissed_suggestions" ADD CONSTRAINT "recurring_dismissed_suggestions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_generation_log" ADD CONSTRAINT "recurring_generation_log_template_id_recurring_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_generation_log" ADD CONSTRAINT "recurring_generation_log_budget_sub_period_id_budget_sub_periods_id_fk" FOREIGN KEY ("budget_sub_period_id") REFERENCES "public"."budget_sub_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_generation_log" ADD CONSTRAINT "recurring_generation_log_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_generation_log" ADD CONSTRAINT "recurring_generation_log_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template_dates" ADD CONSTRAINT "recurring_template_dates_template_id_recurring_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template_dates" ADD CONSTRAINT "recurring_template_dates_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_profiles" ADD CONSTRAINT "import_profiles_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transfers_sub_period" ON "budget_transfers" USING btree ("budget_sub_period_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_from_cat" ON "budget_transfers" USING btree ("from_category_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_to_cat" ON "budget_transfers" USING btree ("to_category_id");--> statement-breakpoint
CREATE INDEX "idx_pay_schedule_history_schedule" ON "pay_schedule_history" USING btree ("pay_schedule_id","effective_date");--> statement-breakpoint
CREATE INDEX "idx_transactions_account_date" ON "transactions" USING btree ("account_id","date","id");--> statement-breakpoint
CREATE INDEX "idx_transactions_sub_period" ON "transactions" USING btree ("budget_sub_period_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_category" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_recurring_template" ON "transactions" USING btree ("recurring_template_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_recurring_status" ON "transactions" USING btree ("recurring_status");--> statement-breakpoint
CREATE INDEX "idx_transactions_fitid" ON "transactions" USING btree ("fitid");--> statement-breakpoint
CREATE INDEX "idx_transactions_import_batch" ON "transactions" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_gen_log_template" ON "recurring_generation_log" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_gen_log_sub_period" ON "recurring_generation_log" USING btree ("budget_sub_period_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_templates_status" ON "recurring_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_import_profiles_fingerprint" ON "import_profiles" USING btree ("header_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_recon_sessions_account" ON "reconciliation_sessions" USING btree ("account_id","status");