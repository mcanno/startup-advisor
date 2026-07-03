import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold tracking-tight">Startup Advisor</div>
        <nav className="flex items-center gap-3">
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="text-sm font-medium hover:underline"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Crear cuenta
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="text-sm font-medium hover:underline"
            >
              Mi panel
            </Link>
            <UserButton />
          </Show>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-24">
        <div className="w-full max-w-3xl flex flex-col gap-10">
          <div className="flex flex-col gap-5">
            <span className="inline-block w-fit rounded-full bg-zinc-200/70 px-3 py-1 text-xs font-medium tracking-wide text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300">
              Diagnóstico para emprendedores
            </span>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Un asesor IA que entrevista tu startup y te dice qué hacer ahora.
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Una conversación de 10-15 minutos. El agente entiende en qué fase
              estás, identifica fortalezas y riesgos, y te entrega un informe
              con recomendaciones priorizadas y próximos pasos concretos.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Empezar gratis
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-base font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Ya tengo cuenta
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Ir a mi panel
              </Link>
            </Show>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-10 sm:grid-cols-3">
            <Feature
              title="1. Entrevista"
              body="El agente te hace preguntas adaptadas a tu situación, una a una."
            />
            <Feature
              title="2. Diagnóstico"
              body="Cuando ha entendido suficiente, cierra la entrevista y produce el informe."
            />
            <Feature
              title="3. Próximos pasos"
              body="Recibes recomendaciones priorizadas y un plan de acción de 2-4 semanas."
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}
