// Firma Ed25519 de los PDF de informe exportados, para que startup-next
// pueda verificar que el documento salio de aca -- los dos modulos estan
// completamente separados, sin base de datos compartida (ver
// diseno_startup_next.md seccion 8 en el repo de startup-next). La cadena
// canonica firmada es `${startupId}|${reportId}|${timestamp}`; el mismo
// timestamp se firma y se imprime en el bloque de verificacion, así que
// el verificador reconstruye la cadena exacta a partir de lo que lee.

import { createPrivateKey, sign } from "node:crypto";

function getSigningKey() {
  const pem = process.env.PDF_SIGNING_PRIVATE_KEY;
  if (!pem) throw new Error("PDF_SIGNING_PRIVATE_KEY is not set");
  return createPrivateKey(pem.replace(/\\n/g, "\n"));
}

export function signReport(startupId: string, reportId: string, timestamp: string): string {
  const canonical = `${startupId}|${reportId}|${timestamp}`;
  return sign(null, Buffer.from(canonical, "utf8"), getSigningKey()).toString("base64");
}
