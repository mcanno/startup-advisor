-- =====================================================================
-- Migración: elimina el ABox por completo (ontology-engine pasa a ser
-- un servicio puramente de consulta, TBox only)
-- =====================================================================
-- ontology-engine ya no persiste ni expone hechos de ninguna startup
-- real (ver diseno_ontology_engine_solo_consulta.md en startup-next).
-- Las dos tablas de ABox ya estaban vacías (0 filas) al momento de esta
-- migración -- el borrado de datos se ejecutó y verificó por separado
-- (ver ontology-engine/HANDOFF.md, sección "Borrado completo del ABox
-- (2026-07-23)"). Esta migración elimina el esquema en sí, no datos.
--
-- startup_facts depende de startup_individuals (FK compuesta), así que
-- se dropea primero. La FK fk_startup_individuals_startup (hacia
-- startups.id, aplicada directo en producción, nunca en un .sql
-- trackeado -- ver HANDOFF.md, "Hallazgo secundario") se elimina
-- implícitamente al dropear startup_individuals.
--
-- No reversible sin recrear el esquema de 001_init_ontology_schema.sql
-- (sin datos -- ya no quedan de todos modos).
-- =====================================================================

DROP TABLE IF EXISTS startup_facts;
DROP TABLE IF EXISTS startup_individuals;
