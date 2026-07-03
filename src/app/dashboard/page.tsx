import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { listInterviewsForUser, listStartupsByUser } from "@/lib/db/queries";
import { createStartupAndStartInterview, startInterview } from "@/app/actions";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [interviews, userStartups] = await Promise.all([
    listInterviewsForUser(userId),
    listStartupsByUser(userId),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="font-semibold tracking-tight">
          Startup Advisor
        </Link>
        <UserButton />
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Tus entrevistas
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cada entrevista termina en un informe con recomendaciones.
          </p>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold tracking-tight">
            Nueva entrevista
          </h2>

          {userStartups.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Elige una startup existente:
              </p>
              <ul className="flex flex-wrap gap-2">
                {userStartups.map((s) => (
                  <li key={s.id}>
                    <form action={startInterview.bind(null, s.id)}>
                      <button
                        type="submit"
                        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
                      >
                        {s.name}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {userStartups.length > 0
                ? "O crea una nueva startup:"
                : "Aún no tienes ninguna startup. Crea una para empezar:"}
            </p>
            <form
              action={createStartupAndStartInterview}
              className="flex gap-2"
            >
              <input
                type="text"
                name="name"
                required
                placeholder="Nombre de la startup"
                className="flex-1 rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm dark:border-zinc-700"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Crear y empezar
              </button>
            </form>
          </div>
        </section>

        {interviews.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">
              Aún no tienes ninguna entrevista. Elige o crea una startup
              arriba para empezar.
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
                    <span className="text-xs text-zinc-500">
                      {new Date(it.updatedAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
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
