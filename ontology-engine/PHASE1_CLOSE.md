# Cierre de Fase 1 — Ontología en producción

Este documento es la guía operativa para pasar de "código escrito" a
"Fase 1 cerrada" según la Definition of Done acordada. Sigue los pasos
en orden; cada uno depende del anterior.

## 0. Dónde encaja esto en tu repo

Tu app principal (Fase 0, ya cerrada) vive en Next.js/Vercel/Postgres.
Este microservicio (`ontology-engine/`) es **un servicio Python
independiente**, con su propio despliegue, que comparte la misma base de
datos Postgres pero solo él escribe/lee las tablas de la ontología.

Estructura recomendada dentro de tu repo (monorepo simple):

```
tu-repo/
├── app/                    # tu Next.js actual (Fase 0)
├── ontology-engine/        # todo lo generado en esta sesión
│   ├── sql/001_init_ontology_schema.sql
│   ├── domain_ontology.py
│   ├── graph.py
│   ├── rules.py
│   ├── main.py
│   ├── seed.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── Dockerfile
│   └── tests/test_parity.py
```

## 1. Migrar el esquema

Ejecuta el SQL directamente contra tu Postgres (el mismo que ya usa la
app de Fase 0):

```bash
psql "$DATABASE_URL" -f ontology-engine/sql/001_init_ontology_schema.sql
```

Es idempotente (`CREATE TABLE IF NOT EXISTS`), así que puedes correrlo
en dev y luego, sin cambios, en producción.

**Opcional pero recomendado**: añade la FK hacia tu tabla `startups` de
la app de Fase 0 (el motivo de no incluirla por defecto está documentado
al final del propio `.sql`):

```sql
ALTER TABLE startup_individuals
  ADD CONSTRAINT fk_startup_individuals_startup
  FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;

ALTER TABLE startup_facts
  ADD CONSTRAINT fk_startup_facts_startup
  FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;
```

## 2. Instalar dependencias y poblar el TBox

```bash
cd ontology-engine
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

export DATABASE_URL="postgresql://..."   # el mismo que usa Next.js
python3 seed.py
```

Deberías ver:
```
[seed] 43 conceptos insertados/actualizados
[seed] 21 relaciones insertadas/actualizadas
[verify] OK — 43 conceptos y 21 relaciones coinciden con el código fuente
```

Si más adelante amplías `domain_ontology.py` (nuevos conceptos), vuelve a
correr `python3 seed.py` — hace UPSERT, no duplica nada.

## 3. Correr los tests de paridad

```bash
pytest tests/test_parity.py -v
```

Deben pasar 6 tests sin tocar Postgres (usan filas simuladas, no BD real).
Ya los validé manualmente en este mismo hilo — la lógica es correcta;
esto confirma que también lo es en tu entorno con las dependencias reales
instaladas.

Si quieres además el test de integración contra una Postgres real de
pruebas: define `DATABASE_URL_TEST`, quita el `@pytest.mark.skip` de
`test_seed_and_verify_against_live_db` en `tests/test_parity.py`, y
vuelve a correr `pytest`.

## 4. Levantar el servicio localmente y probarlo

```bash
uvicorn main:app --reload --port 8000
```

Prueba rápida:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/concepts/Hypothesis
curl http://localhost:8000/concepts/Pivot/subclasses
```

## 5. Desplegar el microservicio

Vercel no ejecuta procesos Python de larga duración con estado en
memoria (el TBox cacheado). Usa el `Dockerfile` incluido en cualquiera de
estas opciones, todas con plan gratuito/barato para este volumen:
- **Railway** o **Render**: conectan directo a un `Dockerfile` en el repo.
- **Fly.io**: `fly launch` detecta el Dockerfile automáticamente.

Configura ahí la variable `DATABASE_URL` (misma Postgres). El resultado
es una URL pública tipo `https://ontology-engine.up.railway.app`.

## 6. Conectar (solo lectura, todavía) desde Next.js

En tu app de Fase 0, añade la variable de entorno:
```
ONTOLOGY_ENGINE_URL=https://ontology-engine.up.railway.app
```

Y un cliente mínimo, por ejemplo en `app/lib/ontologyEngine.ts`:

```ts
const BASE_URL = process.env.ONTOLOGY_ENGINE_URL!;

export async function describeConcept(conceptId: string) {
  const res = await fetch(`${BASE_URL}/concepts/${conceptId}`);
  if (!res.ok) throw new Error(`ontology-engine: ${res.status}`);
  return res.json();
}

export async function validateStartup(startupId: string) {
  const res = await fetch(`${BASE_URL}/startups/${startupId}/validate`);
  if (!res.ok) throw new Error(`ontology-engine: ${res.status}`);
  return res.json();
}
```

**Importante**: en Fase 1 solo necesitas probar que esto responde
correctamente (ej. una página de diagnóstico interna que llame a
`/health` y a `/concepts`). Conectar `validateStartup` al flujo real de
entrevista/informe es Fase 2 — no lo hagas todavía, aunque el endpoint ya
esté listo para cuando llegue el momento.

## Checklist final de cierre

- [ ] `001_init_ontology_schema.sql` ejecutado en dev y en producción.
- [ ] `seed.py` corrido con éxito en ambos entornos (verify pasa).
- [ ] `pytest tests/test_parity.py -v` en verde.
- [ ] Microservicio desplegado con URL pública accesible.
- [ ] `/health` responde `200` desde tu Next.js en producción (prueba manual o página de diagnóstico).
- [ ] PR mergeada en tu repo con: migración + seed + `ontology-engine/` completo + `ontologyEngine.ts` (solo lectura).

Cuando marques las 6 casillas, Fase 1 está cerrada y puedes pasar a
Fase 2 (entrevista y primer informe guiados por la ontología) con la
tranquilidad de que el motor ya está probado de forma aislada.
