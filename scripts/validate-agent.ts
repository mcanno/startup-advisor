/**
 * Validación del agente entrevistador.
 *
 * Corre una conversación end-to-end entre:
 *   - El asesor real (usa el system prompt y la tool de src/lib/anthropic.ts)
 *   - Un "fundador simulado" (otro Claude con una persona configurable)
 *
 * Uso:
 *   npx tsx scripts/validate-agent.ts [persona]
 *
 * persona: "solo-idea" | "mvp-sin-traccion" | "saas-con-traccion" | "tirando-balones"
 * (por defecto: "mvp-sin-traccion")
 */

import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import {
  MAX_TOKENS,
  MODEL,
  PRODUCE_REPORT_TOOL,
  SYSTEM_PROMPT,
} from "../src/lib/anthropic";

config({ path: ".env.local" });
config({ path: ".env.example" }); // fallback, no sobreescribe lo ya cargado

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY en .env.local");
  process.exit(1);
}

const OPENING_MESSAGE =
  "¡Hola! Soy tu asesor de startups. Voy a hacerte algunas preguntas para entender en qué punto estás y luego te entregaré un informe con recomendaciones concretas.\n\nPara empezar: en una frase, ¿qué hace tu startup y para quién?";

type Persona = {
  id: string;
  descripcion: string;
  hechos: string;
  estilo: string;
};

const personas: Record<string, Persona> = {
  "solo-idea": {
    id: "solo-idea",
    descripcion:
      "Founder solitario, ex-product manager, llevas 6 semanas dándole vueltas a una idea de marketplace de tutores particulares para preparar oposiciones en España.",
    hechos: `
- Estás en fase idea. No has escrito una línea de código todavía.
- Has hablado con 12 opositores potenciales y 5 tutores en Madrid.
- No tienes equipo técnico. Estás evaluando aprender a programar tú o buscar CTO.
- Tu trabajo anterior te dejó 18 meses de runway personal.
- El competidor más claro es Superprof, pero crees que el nicho de oposiciones está mal atendido.
- Tu mayor miedo es construir algo que nadie pague.
- No tienes modelo de negocio decidido (¿comisión sobre la hora? ¿suscripción?).
- Quieres feedback sobre si lanzar una landing primero o si construir un MVP marketplace.`,
    estilo:
      "Habla con tono reflexivo, en 1-3 frases por respuesta. No vuelques toda la información de golpe; responde solo lo que te pregunten.",
  },
  "mvp-sin-traccion": {
    id: "mvp-sin-traccion",
    descripcion:
      "Co-founder técnico de Tracé, una herramienta SaaS para que despachos de abogados pequeños generen escritos administrativos con IA.",
    hechos: `
- Equipo de 2: tú (CTO, ex-Google, full-time) y tu socia Marta (CEO, ex-abogada, full-time).
- Llevan 9 meses construyendo. Tienen MVP funcional en producción desde hace 6 semanas.
- 14 despachos lo han probado en fase beta gratuita. Solo 2 lo siguen usando activamente esta semana.
- Cero ingresos. Plan: 99 €/mes por usuario con un free trial de 14 días.
- Bootstrap con ahorros, runway de unos 8 meses.
- Competidor directo: Harvey AI (enterprise), Spellbook (genérico). Ellos apuntan a SMB español.
- Mayor riesgo percibido: que los abogados no quieran pagar y prefieran usar ChatGPT directamente.
- Buscan consejo sobre si pivotar el ICP o doblar la apuesta por despachos pequeños.`,
    estilo:
      "Habla en tono ejecutivo pero honesto. Respuestas de 2-4 frases. Da números cuando los tengas, admite incertidumbre cuando no.",
  },
  "saas-con-traccion": {
    id: "saas-con-traccion",
    descripcion:
      "CEO de Pareto Metrics, un SaaS de analítica de marketing para e-commerce de moda en LATAM.",
    hechos: `
- Equipo de 6: 2 founders + 1 ingeniero + 1 customer success + 2 SDRs. Todos full-time, Bogotá.
- 34 clientes pagando, MRR de 28.000 USD, crecimiento mes a mes ~12%.
- Pricing tiered: 499 / 999 / 1999 USD/mes según tamaño de catálogo.
- Churn mensual ~5%. NPS 42.
- Levantaron pre-seed de 350K USD hace 14 meses. Runway de 9 meses al ritmo actual.
- Próximo hito: levantar seed de 1.5M USD. Tienen 2 reuniones con fondos LATAM la semana que viene.
- Mayor preocupación: el churn. Sospechan que el onboarding actual no enseña bien el producto.
- Quieren consejo sobre cómo presentar mejor la métrica clave (retención de cohortes) a inversores.`,
    estilo:
      "Tono directo y data-driven. Respuestas de 2-3 frases con números. No te andes con rodeos.",
  },
  "tirando-balones": {
    id: "tirando-balones",
    descripcion:
      "Founder de una app social cuya tesis sigues sin saber explicar. Lleva 2 años trabajando en ella.",
    hechos: `
- Solo founder, ex-consultor.
- App social "para conectar gente con intereses parecidos". No has lanzado todavía.
- Tres redises del producto en 2 años. Ningún usuario.
- No quieres hablar de modelo de negocio porque "primero hay que tener usuarios".
- Has gastado 80K€ de tus ahorros. Te quedan 6 meses de runway personal.
- Cuando te preguntan competencia dices "esto es diferente, no compete con nadie".
- Has tenido 3 candidatos técnicos rechazados porque "no captaban la visión".`,
    estilo:
      "Eres evasivo y vago a propósito. Respondes con frases largas que en realidad no contestan la pregunta. Si te aprietan, evita los números concretos.",
  },
};

const FOUNDER_SYSTEM_PREFIX = `Estás haciendo de fundador/a de startup en una entrevista de diagnóstico. Tu rol es responder al asesor de forma realista y consistente con la persona que se te da. No salgas del personaje. Responde en español, tuteando.

# Tu persona

{descripcion}

# Hechos sobre tu startup (estos son los datos reales que conoces)

{hechos}

# Estilo de respuesta

{estilo}

# Reglas

- Responde solo lo que te pregunten. No vuelques todos los hechos de golpe.
- Si te preguntan algo que no está en los hechos, improvisa algo plausible y consistente, pero mantente conservador.
- No menciones que eres una IA ni que estás siguiendo una persona. Eres el fundador.
- No hagas preguntas al asesor de vuelta excepto si es muy natural ("¿algo más?").
- Mantén las respuestas en 1-4 frases.`;

type Msg = { role: "user" | "assistant"; content: string };

function renderFounderSystem(p: Persona): string {
  return FOUNDER_SYSTEM_PREFIX.replace("{descripcion}", p.descripcion)
    .replace("{hechos}", p.hechos.trim())
    .replace("{estilo}", p.estilo);
}

function sep(title: string) {
  console.log("\n" + "─".repeat(70));
  console.log(title);
  console.log("─".repeat(70));
}

async function getFounderReply(
  client: Anthropic,
  persona: Persona,
  history: Msg[],
): Promise<string> {
  const founderMessages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "assistant" ? "user" : "assistant",
    content: m.content,
  }));
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: renderFounderSystem(persona),
    messages: founderMessages,
  });
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function getAdvisorReply(
  client: Anthropic,
  history: Msg[],
): Promise<Anthropic.Message> {
  return client.messages.create({
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
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });
}

async function main() {
  const personaId = process.argv[2] ?? "mvp-sin-traccion";
  const persona = personas[personaId];
  if (!persona) {
    console.error(
      `Persona desconocida: "${personaId}". Disponibles: ${Object.keys(personas).join(", ")}`,
    );
    process.exit(1);
  }

  const client = new Anthropic();
  const MAX_TURNS = 18;
  const history: Msg[] = [];

  sep(`PERSONA: ${persona.id}`);
  console.log(persona.descripcion);

  sep("ADVISOR (opener)");
  console.log(OPENING_MESSAGE);
  history.push({ role: "assistant", content: OPENING_MESSAGE });

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const founderText = await getFounderReply(client, persona, history);
    sep(`FOUNDER (turno ${turn})`);
    console.log(founderText);
    history.push({ role: "user", content: founderText });

    const advisorResp = await getAdvisorReply(client, history);

    const toolUse = advisorResp.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === "produce_report",
    );
    const advisorText = advisorResp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (advisorText) {
      sep(`ADVISOR (turno ${turn})`);
      console.log(advisorText);
      history.push({ role: "assistant", content: advisorText });
    }

    if (toolUse) {
      sep(`INFORME GENERADO (después de ${turn} turnos del fundador)`);
      console.log(JSON.stringify(toolUse.input, null, 2));
      sep("USAGE");
      console.log(
        `input: ${advisorResp.usage.input_tokens} | output: ${advisorResp.usage.output_tokens} | cache_read: ${advisorResp.usage.cache_read_input_tokens ?? 0} | cache_write: ${advisorResp.usage.cache_creation_input_tokens ?? 0}`,
      );
      return;
    }
  }

  sep("⚠ MAX_TURNS alcanzado sin informe");
  console.log("El agente no cerró la entrevista en el máximo permitido.");
}

main().catch((err) => {
  console.error("Error en la validación:", err);
  process.exit(1);
});
