/**
 * Backfill: crea una startup 1:1 por cada interview existente que todavía
 * no tenga startupId, y le asigna ese startupId a la entrevista.
 *
 * name de la startup = interviews.title (o "Startup sin nombre" si es null).
 *
 * Uso:
 *   npx tsx scripts/backfill-startups.ts
 *
 * Nota: el driver neon-http no soporta transacciones, así que cada fila
 * se procesa en su propio insert + update (aceptable para un backfill
 * de un puñado de filas).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { eq, isNull } from "drizzle-orm";
import { db } from "../src/lib/db";
import { interviews, startups } from "../src/lib/db/schema";

async function main() {
  const pending = await db
    .select({ id: interviews.id, userId: interviews.userId, title: interviews.title })
    .from(interviews)
    .where(isNull(interviews.startupId));

  console.log(`Entrevistas sin startupId: ${pending.length}`);

  for (const interview of pending) {
    const name = interview.title ?? "Startup sin nombre";

    const [startup] = await db
      .insert(startups)
      .values({ userId: interview.userId, name })
      .returning({ id: startups.id });

    await db
      .update(interviews)
      .set({ startupId: startup.id })
      .where(eq(interviews.id, interview.id));

    console.log(
      `interview ${interview.id} -> startup ${startup.id} ("${name}")`,
    );
  }

  console.log("Backfill completo.");
}

main().catch((err) => {
  console.error("Error en el backfill:", err);
  process.exit(1);
});
