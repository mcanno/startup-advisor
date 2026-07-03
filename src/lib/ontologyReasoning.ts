import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL } from "./anthropic";
import type { MethodologicalFinding } from "./db/schema";
import {
  createIndividual,
  getStartupGraph,
  getSubclasses,
  validateStartup,
} from "./ontologyEngine";

type TranscriptMessage = { role: "user" | "assistant"; content: string };

const CLAUDE_EXTRACTION_TIMEOUT_MS = 15_000;

const EXTRACTION_SYSTEM_PROMPT =
  "Extrae de esta conversación cualquier hipótesis, experimento, MVP o métrica que el fundador haya mencionado, usando las herramientas disponibles. Si no se mencionó nada de un tipo, no llames a esa herramienta.";

const BASE_CONCEPT_BY_TOOL: Record<string, string> = {
  record_hypothesis: "Hypothesis",
  record_experiment: "Experiment",
  record_mvp: "MVP",
  record_metric: "Metric",
};

async function ensureCoreIndividuals(
  startupId: string,
  startupName: string,
  founderUserId: string,
): Promise<void> {
  const graph = await getStartupGraph(startupId);
  const existingConcepts = new Set(
    (graph.individuals as Array<{ concept_id: string }>).map((i) => i.concept_id),
  );

  if (!existingConcepts.has("Startup")) {
    await createIndividual(startupId, {
      id: startupId,
      concept_id: "Startup",
      label: startupName,
    });
  }
  if (!existingConcepts.has("Founder")) {
    await createIndividual(startupId, {
      id: founderUserId,
      concept_id: "Founder",
      label: "Fundador",
    });
  }
}

async function buildRecordTools(): Promise<Anthropic.Tool[]> {
  const [hypothesisTypes, metricTypes] = await Promise.all([
    getSubclasses("Hypothesis"),
    getSubclasses("Metric"),
  ]);

  return [
    {
      name: "record_hypothesis",
      description:
        "Registra una hipótesis de negocio no probada que el fundador mencionó durante la entrevista.",
      input_schema: {
        type: "object",
        required: ["label"],
        properties: {
          label: { type: "string", description: "Descripción corta de la hipótesis." },
          ...(hypothesisTypes.length > 0
            ? {
                tipo_especifico: {
                  type: "string",
                  enum: hypothesisTypes,
                  description: "Subtipo más específico de hipótesis, si aplica claramente.",
                },
              }
            : {}),
        },
      },
    },
    {
      name: "record_experiment",
      description:
        "Registra un experimento que el fundador dijo haber diseñado o ejecutado para validar una hipótesis.",
      input_schema: {
        type: "object",
        required: ["label"],
        properties: {
          label: { type: "string", description: "Descripción corta del experimento." },
        },
      },
    },
    {
      name: "record_mvp",
      description: "Registra un producto mínimo viable (MVP) que el fundador mencionó haber construido.",
      input_schema: {
        type: "object",
        required: ["label"],
        properties: {
          label: { type: "string", description: "Descripción corta del MVP." },
        },
      },
    },
    {
      name: "record_metric",
      description: "Registra una métrica que el fundador mencionó usar para evaluar el progreso del negocio.",
      input_schema: {
        type: "object",
        required: ["label"],
        properties: {
          label: { type: "string", description: "Descripción corta de la métrica." },
          ...(metricTypes.length > 0
            ? {
                tipo_especifico: {
                  type: "string",
                  enum: metricTypes,
                  description: "Subtipo más específico de métrica, si aplica claramente.",
                },
              }
            : {}),
        },
      },
    },
  ];
}

async function recordMentionedIndividuals(
  startupId: string,
  transcript: TranscriptMessage[],
): Promise<void> {
  const tools = await buildRecordTools();

  const response = await getAnthropic().messages.create(
    {
      model: MODEL,
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      tools,
      messages: [
        {
          role: "user",
          content: transcript.map((m) => `[${m.role}] ${m.content}`).join("\n\n"),
        },
      ],
    },
    { timeout: CLAUDE_EXTRACTION_TIMEOUT_MS },
  );

  const toolCalls = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  for (const call of toolCalls) {
    const baseConcept = BASE_CONCEPT_BY_TOOL[call.name];
    if (!baseConcept) continue;
    const input = call.input as { label: string; tipo_especifico?: string };
    await createIndividual(startupId, {
      id: randomUUID(),
      concept_id: input.tipo_especifico || baseConcept,
      label: input.label,
    });
  }
}

/**
 * Orquesta el razonamiento post-entrevista contra el ontology-engine:
 * asegura Startup+Founder, registra hipótesis/experimentos/MVPs/métricas
 * mencionados (con tools construidas dinámicamente a partir de los
 * subtipos actuales del TBox), y corre el motor de reglas. Devuelve los
 * hallazgos (si los hay) para incluir en el informe, o undefined si no
 * hay nada que reportar. No hace relaciones entre instancias todavía.
 */
export async function runOntologyReasoning(
  startupId: string,
  startupName: string,
  founderUserId: string,
  transcript: TranscriptMessage[],
): Promise<MethodologicalFinding[] | undefined> {
  await ensureCoreIndividuals(startupId, startupName, founderUserId);
  await recordMentionedIndividuals(startupId, transcript);

  const validation = await validateStartup(startupId);
  const findings = Object.entries(validation)
    .map(([rule_id, rule]) => ({
      rule_id,
      hallazgos: (rule as { hallazgos: string[] }).hallazgos,
    }))
    .filter((f) => f.hallazgos.length > 0);

  return findings.length > 0 ? findings : undefined;
}
