import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Chat } from "@/components/chat";
import { getInterviewForUser, listMessages } from "@/lib/db/queries";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const interview = await getInterviewForUser(id, userId);
  if (!interview) notFound();

  if (interview.status === "completed") {
    redirect(`/interview/${id}/report`);
  }

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
        <Link href="/dashboard" className="font-semibold tracking-tight">
          ← Mis entrevistas
        </Link>
        <UserButton />
      </header>
      <Chat interviewId={id} initialMessages={initialMessages} />
    </div>
  );
}
