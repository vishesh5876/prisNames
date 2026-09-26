CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_auth_identities_provider_id" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"otp_hash" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"invalidated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_password_credentials_user_id" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(30) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_roles_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"company" varchar(200),
	"phone" varchar(30),
	"country" varchar(2),
	"timezone" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_profiles_user_id" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_roles_user_role" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_canonical" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"display_name" varchar(100),
	"account_status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"disabled_at" timestamp with time zone,
	"disabled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_users_account_status" CHECK (account_status IN ('ACTIVE', 'DISABLED', 'SUSPENDED'))
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"operation" varchar(20) NOT NULL,
	"years" integer NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"quote_id" uuid,
	"registrar_provider_id" uuid NOT NULL,
	"provider_cost_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'DRAFT' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "chk_orders_status" CHECK (status IN ('DRAFT', 'PENDING_PAYMENT', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUND_REQUIRED', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED'))
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"operation" varchar(20) NOT NULL,
	"years" integer DEFAULT 1 NOT NULL,
	"retail_amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"provider_cost_minor" bigint NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"registrar_provider_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abuse_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid,
	"reporter_email" varchar(255),
	"category" varchar(30) NOT NULL,
	"status" varchar(30) DEFAULT 'OPEN' NOT NULL,
	"description" text,
	"internal_notes" text,
	"assigned_to" uuid,
	"escalated_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_abuse_cases_status" CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION', 'ACTION_REQUIRED', 'ESCALATED_TO_REGISTRAR', 'SUSPENDED', 'RESOLVED', 'REJECTED')),
	CONSTRAINT "chk_abuse_cases_category" CHECK (category IN ('PHISHING', 'MALWARE', 'FINANCIAL_FRAUD', 'IMPERSONATION', 'SPAM', 'TRADEMARK', 'ILLEGAL_CONTENT', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "abuse_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"abuse_case_id" uuid NOT NULL,
	"evidence_type" varchar(30) NOT NULL,
	"description" text,
	"file_path" varchar(500),
	"submitted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" uuid,
	"reason" text,
	"request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_type" varchar(20) NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"request_id" uuid,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_type" varchar(30) NOT NULL,
	"status" varchar(30) NOT NULL,
	"description" text,
	"domain_id" uuid,
	"user_id" uuid,
	"assigned_to" uuid,
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_compliance_cases_status" CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESPONDED', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "data_disclosures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"domain_id" uuid,
	"legal_request_id" uuid,
	"disclosed_to" varchar(255) NOT NULL,
	"data_categories" text[] NOT NULL,
	"disclosed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_document_id" uuid NOT NULL,
	"version" varchar(20) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"content_url" varchar(500) NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_legal_doc_versions_doc_version" UNIQUE("legal_document_id","version")
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_legal_documents_slug" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "legal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_type" varchar(30) NOT NULL,
	"requesting_authority" varchar(255) NOT NULL,
	"description" text,
	"compliance_case_id" uuid,
	"received_at" timestamp with time zone NOT NULL,
	"response_deadline" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legal_document_version_id" uuid NOT NULL,
	"order_id" uuid,
	"domain" varchar(255),
	"ip_address" varchar(45),
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"contact_type" varchar(20) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"company" varchar(200),
	"email" varchar(255),
	"phone" varchar(30),
	"address_line1" varchar(255),
	"address_line2" varchar(255),
	"city" varchar(100),
	"state" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(2),
	"provider_contact_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_dns_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"record_type" varchar(10) NOT NULL,
	"hostname" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"ttl" integer DEFAULT 3600 NOT NULL,
	"priority" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb,
	"source" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_nameservers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"hostname" varchar(255) NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fqdn" varchar(255) NOT NULL,
	"sld" varchar(200) NOT NULL,
	"tld" varchar(50) NOT NULL,
	"lifecycle_status" varchar(30) DEFAULT 'PENDING_REGISTRATION' NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"suspension_type" varchar(50),
	"suspension_reason" text,
	"suspended_at" timestamp with time zone,
	"is_transfer_locked" boolean DEFAULT true NOT NULL,
	"transfer_lock_updated_at" timestamp with time zone,
	"privacy_level" varchar(20),
	"privacy_updated_at" timestamp with time zone,
	"auto_renew_enabled" boolean DEFAULT false NOT NULL,
	"renew_option" varchar(30),
	"registrar_hold" boolean DEFAULT false NOT NULL,
	"provider_status" varchar(50),
	"provider_expiration_info" jsonb,
	"registrar_provider_id" uuid NOT NULL,
	"provider_domain_id" varchar(255),
	"registered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"registration_ended_at" timestamp with time zone,
	"registration_ended_reason" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_domains_lifecycle_status" CHECK (lifecycle_status IN ('PENDING_REGISTRATION', 'ACTIVE', 'INACTIVE', 'EXPIRED', 'REDEMPTION', 'PENDING_DELETE', 'DELETED', 'REGISTRATION_FAILED'))
);
--> statement-breakpoint
CREATE TABLE "registrar_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"order_item_id" uuid,
	"domain_id" uuid,
	"registrar_provider_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'QUEUED' NOT NULL,
	"operation_type" varchar(30) NOT NULL,
	"idempotency_key" varchar(500) NOT NULL,
	"provider_request_id" uuid,
	"provider_order_id" integer,
	"provider_response_code" integer,
	"provider_response_raw" text,
	"encryption_key_id" varchar(50),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_reg_ops_status" CHECK (status IN ('QUEUED', 'PROCESSING', 'ACCEPTED', 'SUCCEEDED', 'UNKNOWN', 'RETRY_PENDING', 'FAILED', 'MANUAL_REVIEW', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "registrar_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" varchar(30) NOT NULL,
	"provider_name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_registrar_providers_provider_id" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid,
	"order_id" uuid,
	"registrar_operation_id" uuid,
	"status" varchar(30) DEFAULT 'INITIATED' NOT NULL,
	"direction" varchar(10) NOT NULL,
	"auth_code_hash" varchar(255),
	"gaining_registrar" varchar(100),
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_transfers_status" CHECK (status IN ('INITIATED', 'AUTH_CODE_SUBMITTED', 'PENDING_APPROVAL', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "registrar_provider_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tld_id" uuid NOT NULL,
	"registrar_provider_id" uuid NOT NULL,
	"operation" varchar(20) NOT NULL,
	"years" integer DEFAULT 1 NOT NULL,
	"provider_cost_minor" bigint NOT NULL,
	"provider_cost_currency" varchar(3) NOT NULL,
	"retail_price_minor" bigint NOT NULL,
	"retail_price_currency" varchar(3) NOT NULL,
	"markup_type" varchar(10),
	"markup_value" integer,
	"is_promotion" boolean DEFAULT false NOT NULL,
	"promotion_price_minor" bigint,
	"promotion_starts_at" timestamp with time zone,
	"promotion_ends_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_provider_prices_tld_provider_op_years" UNIQUE("tld_id","registrar_provider_id","operation","years")
);
--> statement-breakpoint
CREATE TABLE "tlds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tld" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"supports_privacy" boolean DEFAULT false NOT NULL,
	"supports_transfer_lock" boolean DEFAULT true NOT NULL,
	"supports_dnssec" boolean DEFAULT false NOT NULL,
	"min_registration_years" integer DEFAULT 1 NOT NULL,
	"max_registration_years" integer DEFAULT 10 NOT NULL,
	"is_premium_supported" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tlds_tld" UNIQUE("tld")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(20) NOT NULL,
	"issued_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_invoices_invoice_number" UNIQUE("invoice_number"),
	CONSTRAINT "chk_invoices_status" CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'VOID', 'REFUNDED'))
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"gateway_response_code" varchar(50),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'CREATED' NOT NULL,
	"payment_provider_id" varchar(30),
	"provider_payment_id" varchar(255),
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"method" varchar(30),
	"gateway_response" text,
	"encryption_key_id" varchar(50),
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_payments_status" CHECK (status IN ('CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'CREATED' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"reason" text NOT NULL,
	"provider_refund_id" varchar(255),
	"initiated_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_refunds_status" CHECK (status IN ('CREATED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"to_email" varchar(255) NOT NULL,
	"template" varchar(50) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"provider" varchar(30),
	"provider_message_id" varchar(255),
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_email_logs_status" CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"value" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_feature_flags_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "job_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_name" varchar(50) NOT NULL,
	"job_id" varchar(100) NOT NULL,
	"status" varchar(20) NOT NULL,
	"payload_summary" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_job_records_status" CHECK (status IN ('QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"value_type" varchar(20) NOT NULL,
	"description" text,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_system_settings_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20) DEFAULT 'dynadot' NOT NULL,
	"provider_event_id" varchar(100) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"processing_error" text,
	"raw_payload" text NOT NULL,
	"encryption_key_id" varchar(50),
	"raw_payload_expires_at" timestamp with time zone NOT NULL,
	"signature_valid" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_webhook_events_provider_event" UNIQUE("provider","provider_event_id"),
	CONSTRAINT "chk_webhook_events_status" CHECK (processing_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_credentials" ADD CONSTRAINT "password_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_registrar_provider_id_registrar_providers_id_fk" FOREIGN KEY ("registrar_provider_id") REFERENCES "public"."registrar_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_registrar_provider_id_registrar_providers_id_fk" FOREIGN KEY ("registrar_provider_id") REFERENCES "public"."registrar_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_cases" ADD CONSTRAINT "abuse_cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_evidence" ADD CONSTRAINT "abuse_evidence_abuse_case_id_abuse_cases_id_fk" FOREIGN KEY ("abuse_case_id") REFERENCES "public"."abuse_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_evidence" ADD CONSTRAINT "abuse_evidence_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_cases" ADD CONSTRAINT "compliance_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_cases" ADD CONSTRAINT "compliance_cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_disclosures" ADD CONSTRAINT "data_disclosures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_disclosures" ADD CONSTRAINT "data_disclosures_legal_request_id_legal_requests_id_fk" FOREIGN KEY ("legal_request_id") REFERENCES "public"."legal_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_disclosures" ADD CONSTRAINT "data_disclosures_disclosed_by_users_id_fk" FOREIGN KEY ("disclosed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_versions" ADD CONSTRAINT "fk_legal_doc_ver_doc" FOREIGN KEY ("legal_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_requests" ADD CONSTRAINT "legal_requests_compliance_case_id_compliance_cases_id_fk" FOREIGN KEY ("compliance_case_id") REFERENCES "public"."compliance_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_legal_acceptances" ADD CONSTRAINT "user_legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_legal_acceptances" ADD CONSTRAINT "fk_legal_accept_ver" FOREIGN KEY ("legal_document_version_id") REFERENCES "public"."legal_document_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_contacts" ADD CONSTRAINT "domain_contacts_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_dns_records" ADD CONSTRAINT "domain_dns_records_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_nameservers" ADD CONSTRAINT "domain_nameservers_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_registrar_provider_id_registrar_providers_id_fk" FOREIGN KEY ("registrar_provider_id") REFERENCES "public"."registrar_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrar_operations" ADD CONSTRAINT "fk_reg_ops_provider" FOREIGN KEY ("registrar_provider_id") REFERENCES "public"."registrar_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_registrar_operation_id_registrar_operations_id_fk" FOREIGN KEY ("registrar_operation_id") REFERENCES "public"."registrar_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrar_provider_prices" ADD CONSTRAINT "registrar_provider_prices_tld_id_tlds_id_fk" FOREIGN KEY ("tld_id") REFERENCES "public"."tlds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrar_provider_prices" ADD CONSTRAINT "fk_prices_provider" FOREIGN KEY ("registrar_provider_id") REFERENCES "public"."registrar_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email_canonical" ON "users" USING btree ("email_canonical");--> statement-breakpoint
CREATE INDEX "idx_orders_user_id" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quotes_user_id" ON "quotes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_expires_at" ON "quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_abuse_cases_status" ON "abuse_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_abuse_cases_domain_id" ON "abuse_cases" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor_id" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_domains_fqdn_active" ON "domains" USING btree ("fqdn") WHERE registration_ended_at IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_domains_provider_domain" ON "domains" USING btree ("registrar_provider_id","provider_domain_id") WHERE provider_domain_id IS NOT NULL AND registration_ended_at IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_domains_user_id" ON "domains" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_domains_expires_at" ON "domains" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_domains_lifecycle_status" ON "domains" USING btree ("lifecycle_status");--> statement-breakpoint
CREATE INDEX "idx_domains_registrar_provider_id" ON "domains" USING btree ("registrar_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_registrar_ops_idempotency" ON "registrar_operations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_reg_ops_order_id" ON "registrar_operations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_reg_ops_domain_id" ON "registrar_operations" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "idx_reg_ops_status" ON "registrar_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_reg_ops_provider_order_id" ON "registrar_operations" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_domain_id" ON "transfers" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_status" ON "transfers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_provider_payment" ON "payments" USING btree ("payment_provider_id","provider_payment_id") WHERE provider_payment_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_payments_order_id" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_refunds_payment_id" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_refunds_status" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_expiry" ON "webhook_events" USING btree ("raw_payload_expires_at") WHERE raw_payload IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_webhook_events_processing_status" ON "webhook_events" USING btree ("processing_status");