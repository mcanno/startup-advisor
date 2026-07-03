"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { addMessage, createInterview, createStartup } from "@/lib/db/queries";

const OPENING_MESSAGE =
  "¡Hola! Soy tu asesor de startups. Voy a hacerte algunas preguntas para entender en qué punto estás y luego te entregaré un informe con recomendaciones concretas.\n\nPara empezar: en una frase, ¿qué hace tu startup y para quién?";

export async function startInterview(startupId: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const interview = await createInterview(userId, startupId);
  await addMessage({
    interviewId: interview.id,
    role: "assistant",
    content: OPENING_MESSAGE,
  });
  redirect(`/interview/${interview.id}`);
}

export async function createStartupAndStartInterview(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("El nombre de la startup es obligatorio");
  }

  const startup = await createStartup(userId, name.trim());
  await startInterview(startup.id);
}
