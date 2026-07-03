import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const interviewStatus = pgEnum("interview_status", [
  "in_progress",
  "completed",
]);

export const messageRole = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

export const startups = pgTable(
  "startups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("startups_user_id_idx").on(table.userId)],
);

export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    startupId: uuid("startup_id").notNull().references(() => startups.id),
    title: text("title").notNull().default("Entrevista sin título"),
    status: interviewStatus("status").notNull().default("in_progress"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("interviews_user_id_idx").on(table.userId),
    index("interviews_startup_id_idx").on(table.startupId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("messages_interview_id_idx").on(table.interviewId)],
);

export type MethodologicalFinding = { rule_id: string; hallazgos: string[] };

export type ReportContent = {
  resumen_ejecutivo: string;
  fase_estimada: string;
  fortalezas: string[];
  debilidades: string[];
  recomendaciones: Array<{
    titulo: string;
    descripcion: string;
    prioridad: "alta" | "media" | "baja";
  }>;
  proximos_pasos: string[];
  consideraciones_metodologicas?: MethodologicalFinding[];
};

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviews.id, { onDelete: "cascade" })
    .unique(),
  content: jsonb("content").$type<ReportContent>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Startup = typeof startups.$inferSelect;
export type NewStartup = typeof startups.$inferInsert;
export type Interview = typeof interviews.$inferSelect;
export type NewInterview = typeof interviews.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Report = typeof reports.$inferSelect;
