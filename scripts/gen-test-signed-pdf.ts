/**
 * Script de un solo uso: genera un PDF firmado real (misma firma Ed25519 y
 * mismo componente ReportPdf que produce /api/interview/[id]/report/pdf en
 * produccion) para un startup_id de prueba, sin pasar por Clerk/entrevista
 * real -- para verificar el camino de modo enriquecido de startup-next /
 * hermes-startup-next contra un startup_id conocido.
 *
 * Uso:
 *   npx tsx scripts/gen-test-signed-pdf.ts <startup_id> <output_path>
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { signReport } from "../src/lib/pdf-signing";
import { ReportPdf } from "../src/lib/report-pdf";
import type { ReportContent } from "../src/lib/db/schema";

async function main() {
  const startupId = process.argv[2];
  const outputPath = process.argv[3];
  if (!startupId || !outputPath) {
    console.error("Uso: npx tsx scripts/gen-test-signed-pdf.ts <startup_id> <output_path>");
    process.exit(1);
  }

  const reportId = randomUUID();
  const timestamp = new Date().toISOString();
  const signature = signReport(startupId, reportId, timestamp);

  const report: ReportContent = {
    fase_estimada: "Customer Discovery",
    resumen_ejecutivo:
      "TEST_DESECHABLE -- informe sintetico generado por script para verificar el camino PDF firmado / modo enriquecido, no un diagnostico real.",
    fortalezas: ["Fortaleza de prueba 1", "Fortaleza de prueba 2"],
    debilidades: ["Debilidad de prueba 1"],
    recomendaciones: [
      {
        titulo: "Definir y construir el MVP para validar la hipotesis de valor con clientes reales",
        prioridad: "alta",
        descripcion: "TEST_DESECHABLE -- recomendacion sintetica de prueba.",
      },
    ],
    proximos_pasos: ["Paso de prueba 1", "Paso de prueba 2"],
  };

  const pdfBuffer = await renderToBuffer(
    ReportPdf({
      title: "TEST_DESECHABLE informe de prueba",
      report,
      verification: { startupId, reportId, timestamp, signature },
    }),
  );

  writeFileSync(outputPath, pdfBuffer);
  console.log("startup_id:", startupId);
  console.log("report_id:", reportId);
  console.log("timestamp:", timestamp);
  console.log("PDF escrito en:", outputPath);
}

main();
