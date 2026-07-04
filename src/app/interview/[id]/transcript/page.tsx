import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Chat } from "@/components/chat";
import {
  getInterviewById,
  getInterviewForUser,
  listMessages,
} from "@/lib/db/queries";
import { isSupervisor } from "@/lib/supervisor";

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const supervisor = isSupervisor(userId);
  const interview = supervisor
    ? await getInterviewById(id)
    : await getInterviewForUser(id, userId);
  if (!interview) notFound();

  const dbMessages = await listMessages(id);
  const initialMessages = dbMessages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          href={
            interview.status === "completed"
              ? `/interview/${id}/report`
              : "/dashboard"
          }
          className="font-semibold tracking-tight"
        >
          ← {interview.status === "completed" ? "Volver al informe" : "Mis entrevistas"}
        </Link>
        <UserButton />
      </header>
      <Chat interviewId={id} initialMessages={initialMessages} readOnly />
    </div>
  );
}
