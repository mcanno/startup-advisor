-- NOTA (2026-07-02): las migraciones de Drizzle NO se aplican automáticamente
-- en el pipeline de deploy de Vercel (el build es solo "next build", sin paso
-- de migración). Aplicarlas es manual: hay que correr `npm run db:migrate`
-- (o `db:push`) a mano contra cada entorno.
--
-- Esta migración en particular salió como "baseline completa" (crea las 4
-- tablas) porque no existía historial previo de Drizzle en este repo, aunque
-- en desarrollo esas tablas ya existían (creadas antes con SQL directo). Por
-- eso se marcó como aplicada en `drizzle.__drizzle_migrations` SIN ejecutar
-- este archivo, para no chocar con los objetos ya existentes.
--
-- Antes de desplegar/migrar en un entorno nuevo (staging, producción, otro
-- proyecto): verifica manualmente con information_schema si "interviews",
-- "messages", "reports" y "startups" ya existen ahí. Si no existen, este SQL
-- se puede correr tal cual. Si ya existen, hay que replicar el mismo truco
-- de marcar la migración como aplicada sin ejecutarla (ver drizzle-orm
-- migrator.js: inserta una fila en drizzle.__drizzle_migrations con
-- created_at = el "when" de drizzle/meta/_journal.json para esta migración).

CREATE TYPE "public"."interview_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"startup_id" uuid,
	"title" text DEFAULT 'Entrevista sin título' NOT NULL,
	"status" "interview_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_interview_id_unique" UNIQUE("interview_id")
);
--> statement-breakpoint
CREATE TABLE "startups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interviews_user_id_idx" ON "interviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interviews_startup_id_idx" ON "interviews" USING btree ("startup_id");--> statement-breakpoint
CREATE INDEX "messages_interview_id_idx" ON "messages" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "startups_user_id_idx" ON "startups" USING btree ("user_id");