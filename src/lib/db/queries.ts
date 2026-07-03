import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./index";
import {
  interviews,
  messages,
  reports,
  startups,
  type NewInterview,
  type NewMessage,
  type ReportContent,
} from "./schema";

export async function listStartupsByUser(userId: string) {
  return db
    .select()
    .from(startups)
    .where(eq(startups.userId, userId))
    .orderBy(desc(startups.createdAt));
}

export async function createStartup(userId: string, name: string) {
  const [row] = await db.insert(startups).values({ userId, name }).returning();
  return row;
}

export async function getStartupById(id: string) {
  const [row] = await db.select().from(startups).where(eq(startups.id, id)).limit(1);
  return row;
}

export async function createInterview(
  userId: string,
  startupId: string,
  title?: string,
) {
  const data: NewInterview = {
    userId,
    startupId,
    title: title ?? "Entrevista sin título",
  };
  const [row] = await db.insert(interviews).values(data).returning();
  return row;
}

export async function getInterviewForUser(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
    .limit(1);
  return row;
}

export async function listInterviewsForUser(userId: string) {
  return db
    .select()
    .from(interviews)
    .where(eq(interviews.userId, userId))
    .orderBy(desc(interviews.updatedAt));
}

export async function listMessages(interviewId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.interviewId, interviewId))
    .orderBy(asc(messages.createdAt));
}

export async function addMessage(input: NewMessage) {
  const [row] = await db.insert(messages).values(input).returning();
  await db
    .update(interviews)
    .set({ updatedAt: new Date() })
    .where(eq(interviews.id, input.interviewId));
  return row;
}

export async function saveReport(
  interviewId: string,
  content: ReportContent,
  title: string,
) {
  const [row] = await db
    .insert(reports)
    .values({ interviewId, content })
    .onConflictDoUpdate({
      target: reports.interviewId,
      set: { content },
    })
    .returning();
  await db
    .update(interviews)
    .set({ status: "completed", title, updatedAt: new Date() })
    .where(eq(interviews.id, interviewId));
  return row;
}

export async function getInterviewById(id: string) {
  const [row] = await db
    .select()
    .from(interviews)
    .where(eq(interviews.id, id))
    .limit(1);
  return row;
}

export async function listAllInterviews() {
  return db
    .select()
    .from(interviews)
    .orderBy(desc(interviews.updatedAt));
}

export async function getReport(interviewId: string) {
  const [row] = await db
    .select()
    .from(reports)
    .where(eq(reports.interviewId, interviewId))
    .limit(1);
  return row;
}
