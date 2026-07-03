import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { notFound, redirect } from "next/navigation";
import { listAllInterviews } from "@/lib/db/queries";
import { isSupervisor } from "@/lib/supervisor";

export default async function SupervisorPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!isSupervisor(userId)) notFound();

  const interviews = await listAllInterviews();

  const completed = interviews.filter((i) => i.status === "completed");
  const inProgress = interviews.filter((i) => i.status === "in_progress");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="font-semibold tracking-tight">
          Startup Advisor
        </Link>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Supervisor
          </span>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Vista de supervisor
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {interviews.length} entrevistas en total · {completed.length} con
            informe · {inProgress.length} en curso
          </p>
        </div>

        {interviews.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">
              Todavía no hay ninguna entrevista en el sistema.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {interviews.map((it) => (
              <li key={it.id}>
                <Link
                  href={
                    it.status === "completed"
                      ? `/interview/${it.id}/report`
                      : `/interview/${it.id}`
                  }
                  className="flex items-center justify-between rounded-2xl border border-zinc-200 p-5 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-medium">{it.title}</span>
                    <span className="truncate text-xs text-zinc-400 font-mono">
                      {it.userId}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(it.updatedAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      it.status === "completed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {it.status === "completed" ? "Informe listo" : "En curso"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
