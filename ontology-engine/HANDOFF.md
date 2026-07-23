# HANDOFF — ontology-engine

Última actualización: 2026-07-23.

## Puntos 1/3/4/5/6 del plan de migración, ejecutados: servicio puramente de consulta

Continúa el "Borrado completo del ABox" de esta misma sección más abajo
(punto 2, ya cerrado) con los puntos 1/3/4/5/6 de
`startup-next/diseno_ontology_engine_solo_consulta.md`, con las tres
decisiones abiertas ya confirmadas por el usuario: Opción C del punto 3
(TBox-only también para `startup-advisor`, no solo `startup-next`),
retiro completo (no solo deshabilitado) del mecanismo de firma PDF, y
drop real de las tablas de ABox (no dejarlas vacías).

### Código: endpoints, motor de reglas y carga de ABox retirados

`main.py` reescrito — quedan solo los 5 endpoints de TBox (`/health`,
`/concepts`, `/concepts/{id}`, `/concepts/{id}/subclasses`,
`/concepts/{id}/prerequisitos`). Retirados: `GET /startups/{id}/graph`,
`GET /startups/{id}/neighbors/{node_id}` (sin caller en ningún repo desde
antes de esta sesión, confirmado por grep), `GET /startups/{id}/validate`,
`POST /startups/{id}/individuals`, `POST /startups/{id}/facts`.

`rules.py` eliminado (sin caller posible, `/validate` retirado). `graph.py`
reescrito: se retiran `load_startup_graph`, `load_individuals_from_rows`,
`load_facts_from_rows`, y los métodos `individuals()`/`neighbors_via()`/
`ancestors()`/`stats()` de `OntologyGraph` (sin caller tras retirar
`rules.py` y los endpoints de ABox). Quedan solo los métodos de TBox
(`concepts`, `subclasses_of`, `precedents_of`, `describe`).

**Simplificación adicional, consecuencia directa de lo anterior**: como
ya no queda ningún endpoint que haga queries por request contra Postgres
(el TBox se carga una sola vez al arrancar el proceso), se retira el
`ConnectionPool` (`psycopg_pool`, `min_size=1, max_size=5`,
`check=check_connection`) a favor de una única conexión abierta-cargada-
cerrada en el `lifespan`. Esto también elimina de raíz la clase de
problema que motivó `check=check_connection` (conexiones pooled
obsoletas tras el autosuspend de Neon) — ya no hay ninguna conexión
persistente que pueda quedar obsoleta. `psycopg-pool` y `pydantic`
(solo usado por los modelos `IndividualIn`/`FactIn`, retirados) quitados
de `requirements.txt`.

`Dockerfile`: `COPY` ya no incluye `rules.py` (eliminado).

### Tests: los que dependían de ABox, retirados; el resto, verificado limpio

`tests/test_parity.py`: `test_validate_rules_detect_hypothesis_without_experiment`
y `test_validate_nubedoc_case_is_clean` (ejercitaban `rules.py`/ABox)
eliminados. Los 6 tests de TBox puro (conteo de conceptos, subclases,
`describe`, `precedents_of`) siguen pasando sin cambios —
`pytest tests/test_parity.py -v` → 7 passed, 1 skipped (el de integración
real contra Postgres, opt-in de siempre).

### Migración de esquema: tablas de ABox dropeadas, no solo vaciadas

`sql/003_drop_abox_tables.sql` (nueva): `DROP TABLE startup_facts` y
`DROP TABLE startup_individuals` (en ese orden, por la FK compuesta de
`startup_facts` hacia `startup_individuals`). La FK
`fk_startup_individuals_startup` (hacia `startups.id`, aplicada directo
en producción, nunca en un `.sql` trackeado — ver "Hallazgo secundario"
más abajo) se elimina implícitamente al dropear `startup_individuals`.

Aplicada contra la Neon compartida real, con evidencia antes/después:

| | Antes | Después |
|---|---|---|
| Tablas en `public` | `..., startup_facts, startup_individuals, startups` | `..., startups` (sin `startup_facts`/`startup_individuals`) |
| `ontology_concepts` | 43 | 43 (sin cambios) |
| `ontology_relations` | 21 | 21 (sin cambios) |
| `startups` (tabla de la app, no ABox) | 12 | 12 (sin cambios) |

### Orden de despliegue: callers primero, servicio después, esquema al final

Siguiendo el plan ya acordado (para no romper el servicio compartido a
mitad de camino): 1) `startup-next` desplegado y verificado sin ninguna
dependencia de ABox: 2) `startup-advisor` desplegado y verificado (lógica
TBox-only confirmada con arnés real, ver su propio HANDOFF.md); 3) recién
entonces `ontology-engine` desplegado con los endpoints retirados; 4)
migración de esquema aplicada al final, con ambos callers ya sin ninguna
llamada a las tablas que se dropean.

### Verificación con evidencia real, contra producción

Deploy real a `https://ontology-engine.fly.dev` (bloqueado primero por el
mismo problema de Avast/TLS documentado más abajo en este archivo —
resuelto pausando Avast; deploy también falló una vez por el `Dockerfile`
sin actualizar, `COPY ... rules.py` con el archivo ya borrado — corregido
antes de reintentar):

- `GET /health` → `200 {"status":"ok","tbox_conceptos":43}`.
- `GET /concepts/MVP/prerequisitos` → `200`, mismo resultado que antes de
  la migración (Experiment, distancia 1; Hypothesis, distancia 2).
- `GET /concepts/Hypothesis/subclasses` → `200`.
- Los 5 endpoints retirados (`GET /startups/{id}/graph`,
  `GET /startups/{id}/neighbors/{node}`, `GET /startups/{id}/validate`,
  `POST /startups/{id}/individuals`, `POST /startups/{id}/facts`) → `404`
  contra `startup_id`s reales (Cafelibros) y sintéticos, confirmado con
  `curl` real después del deploy.
- Repetido después del `DROP TABLE`: `/health` y
  `/concepts/MVP/prerequisitos` siguen `200` idénticos — confirma que el
  TBox en memoria no dependía de que las tablas de ABox siguieran
  existiendo (nunca las lee desde que se retiró `load_startup_graph`).

## Borrado completo del ABox (2026-07-23): ontology-engine pasa a TBox puro

Motivado por una revisión de arquitectura documentada en
`hermes-startup-next/HANDOFF_CONTEXTO_HISTORICO.md`, sección "Revisión de
arquitectura (2026-07-21)": `ontology-engine` no tiene autenticación y
persistía hechos reales de startups reales en un servicio compartido sin
control de acceso — decisión explícita del usuario de borrar todo el ABox
sin archivar, sin exportar antes, sin dejar rastro (aunque no se creía que
hubiera contenido confidencial concreto). Este es el punto 2, ya decidido,
de un encargo mayor de conversión de `ontology-engine` a servicio de solo
consulta (TBox only) — ver `diseno_ontology_engine_solo_consulta.md` para
el diseño completo de los puntos 1/3/4/5/6 (endpoints a retirar, impacto
en modo enriquecido, PDF firmado, `/admin`, migración), que queda como
propuesta pendiente de confirmación, no implementada todavía.

### Inventario antes del borrado (evidencia real, query directa contra la Neon compartida `ep-morning-math-asb1bsnh`)

| Tabla | Filas antes |
|---|---|
| `startups` | 12 |
| `startup_individuals` | 42 (repartidas en 6 de las 12 startups, 5-9 c/u) |
| `startup_facts` | 0 (ya documentado arriba en este mismo archivo) |
| `ontology_concepts` (TBox) | 43 |
| `ontology_relations` (TBox) | 21 |

**Discrepancia real encontrada, no resuelta**: el usuario esperaba "11
startups reales conocidas"; la tabla `startups` tiene 12 filas. La 12ª,
`Prueba Fase 2` (id `1424ed1a-4a89-4a81-bdbb-64f56e5b46d5`), tenía 8
individuals reales (hipótesis de negocio completas sobre "IA para
pymes"), mismo `user_id` que la mayoría de las startups reales
(`user_3Fm5WjRcPGfCa6uqEZ3I0446tKy`) — no es la fila de prueba ya borrada
en la sesión anterior (`e643a3b4-...`, confirmado ausente antes de
proceder). No se pudo determinar si es una startup real de ese fundador o
un ensayo de Fase 2. No cambia la acción (se borró TODO el ABox, sin
excepción, para las 12 filas por igual) pero queda anotado por si alguna
sesión futura necesita reconciliar el conteo de "11" contra la realidad
de la tabla.

**Copias en otro lugar, verificado antes de borrar**:
- Repo: `grep` de nombres reales de las 12 startups contra `.json`/`.csv`/`.sql`
  en todo el árbol de trabajo (`startup-next`, `startup-next-ui`,
  `hermes-startup-next`, `startup-advisor`) — sin resultados. No hay
  ningún export ni dump del ABox en ningún repo.
- **Neon (nivel proveedor), no verificable ni purgable desde esta
  sesión**: no hay `NEON_API_KEY` en ningún `.env` del proyecto, así que
  no hay acceso a la consola/API de Neon desde acá. Neon mantiene
  point-in-time-recovery (WAL) por una ventana de retención propia del
  plan (típicamente entre 24h y varios días), independiente de cualquier
  `DELETE` ejecutado por SQL normal. El borrado de abajo saca los datos de
  las tablas vivas y de cualquier lectura normal de la app, pero **no
  garantiza "cero rastro" a nivel de infraestructura de Neon** hasta que
  esa ventana de retención expire — señalado explícitamente, sin resolver
  en esta sesión (haría falta entrar a la consola de Neon o pedir soporte
  para confirmar/forzar la retención).

### Borrado ejecutado

```sql
DELETE FROM startup_facts;       -- 0 filas borradas (ya estaba vacía)
DELETE FROM startup_individuals; -- 42 filas borradas
```

### Verificación con evidencia real, después del borrado

- Rowcount: `startup_individuals` → 0, `startup_facts` → 0.
- TBox intacto, sin cambios: `ontology_concepts` → 43, `ontology_relations`
  → 21 (mismos valores que antes del borrado). `startups` (tabla de la
  app, no ABox, no tocada) → sigue en 12.
- Contra `https://ontology-engine.fly.dev` real (no local): `GET
  /startups/{id}/graph` para `Virtual Atelier AI`
  (`31f11630-d907-4f16-be96-897e98c00d7c`) y `Cafelibros`
  (`4df8de99-62aa-4211-b09c-e8b44fea38fb`, las dos con más individuals
  antes del borrado) → `200 {"stats":{"conceptos":43,"individuos":0,...},
  "individuals":[]}` para ambas, y también para un id inexistente
  (`00000000-...`) — sin error, misma degradación con gracia ya existente
  en el servicio. `GET /concepts` sigue devolviendo 43 conceptos.
- Consecuencia esperada en `startup-next`: un run real contra
  `https://startup-next.fly.dev` (`POST /runs` + `/start`) reusando el
  `startup_id` real de Cafelibros devolvió `hallazgos_ontologia: []` y una
  `justificacion` que dice explícitamente "No hay comentario del asesor
  ni hechos registrados en la ontología, por lo que se decide por sentido
  metodológico general" — confirma que `resolveOntologyContext()` cayó a
  modo base automáticamente (`graph.individuals.length === 0`), sin
  ningún cambio de código en `startup-next`. El run de prueba (`run_id
  7f9b958e-241c-49a8-94d7-2231b7358500`) se borró después de verificar,
  directo contra la Neon propia de `startup-next` (`next_action_runs` +
  `next_action_clarifications`), mismo criterio de no dejar rastro de
  pruebas ya usado en sesiones anteriores.

**Nota operativa**: esta máquina sigue con el mismo problema de Avast
interceptando TLS ya documentado (`CRYPT_E_NO_REVOCATION_CHECK` en
`curl`/schannel) — esta vez resuelto sin pausar el antivirus, con `curl
--ssl-no-revoke`, que evita la comprobación de revocación sin desactivar
nada. Sigue pendiente la excepción permanente, no configurada en esta
sesión tampoco.

## Pendiente real: `startup_facts` está vacía para las 11 startups reales — auditado, no es el bug de hoy

Disparado por un hallazgo real durante la verificación de modo enriquecido
en `hermes-startup-next` (`R4_startup_sin_fundador` sobre "Virtual Atelier
AI"): antes de asumir que era un caso aislado, se auditó directo contra la
Neon compartida si el 500 de `/individuals` (ver sección de abajo) podía
haber estado bloqueando también escrituras de relaciones (`/facts`) en
otras startups reales.

**Resultado de la auditoría** (`SELECT count(*) FROM startup_facts` +
cruce contra `startup_individuals` para las 11 startups reales): **la
tabla `startup_facts` tiene 0 filas, para las 11 startups, siempre** — no
solo para la de prueba de hoy. 6 de las 11 tienen individuals reales
(entre 5 y 9 cada una), así que hay hechos suficientes para que las
reglas dependientes de relaciones (`R1_hipotesis_sin_experimento`,
`R2_pivote_sin_aprendizaje`, `R4_startup_sin_fundador`) tengan algo que
evaluar — y ninguna tiene una sola relación registrada.

**Causa real, confirmada por grep, no por el bug de hoy**: `startup-advisor`
(`src/lib/ontologyEngine.ts`, el único cliente real de este servicio) solo
implementa `createIndividual()` — **no existe ningún `createFact()` ni
ninguna llamada a `POST /startups/{id}/facts` en ningún lugar del código**.
`startup-next` tampoco escribe nunca a `ontology-engine` (confirmado por
grep en su propio `src/lib/ontologyEngine.ts`: solo hace `GET`). El fix
del 500 de hoy **no es la causa** de esta ausencia de datos — el
endpoint `/facts` existe en este servicio (scaffold de Fase 2) pero nunca
tuvo un caller real. Consecuencia distinta y más benigna de lo que
parecía al principio: no hay evidencia de que el bug haya causado pérdida
silenciosa de datos ya escritos.

**Efecto real en producción, no solo teórico**: toda regla que dependa de
relaciones (R1, R2, R4) se dispara **siempre** para cualquier startup real
con individuals, sin importar si el fundador de verdad hizo o no esos
pasos — porque la relación nunca pudo registrarse, para ninguna startup,
nunca. Esto afecta a `hallazgos_ontologia` en modo enriquecido para
usuarios reales de `startup-next` hoy mismo, no es hipotético.

**No se corrige en esta sesión** — implementar `createFact()` del lado de
`startup-advisor` (y decidir en qué punto del flujo de entrevista/informe
llamarlo) es una pieza de producto nueva, no un fix de bug, y excede el
alcance de "cerrar el camino PDF firmado / modo enriquecido". Queda
anotado como pendiente real para decidir en una sesión futura si vale la
pena implementarlo, o si el motor de reglas debería tratar "sin datos de
relación" distinto de "relación ausente confirmada".

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
