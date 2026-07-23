import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL } from "./anthropic";
import type { MethodologicalFinding } from "./db/schema";
import { getPrerequisitos, getSubclasses, type Prerequisito } from "./ontologyEngine";

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

// Reemplaza el registro de individuals reales (ontology-engine es TBox puro
// desde la conversión a servicio de solo consulta, ver
// startup-next/diseno_ontology_engine_solo_consulta.md, Opción C): en vez de
// escribir hechos y correr validate() contra ellos, solo identificamos qué
// conceptos del TBox tocó la entrevista, sin persistir nada.
async function identificarConceptosTocados(transcript: TranscriptMessage[]): Promise<Set<string>> {
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

  const conceptos = new Set<string>();
  for (const call of toolCalls) {
    const baseConcept = BASE_CONCEPT_BY_TOOL[call.name];
    if (!baseConcept) continue;
    const input = call.input as { label: string; tipo_especifico?: string };
    conceptos.add(input.tipo_especifico || baseConcept);
  }
  return conceptos;
}

// Mismo encuadre que orchestratorModoBase.ts (FRASE_ENCUADRE) en startup-next:
// información metodológica general del TBox, nunca una evaluación de hechos
// reales de esta startup (no hay ningún hecho real contra qué evaluar).
const FRASE_ENCUADRE =
  "Información general sobre el orden metodológico habitual de esta tarea según Lean Startup — no es una evaluación de hechos reales verificados de tu startup.";

function narrarPrerequisitos(conceptId: string, prerequisitos: Prerequisito[]): string {
  const ordenados = [...prerequisitos].sort((a, b) => a.distancia - b.distancia);
  const pasos = ordenados.map((p, i) => {
    const conector = i === 0 ? "conviene haber trabajado en" : "y antes de eso en";
    return `${conector} ${p.concept_id} (vía ${p.relacion})`;
  });
  return `${FRASE_ENCUADRE} Antes de ${conceptId}, ${pasos.join("; ")}.`;
}

async function buildConsideracionesMetodologicas(
  conceptos: Set<string>,
): Promise<MethodologicalFinding[]> {
  const hallazgos: string[] = [];
  for (const conceptId of conceptos) {
    const prerequisitos = await getPrerequisitos(conceptId);
    if (prerequisitos.length > 0) {
      hallazgos.push(narrarPrerequisitos(conceptId, prerequisitos));
    }
  }
  return hallazgos.length > 0 ? [{ rule_id: "PREREQUISITO_GENERICO", hallazgos }] : [];
}

/**
 * Identifica, a partir de la transcripción, qué conceptos del TBox (Lean
 * Startup) mencionó el fundador durante la entrevista, y devuelve — para
 * los que tienen prerrequisitos metodológicos genéricos en la ontología —
 * consideraciones para incluir en el informe. No escribe ni consulta ningún
 * hecho real de esta startup (ontology-engine es TBox puro). Devuelve
 * undefined si no hay nada que reportar.
 */
export async function runOntologyReasoning(
  transcript: TranscriptMessage[],
): Promise<MethodologicalFinding[] | undefined> {
  const conceptos = await identificarConceptosTocados(transcript);
  const findings = await buildConsideracionesMetodologicas(conceptos);
  return findings.length > 0 ? findings : undefined;
}
