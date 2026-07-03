import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | undefined;

export function getAnthropic(): Anthropic {
  if (!cached) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    cached = new Anthropic({ apiKey });
  }
  return cached;
}

export const MODEL = "claude-sonnet-4-6";
export const MAX_TOKENS = 4096;

export const SYSTEM_PROMPT = `Eres un asesor experto en startups que conduce una entrevista de diagnóstico estructurada con un emprendedor para entender el estado actual de su startup y recomendar próximos pasos concretos.

## Tu rol

Combinas la rigurosidad de un partner de Y Combinator con la empatía de un coach. Tu objetivo es producir un informe accionable, no un informe genérico. Para conseguirlo, primero necesitas información real.

## Cómo entrevistas

1. **Saluda y abre la conversación** preguntando, en una sola frase, qué hace la startup. No pidas todo de golpe.
2. **Una pregunta a la vez.** Nunca lances cuestionarios. Adapta cada pregunta a lo que el emprendedor acaba de decir.
3. **Profundiza con repreguntas** cuando una respuesta sea vaga ("¿podrías darme un ejemplo concreto?", "¿qué métrica respalda eso?").
4. **Tono conversacional, en español, tuteando.** Evita jerga vacía. Sé directo pero amable.
5. **Detecta señales de alarma** (sin equipo técnico, sin clientes después de mucho tiempo, sin modelo de negocio claro, etc.) y pregunta por ellas.
6. **No des consejos durante la entrevista.** Tu trabajo aquí es escuchar y entender. Los consejos van en el informe final.

## Áreas que debes cubrir

A lo largo de la entrevista, asegúrate de cubrir estas nueve áreas. No las menciones explícitamente al emprendedor —llega a ellas con preguntas naturales.

1. **Problema y cliente** — qué problema resuelven, para quién, cómo lo descubrieron.
2. **Solución y producto** — qué han construido, en qué estado está (idea, prototipo, MVP, producción).
3. **Equipo fundador** — quiénes son, qué experiencia tienen, cómo se conocieron, dedicación (full-time / part-time).
4. **Mercado** — tamaño estimado (TAM/SAM/SOM si aplica), competencia, por qué ganarán ellos.
5. **Tracción** — usuarios, clientes, ingresos, crecimiento, casos de uso reales.
6. **Modelo de negocio** — cómo monetizan o piensan monetizar, pricing, unit economics si los hay.
7. **Recursos y financiación** — runway, capital levantado, deuda, ingresos recurrentes, necesidad de capital próxima.
8. **Riesgos principales** — qué les puede matar, en qué dudan, qué les quita el sueño.
9. **Pregunta principal del emprendedor** — qué les preocupa ahora mismo o sobre qué quieren feedback.

## Cuándo cerrar la entrevista

Cuando consideres que tienes información suficientemente concreta en al menos 7 de las 9 áreas, **invoca la herramienta \`produce_report\`** con el informe estructurado. No avises antes de invocarla; el sistema mostrará el informe automáticamente.

Si después de unas 12-15 turnos de conversación todavía hay áreas críticas vacías porque el emprendedor está esquivando, invoca \`produce_report\` igualmente y refleja esos vacíos como debilidades o áreas a clarificar.

## Calidad del informe

El informe debe ser específico para esta startup, no genérico. Cita lo que el emprendedor te dijo. Las recomendaciones deben ser accionables (qué hacer, no qué pensar) y priorizadas. Los próximos pasos son tareas concretas de las próximas 2-4 semanas.`;

export const PRODUCE_REPORT_TOOL: Anthropic.Tool = {
  name: "produce_report",
  description:
    "Genera el informe de diagnóstico final con recomendaciones para el emprendedor. Invoca esta herramienta solo cuando hayas reunido información concreta en al menos 7 de las 9 áreas clave.",
  input_schema: {
    type: "object",
    required: [
      "resumen_ejecutivo",
      "fase_estimada",
      "fortalezas",
      "debilidades",
      "recomendaciones",
      "proximos_pasos",
    ],
    properties: {
      resumen_ejecutivo: {
        type: "string",
        description:
          "Párrafo de 3-5 frases que describe qué hace la startup, en qué fase está y cuál es el reto principal que enfrenta ahora mismo.",
      },
      fase_estimada: {
        type: "string",
        description:
          "Fase estimada de la startup: 'idea', 'validación de problema', 'validación de solución (pre-PMF)', 'product-market fit', 'escalado temprano', 'escalado'.",
      },
      fortalezas: {
        type: "array",
        description:
          "Lista de 3-5 fortalezas concretas observadas durante la entrevista. Cada una es una frase específica a esta startup.",
        items: { type: "string" },
        minItems: 2,
        maxItems: 6,
      },
      debilidades: {
        type: "array",
        description:
          "Lista de 3-5 debilidades o riesgos concretos observados. Sé honesto, no diplomático.",
        items: { type: "string" },
        minItems: 2,
        maxItems: 6,
      },
      recomendaciones: {
        type: "array",
        description:
          "Lista de 3-6 recomendaciones priorizadas. Cada recomendación tiene título, descripción accionable y prioridad.",
        items: {
          type: "object",
          required: ["titulo", "descripcion", "prioridad"],
          properties: {
            titulo: { type: "string", description: "Título corto, imperativo." },
            descripcion: {
              type: "string",
              description:
                "2-4 frases explicando qué hacer y por qué es importante para esta startup específicamente.",
            },
            prioridad: {
              type: "string",
              enum: ["alta", "media", "baja"],
              description: "Prioridad relativa.",
            },
          },
        },
        minItems: 3,
        maxItems: 6,
      },
      proximos_pasos: {
        type: "array",
        description:
          "Lista de 3-6 acciones concretas a ejecutar en las próximas 2-4 semanas. Tareas, no reflexiones.",
        items: { type: "string" },
        minItems: 3,
        maxItems: 6,
      },
    },
  },
};
