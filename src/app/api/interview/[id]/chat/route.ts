import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropic,
  MAX_TOKENS,
  MODEL,
  PRODUCE_REPORT_TOOL,
  SYSTEM_PROMPT,
} from "@/lib/anthropic";
import {
  addMessage,
  getInterviewForUser,
  getStartupById,
  listMessages,
  saveReport,
} from "@/lib/db/queries";
import type { ReportContent } from "@/lib/db/schema";
import { runOntologyReasoning } from "@/lib/ontologyReasoning";

export const runtime = "nodejs";
export const maxDuration = 120;

type ChatRequestBody = {
  userMessage: string;
};

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: interviewId } = await ctx.params;

  const interview = await getInterviewForUser(interviewId, userId);
  if (!interview) {
    return new Response("Not found", { status: 404 });
  }
  if (interview.status === "completed") {
    return new Response("Interview already completed", { status: 409 });
  }

  const body = (await request.json()) as ChatRequestBody;
  const userMessage = body.userMessage?.trim();
  if (!userMessage) {
    return new Response("userMessage is required", { status: 400 });
  }

  await addMessage({
    interviewId,
    role: "user",
    content: userMessage,
  });

  const history = await listMessages(interviewId);
  const apiMessages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const send = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    payload: unknown,
  ) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const msgStream = getAnthropic().messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [PRODUCE_REPORT_TOOL],
          messages: apiMessages,
        });

        msgStream.on("text", (delta) => {
          send(controller, { type: "text", text: delta });
        });

        const finalMessage = await msgStream.finalMessage();

        const toolUse = finalMessage.content.find(
          (block): block is Anthropic.ToolUseBlock =>
            block.type === "tool_use" && block.name === "produce_report",
        );

        const assistantText = finalMessage.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");

        if (assistantText.trim().length > 0) {
          await addMessage({
            interviewId,
            role: "assistant",
            content: assistantText,
          });
        }

        if (toolUse) {
          const report = toolUse.input as ReportContent;
          const title =
            report.resumen_ejecutivo.split(".")[0].slice(0, 80) ||
            "Informe de diagnóstico";

          let reportToSave: ReportContent = report;
          try {
            const startup = await getStartupById(interview.startupId);
            if (!startup) {
              throw new Error(`startup ${interview.startupId} no encontrada`);
            }

            const transcript: { role: "user" | "assistant"; content: string }[] =
              history
                .filter((m) => m.role !== "system")
                .map((m) => ({
                  role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
                  content: m.content,
                }));
            if (assistantText.trim().length > 0) {
              transcript.push({ role: "assistant", content: assistantText });
            }

            const hallazgos = await runOntologyReasoning(
              interview.startupId,
              startup.name,
              userId,
              transcript,
            );
            if (hallazgos) {
              reportToSave = { ...report, consideraciones_metodologicas: hallazgos };
            }
          } catch (err) {
            console.error(
              `ontology-engine: fallo en el razonamiento post-entrevista (interview=${interviewId}, startup=${interview.startupId})`,
              err,
            );
          }

          await saveReport(interviewId, reportToSave, title);
          send(controller, { type: "report_ready" });
        }

        send(controller, { type: "done" });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send(controller, { type: "error", error: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
