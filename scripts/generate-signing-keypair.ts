// Script de un solo uso: genera el par Ed25519 para firmar los PDF de
// informe exportados (ver src/lib/pdf-signing.ts). Correr una vez con
// `npx tsx scripts/generate-signing-keypair.ts`, copiar la privada a
// PDF_SIGNING_PRIVATE_KEY en .env.local (nunca commitear), y pasar la
// pública a startup-next para que pueda verificar la firma.

import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const toEnvLine = (pem: string) => pem.trim().replace(/\n/g, "\\n");

console.log("PDF_SIGNING_PRIVATE_KEY (a .env.local de startup-advisor, no commitear):\n");
console.log(toEnvLine(privateKey));
console.log("\nPDF_SIGNING_PUBLIC_KEY (para startup-next, no es secreta):\n");
console.log(toEnvLine(publicKey));
