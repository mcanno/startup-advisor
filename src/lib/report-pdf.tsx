import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { ReportContent } from "@/lib/db/schema";

// Sin esto, react-pdf hifena palabras largas sin espacios (base64,
// UUIDs concatenados) al no caber en el ancho de pagina, insertando un
// "-" en medio de la cadena -- corrompe la firma del bloque de
// verificacion al extraer el texto. Con la palabra tratada como
// indivisible, en el peor caso desborda la caja visualmente, pero el
// texto extraido queda intacto (lo que importa para la verificacion).
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingVertical: 40,
    paddingHorizontal: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#27272a",
  },
  badge: {
    fontSize: 9,
    color: "#047857",
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 6,
  },
  phase: {
    fontSize: 10,
    color: "#71717a",
    marginBottom: 24,
  },
  phaseValue: {
    color: "#3f3f46",
    fontWeight: 700,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
  },
  paragraph: {
    lineHeight: 1.5,
  },
  listItem: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  bulletStrength: {
    color: "#059669",
  },
  bulletWeakness: {
    color: "#d97706",
  },
  recommendation: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  recommendationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  recommendationTitle: {
    fontSize: 11.5,
    fontWeight: 700,
  },
  priorityPill: {
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  priorityAlta: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  priorityMedia: { backgroundColor: "#fef3c7", color: "#b45309" },
  priorityBaja: { backgroundColor: "#f4f4f5", color: "#3f3f46" },
  stepItem: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  stepIndex: {
    fontWeight: 700,
    color: "#71717a",
  },
  verificationLine: {
    fontSize: 8,
    marginBottom: 4,
  },
});

const priorityStyles = {
  alta: styles.priorityAlta,
  media: styles.priorityMedia,
  baja: styles.priorityBaja,
} as const;

export function ReportPdf({
  title,
  report,
  verification,
}: {
  title: string;
  report: ReportContent;
  verification: { startupId: string; reportId: string; timestamp: string; signature: string };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.badge}>INFORME DE DIAGNÓSTICO</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.phase}>
          Fase estimada: <Text style={styles.phaseValue}>{report.fase_estimada}</Text>
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen ejecutivo</Text>
          <Text style={styles.paragraph}>{report.resumen_ejecutivo}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fortalezas</Text>
          {report.fortalezas.map((f, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bulletStrength}>✓</Text>
              <Text>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debilidades y riesgos</Text>
          {report.debilidades.map((d, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bulletWeakness}>!</Text>
              <Text>{d}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recomendaciones</Text>
          {report.recomendaciones.map((rec, i) => (
            <View key={i} style={styles.recommendation}>
              <View style={styles.recommendationHeader}>
                <Text style={styles.recommendationTitle}>{rec.titulo}</Text>
                <Text style={[styles.priorityPill, priorityStyles[rec.prioridad]]}>
                  Prioridad {rec.prioridad}
                </Text>
              </View>
              <Text style={styles.paragraph}>{rec.descripcion}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Próximos pasos (2-4 semanas)</Text>
          {report.proximos_pasos.map((step, i) => (
            <View key={i} style={styles.stepItem}>
              <Text style={styles.stepIndex}>{i + 1}.</Text>
              <Text>{step}</Text>
            </View>
          ))}
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.verificationLine}>---</Text>
        <Text style={styles.verificationLine}>startup-next-verification</Text>
        <Text style={styles.verificationLine}>startup_id: {verification.startupId}</Text>
        <Text style={styles.verificationLine}>report_id: {verification.reportId}</Text>
        <Text style={styles.verificationLine}>timestamp: {verification.timestamp}</Text>
        <Text style={styles.verificationLine}>signature: {verification.signature}</Text>
      </Page>
    </Document>
  );
}
