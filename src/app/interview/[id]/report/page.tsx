import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getInterviewById, getInterviewForUser, getReport } from "@/lib/db/queries";
import { isSupervisor } from "@/lib/supervisor";

export default async function ReportPage({
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

  const report = await getReport(id);
  if (!report) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold">Informe no disponible</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Esta entrevista aún no ha generado un informe.
          </p>
          <Link
            href={`/interview/${id}`}
            className="inline-flex w-fit self-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Volver a la entrevista
          </Link>
        </div>
      </div>
    );
  }

  const r = report.content;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          ← Mis entrevistas
        </Link>
        <UserButton />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
        <div className="flex flex-col gap-3">
          <span className="inline-block w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Informe de diagnóstico
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            {interview.title}
          </h1>
          <p className="text-sm text-zinc-500">
            Fase estimada:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {r.fase_estimada}
            </span>
          </p>
        </div>

        <Section title="Resumen ejecutivo">
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            {r.resumen_ejecutivo}
          </p>
        </Section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title="Fortalezas">
            <ul className="flex flex-col gap-2 text-sm leading-relaxed">
              {r.fortalezas.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Debilidades y riesgos">
            <ul className="flex flex-col gap-2 text-sm leading-relaxed">
              {r.debilidades.map((d, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-amber-600 dark:text-amber-400">!</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <Section title="Recomendaciones">
          <div className="flex flex-col gap-4">
            {r.recomendaciones.map((rec, i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">{rec.titulo}</h3>
                  <PriorityPill p={rec.prioridad} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {rec.descripcion}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Próximos pasos (2-4 semanas)">
          <ol className="flex flex-col gap-2 text-sm leading-relaxed">
            {r.proximos_pasos.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium text-zinc-500">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="flex gap-3 pt-4">
          <Link
            href="/dashboard"
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Volver al panel
          </Link>
          <a
            href={`/api/interview/${id}/report/pdf`}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Descargar PDF
          </a>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function PriorityPill({ p }: { p: "alta" | "media" | "baja" }) {
  const styles = {
    alta: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    media: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    baja: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  } as const;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[p]}`}
    >
      Prioridad {p}
    </span>
  );
}
