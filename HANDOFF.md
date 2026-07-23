# HANDOFF — startup-advisor

Última actualización: 2026-07-23. Rama activa: `phase-1-ontology-engine`.

## Razonamiento de ontología pasa a TBox-only (Opción C): sin ABox, sin PDF firmado (2026-07-23)

Ejecuta el punto 6 (plan de migración) de
`startup-next/diseno_ontology_engine_solo_consulta.md`, con Opción C ya
confirmada para el punto 3: en vez de escribir individuals reales y
correr `validate()` contra ellos durante la entrevista, se identifican
los conceptos del TBox que la entrevista tocó y se consultan sus
prerrequisitos genéricos (`GET /concepts/{id}/prerequisitos`), con el
mismo encuadre que ya usa `orchestratorModoBase.ts` de `startup-next`
(información metodológica general, nunca una evaluación de hechos reales
de esta startup).

### `ontologyReasoning.ts`: reescrito, sin ABox

`runOntologyReasoning()` cambia de firma: ya no recibe
`startupId`/`startupName`/`founderUserId` (no hay ningún individual que
crear) — solo `transcript`. `ensureCoreIndividuals`/
`recordMentionedIndividuals`/`createIndividual`/`getStartupGraph`/
`validateStartup` eliminados. Nueva función `identificarConceptosTocados`
(mismo mecanismo de tool-calling de Anthropic que ya existía, ahora sin
persistir nada) + `buildConsideracionesMetodologicas` (una llamada a
`getPrerequisitos` por concepto tocado, narrada con el mismo criterio de
`FRASE_ENCUADRE`). Caller actualizado en
`src/app/api/interview/[id]/chat/route.ts` (ya no busca
`getStartupById` — solo hacía falta para el registro de ABox retirado).

`src/lib/ontologyEngine.ts`: agregado `getPrerequisitos`/`Prerequisito`
(mismo contrato que el cliente de `startup-next`). `createIndividual`,
`getStartupGraph`, `validateStartup` eliminados (sin caller, endpoints
retirados del lado de `ontology-engine`).

### Mecanismo de firma PDF: retirado por completo

`src/lib/pdf-signing.ts` eliminado. `report-pdf.tsx` ya no recibe
`verification` ni renderiza el bloque `startup-next-verification`
(tampoco necesita ya el `Font.registerHyphenationCallback`, que existía
solo para no corromper la firma al extraer texto). Caller
(`api/interview/[id]/report/pdf/route.ts`) simplificado, sin `signReport`.
`scripts/gen-test-signed-pdf.ts` (arnés de prueba del mecanismo retirado)
eliminado. `PDF_SIGNING_PRIVATE_KEY` retirado de Vercel (`vercel env rm`,
producción) tras confirmar que ya no hay ningún código que lo lea.

### Verificación con evidencia real

- `npx tsc --noEmit` limpio.
- `npm run build` (Next.js, Turbopack) limpio, mismas rutas que antes.
- Arnés de un solo uso (`scripts/verify-tbox-only-reasoning.ts`,
  etiquetado `TEST_DESECHABLE`, borrado tras verificar — mismo criterio
  que `fakeSummarize`/scripts anteriores del proyecto): llamó a
  `runOntologyReasoning()` real (Anthropic real + `ontology-engine` real)
  con una transcripción sintética mencionando un MVP — devolvió
  `consideraciones_metodologicas` con `PREREQUISITO_GENERICO` narrado
  correctamente (MVP → Experiment → Hypothesis), confirmando el camino
  TBox-only funciona de punta a punta sin escribir ni leer ningún ABox.
- Deploy real a producción (`vercel deploy --prod`, bloqueado primero por
  el mismo problema de Avast/TLS ya documentado más abajo en este mismo
  archivo — resuelto pausando Avast). `GET /` → `200`; la ruta del PDF
  responde vía el middleware de Clerk (confirma que el deploy corre, no
  un crash) — **no se pudo verificar una entrevista real de punta a punta
  a través del navegador en esta sesión** (Clerk requiere sesión real de
  navegador; no había herramienta de automatización de navegador
  disponible en este entorno). Pendiente real: verificar manualmente una
  entrevista completa en `https://startup-advisor-sand.vercel.app` si se
  quiere confirmar el camino HTTP/Clerk además de la lógica en sí.
- Redeploy adicional tras `vercel env rm` para que la instancia en
  ejecución ya no tenga `PDF_SIGNING_PRIVATE_KEY` en su entorno.

## Pendiente revisado: "entrevista terminando de forma abrupta" — no reproducido en esta sesión

Verificación de bajo esfuerzo pedida explícitamente sobre el pendiente
anotado en `handoff_startup_next_v2.md` ("Entrevista de `startup-advisor`
terminando de forma abrupta — reportado al final de la sesión, no
investigado todavía").

**Paso 1, revisión de detalle previo**: revisado `handoff_startup_next_v2.md`
completo (única mención del problema, sin ningún detalle adicional) y
`HANDOFF.md` propio de este repo (no lo menciona en absoluto, es de una
fecha anterior al reporte). Búsqueda en `git log` e historial completo del
repo por "abrupt"/variantes: sin resultados. **El detalle original es
insuficiente para reproducir un escenario específico**: no se sabe en qué
pregunta/área de la entrevista ocurrió, qué tipo de respuesta dio el
fundador, ni si hubo algún mensaje de error visible — se dice explícito
acá para no inventar un escenario de prueba que el reporte original nunca
describió.

**Paso 2, intento de reproducción real**: bloqueado por límites reales de
herramientas de esta sesión, no por falta de esfuerzo:

- El `CLAUDE.md` de este proyecto pide usar la skill `/browse` para
  cualquier navegación web — **no está disponible en este entorno**
  (no aparece en la lista real de skills cargadas, pese a estar
  documentada). Sin un navegador interactivo, no se pudo conducir una
  entrevista real turno a turno como pide la tarea.
- La app usa Clerk (login real, sin `middleware.ts` ni bypass de
  desarrollo) — cada ruta valida `auth()` contra la sesión de la request.
  Autenticar un script headless contra Clerk sin un navegador real
  requiere replicar su flujo de sign-in token + intercambio vía Frontend
  API, que excede el criterio de "bajo esfuerzo" pedido explícitamente.
  Se buscó además alguna cookie de sesión ya guardada de una
  `/setup-browser-cookies` previa — no se encontró ninguna.
- `vercel logs` contra el deployment de producción no devolvió ningún log
  (ventana de retención ya vencida, o sin tráfico reciente) — sin
  evidencia retrospectiva tampoco por esta vía.

**Lo que sí se pudo hacer con bajo esfuerzo**: leer el código real de la
ruta de chat (`src/app/api/interview/[id]/chat/route.ts`). Encontró un
mecanismo real, plausible, **no confirmado**, que calza con la forma del
síntoma reportado ("termina de forma abrupta... sin generar el informe"):

- `export const maxDuration = 120` (límite duro de Vercel para la función
  serverless).
- Cuando el modelo invoca `produce_report`, el código hace trabajo
  síncrono ADICIONAL después de que el streaming del modelo termina, antes
  de enviar `report_ready`: una llamada real a `ontology-engine`
  (`runOntologyReasoning()`). Ese servicio tiene un historial documentado
  propio de latencia/reconexión (`HANDOFF.md`, "Fix de pool de conexiones",
  el fix nunca se verificó en frío contra inactividad prolongada).
- Si la suma (generación del modelo + esa llamada a `ontology-engine`)
  supera 120s, Vercel mata la función a mitad de camino — el stream SSE se
  corta sin ningún evento `{type: "error"}` (el `catch` de la ruta nunca
  llega a ejecutarse, porque el proceso completo muere primero), y el
  informe nunca se guarda. Desde el navegador, esto se vería exactamente
  como un corte silencioso sin explicación, no como un error visible.

**No se toma como causa confirmada** — es una lectura de código, no una
reproducción con log o traceback real. Queda como hipótesis priorizada
para la próxima sesión que sí tenga acceso a un navegador real: reproducir
una entrevista completa (o, más dirigido, forzar el turno final con
`produce_report` bajo latencia artificial de `ontology-engine`) y revisar
`vercel logs`/`fly logs` en el momento exacto del corte.

**Conclusión, tal como se pidió**: no reproducido en esta sesión. Posible
resuelto incidentalmente, o dependiente de una condición no identificada
(probablemente latencia, según la lectura de código de arriba) — no se
cierra como resuelto sin evidencia de que lo esté.

## Módulos recién completados

1. **Firma criptográfica del PDF exportado** — completo, commiteado (`cae6d52`), desplegado a producción.
2. **Fix de conexión obsoleta en el pool de `ontology-engine`** — completo, commiteado (`47eb443`, bundleado con trabajo previo de `is_sequential`/`precedents_of` que ya estaba en producción pero nunca se había commiteado), desplegado.

**Estado: ambos en producción real (Vercel para el PDF, Fly.io para ontology-engine), verificados con datos reales.**

## Decisiones técnicas y de arquitectura

### Firma Ed25519 del PDF (para que `startup-next` verifique el origen)

- Par de claves Ed25519 generado una sola vez con `node:crypto` (`scripts/generate-signing-keypair.ts`), sin librería nueva. Privada en `PDF_SIGNING_PRIVATE_KEY` (nunca sale de este sistema); pública ya entregada a `startup-next` como `PDF_SIGNING_PUBLIC_KEY`.
- Bloque de texto visible al final del PDF (no metadatos — se evaluó y se descartó por simplicidad): `startup_id`, `report_id`, `timestamp`, `signature` (base64), firmado sobre la cadena canónica `${startupId}|${reportId}|${timestamp}`.
- `src/lib/pdf-signing.ts` — `signReport()`. Se llama desde `src/app/api/interview/[id]/report/pdf/route.ts` justo antes de renderizar.
- **Bug real encontrado y corregido durante la implementación**: `@react-pdf/renderer` hifena automáticamente cadenas largas sin espacios (como la firma base64, 88 caracteres) cuando no caben en el ancho de página — insertaba un `-` en medio, rompiendo la firma. Corregido con `Font.registerHyphenationCallback((word) => [word])` + tamaño de fuente reducido (8pt) para el bloque de verificación, en `src/lib/report-pdf.tsx`.
- Verificado de punta a punta con código de producción real (no mocks): render → extracción con `unpdf` (misma librería que usa `startup-next` para leerlo) → regex ancladas al marcador → `crypto.verify()` con la clave pública → `true`.

### Fix de pool de conexiones en `ontology-engine`

- Bug real en producción: `GET /startups/{id}/graph` fallaba con `SSL connection has been closed unexpectedly` — una conexión pooled de Neon que el servidor ya había cerrado del lado suyo (autosuspend/idle timeout), pero que el `ConnectionPool` de `psycopg_pool` seguía entregando sin validar.
- Confirmado con logs reales de Fly (`fly logs`) que el traceback venía de `graph.py:166` (`load_startup_graph`), un endpoint preexistente, sin relación con la migración `is_sequential` (esa query no toca `ontology_relations` para nada).
- Fix: `ConnectionPool(DATABASE_URL, min_size=1, max_size=5, check=ConnectionPool.check_connection)` en el `lifespan` de `main.py` — valida la conexión (ping real) antes de entregarla, la descarta/reconecta si está muerta.
- Verificado contra la URL pública real tras el deploy: `/health`, `/startups/{id}/graph`, `/concepts/{id}/prerequisitos` — los tres `200`.
- **No se reprodujo el escenario de inactividad prolongada** (llevaría horas) — la validación completa de que el fix realmente evita la reconexión rota va a confirmarse la próxima vez que el servicio esté inactivo un rato largo.

## Archivos y estructuras clave modificados

- `scripts/generate-signing-keypair.ts` (nuevo).
- `src/lib/pdf-signing.ts` (nuevo).
- `src/lib/report-pdf.tsx` — bloque de verificación + fix de hifenación.
- `src/app/api/interview/[id]/report/pdf/route.ts` — firma antes de renderizar.
- `ontology-engine/main.py` — `check=ConnectionPool.check_connection`.
- `ontology-engine/graph.py`, `domain_ontology.py`, `seed.py`, `tests/test_parity.py`, `ontology-engine/sql/002_add_relation_is_sequential.sql` — trabajo previo de `is_sequential`/`precedents_of`, ya en producción, commiteado recién hoy junto con el fix del pool (no se pudo separar limpiamente, mismo archivo).
- `.env.local` — `PDF_SIGNING_PRIVATE_KEY` (no commiteado, en `.gitignore`).

## Problemas conocidos / pendientes

1. **Deploys bloqueados por Avast interceptando TLS**, tanto contra el builder remoto de Vercel como el de Fly (`x509: certificate signed by unknown authority` / fallo de verificación de certificado). Se resolvió pausando Avast manualmente antes de cada deploy — hay que repetir ese paso la próxima vez, no es un fix permanente.
2. **`PDF_SIGNING_PRIVATE_KEY` faltó en las variables de entorno de Vercel** la primera vez que se desplegó (solo estaba en `.env.local`) — causó un error real en producción (`Error: PDF_SIGNING_PRIVATE_KEY is not set`) hasta que se agregó vía `vercel env add` y se redesplegó. Confirmar que cualquier env var nueva se agregue también en Vercel, no solo en local.
3. `POST /startups/{id}/individuals` de `ontology-engine` devuelve `500` sin detalle — encontrado durante las pruebas de hoy, no investigado (se usó un `startup_id` ya poblado de antes en vez de crear uno nuevo).
4. `dotenv` (16.x) imprime "tips" promocionales rotativos en stdout al cargar `.env.local`, incluyendo al menos un dominio de terceros desconocido (`vestauth.com`) junto a otros del propio proveedor (`dotenvx.com`). No es una inyección activa, pero vale la pena revisar/silenciar (`{ quiet: true }` o pin de versión).
5. Docker Desktop local no tiene el daemon corriendo — no hace falta si Avast está pausado y se usa el builder remoto, pero es la alternativa si el problema de Avast persiste.
6. Rama activa es `phase-1-ontology-engine`, no `main`/`master` — pendiente decidir cuándo mergear.

## Próximos pasos sugeridos

1. Investigar el `500` de `POST /startups/{id}/individuals` si se necesita crear datos de ontología de prueba por API en el futuro.
2. Confirmar en unas semanas que el fix del pool de conexiones realmente evita la reconexión rota tras un período de inactividad real (no se pudo probar hoy).
3. Decidir el plan de merge de `phase-1-ontology-engine` a la rama principal.
4. Revisar el comportamiento de `dotenv` (tips promocionales) y decidir si vale la pena silenciarlos o fijar una versión anterior.
5. Un archivo `handoff_startup_next_v2.md` apareció sin trackear en este y otros dos repos — origen desconocido, no se tocó.
