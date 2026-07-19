# HANDOFF — ontology-engine

Última actualización: 2026-07-19.

## Fix real: 500 sin detalle en `POST /startups/{id}/individuals` y `/facts`

**Causa raíz, confirmada con evidencia real, no supuesta**: la tabla
`startup_individuals.startup_id` tiene una foreign key real,
`fk_startup_individuals_startup`, aplicada en la Neon compartida de
producción. El archivo de migración trackeado
(`sql/001_init_ontology_schema.sql`, líneas 79-90) solo muestra el
`ALTER TABLE` correspondiente **comentado**, como sugerencia — la
constraint real fue aplicada en algún momento directo contra la base
(fuera de este repo, sin dejar rastro en el historial de migraciones).
Cuando el caller pasa un `startup_id` que no existe en `startups`
(típicamente un id sintético usado en pruebas, no un id real creado por
la app), el INSERT viola esa constraint y la excepción no manejada
llegaba al cliente como un `500 Internal Server Error` sin cuerpo útil.

**Reproducido contra `https://ontology-engine.fly.dev` real**, con
`flyctl logs -a ontology-engine` corriendo en paralelo. Traceback real:

```
psycopg.errors.ForeignKeyViolation: insert or update on table "startup_individuals"
violates foreign key constraint "fk_startup_individuals_startup"
DETAIL:  Key (startup_id)=(11111111-1111-1111-1111-111111111111) is not present in table "startups".
```

Los logs también mostraban un 500 previo idéntico (14:53:02Z, otro
`startup_id`) — evidencia de que esto ya había bloqueado un intento
anterior, no solo la reproducción de esta sesión.

**No es un bug de lógica interna**: para startups reales (creadas por la
app, con fila real en `startups`) la escritura de individuals ya
funcionaba — confirmado consultando la Neon compartida directo, hay 11
startups reales con varias ya teniendo individuals escritos
correctamente (ej. "Virtual Atelier AI", 5 individuals). El problema es
puramente que un `startup_id` inexistente producía un 500 opaco en vez de
un error claro.

### Fix aplicado

`main.py` (`create_individual` y `create_fact`): envuelve el `INSERT` en
`try/except ForeignKeyViolation` (import explícito de
`psycopg.errors.ForeignKeyViolation`, no un `except` genérico — otros
errores reales de DB siguen propagando como 500 sin enmascararse) y
devuelve `404` con un mensaje que solo repite los valores que el propio
caller mandó (`startup_id`, o `source_id`/`target_id` en el caso de
`facts`), sin filtrar detalle interno de la excepción ni de la conexión.
Commit `82737f1` (rama `phase-1-ontology-engine`), desplegado a
producción con `flyctl deploy -a ontology-engine`.

**Nota de deploy**: durante el deploy apareció el mismo problema de Avast
interceptando TLS ya documentado en `handoff_startup_next_v2.md`
(`CRYPT_E_NO_REVOCATION_CHECK` en curl, "certificate has expired" en el
verificador TLS de Python) — esta vez no solo en el build sino también al
intentar alcanzar el servicio ya desplegado desde esta máquina. El
servicio en sí estaba sano todo el tiempo (`flyctl logs` mostraba
`Application startup complete` y el healthcheck de Fly en verde) — el
problema era exclusivamente de esta máquina cliente. Se resolvió
pausando Avast temporalmente (mismo fix que ya funcionó antes). **Sigue
pendiente la excepción permanente** para Docker Desktop/WSL2 y `flyctl`
— no se configuró en esta sesión tampoco.

### Verificación real (no solo "dejó de dar 500")

Contra la producción ya desplegada, con Avast pausado:

1. **Camino negativo** (mismo `startup_id` sintético de la reproducción
   original): `POST /startups/11111111-1111-1111-1111-111111111111/individuals`
   → antes `500` sin cuerpo útil, ahora `404` con
   `{"detail":"startup_id '11111111-1111-1111-1111-111111111111' no existe en la tabla startups -- registrala primero del lado de la app."}`.
2. **Camino positivo, con escritura y lectura real**: se insertó una fila
   de prueba desechable en la tabla `startups` compartida (ver abajo),
   luego `POST /startups/{id}/individuals` con esa fila → `201 {"ok":true}`,
   y `GET /startups/{id}/graph` inmediatamente después confirmó el
   individuo realmente escrito y consultable:
   `{"stats":{"conceptos":43,"individuos":1,"relaciones_totales":46},"individuals":[{"id":"test_founder_1","label":"TEST_DESECHABLE fundador de prueba","concept_id":"Founder"}]}`.

### Fila de prueba viva en la Neon compartida — pendiente de limpieza

Se insertó directamente (no vía UI, tabla simple sin lógica de negocio)
una fila desechable en `startups`, nombrada de forma inequívoca para no
confundirse con datos reales de un usuario:

- **id**: `e643a3b4-227a-4f07-81d6-0d7e232ecb48`
- **user_id**: `test-debug-500-ontology-engine`
- **name**: `TEST_DESECHABLE_verificacion_fix_individuals_500`
- Tiene 2 individuals reales: `test_founder_1` (`concept_id: Founder`) y
  `test_value_hyp_1` (`concept_id: ValueHypothesis`, agregado durante el
  Paso 2 para poder ejercitar un hallazgo real de ontología).

**Reutilizada con éxito para el Paso 2** (ver
`hermes-startup-next/HANDOFF_HERMES.md` y `startup-next/HANDOFF.md`):
sirvió como `startup_id` real de un PDF firmado de prueba, confirmó modo
enriquecido end-to-end contra `startup-next` + `hermes-startup-next`
reales, con un hallazgo de ontología real y específico
(`R1_hipotesis_sin_experimento` sobre `test_value_hyp_1`).

**Borrada al cierre de esta sesión** — ya cumplió su propósito (Paso 1 y
Paso 2 verificados con evidencia real). Se ejecutó:

```sql
DELETE FROM startup_individuals WHERE startup_id = 'e643a3b4-227a-4f07-81d6-0d7e232ecb48';
DELETE FROM startups WHERE id = 'e643a3b4-227a-4f07-81d6-0d7e232ecb48';
```

(2 individuals + 1 startup borrados, confirmado por `rowcount`). Si una
sesión futura necesita repetir esta verificación, `gen-test-signed-pdf.ts`
requiere volver a crear una fila en `startups` primero (la firma no
depende de que el id ya exista, pero `ontology-engine` sí lo exige para
poder escribir individuals).

### Hallazgo secundario, no corregido en esta sesión

El archivo de migración trackeado (`sql/001_init_ontology_schema.sql`)
no refleja el estado real del esquema en producción — la constraint
`fk_startup_individuals_startup` existe en la base pero el `.sql` solo la
documenta como sugerencia comentada. Vale la pena, en algún momento,
descomentar ese `ALTER TABLE` en el archivo (o agregar una migración
`002_add_fk_startup_individuals.sql` que la declare explícitamente) para
que el repo deje de mentir sobre el estado real de la base — no se tocó
en esta sesión porque no era necesario para el fix (la constraint ya
existe y funciona), y modificar el `.sql` no cambia nada en la base ya
aplicada.
