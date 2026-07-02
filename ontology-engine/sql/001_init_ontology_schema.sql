-- =====================================================================
-- Migración: esquema de la ontología Lean Startup (TBox + ABox)
-- =====================================================================
-- TBox = esquema de la ontología (conceptos y relaciones). Cambia poco:
--   se puebla con el seed script, no se escribe desde la app.
-- ABox = hechos concretos de cada startup (instancias y sus relaciones).
--   se escribe en tiempo real durante la entrevista/informe/multiagente.
--
-- Ejecutar una sola vez por entorno (dev, luego producción). Idempotente
-- gracias a "IF NOT EXISTS" — puedes re-ejecutar sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TBox: conceptos (clases de la ontología)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ontology_concepts (
    id          TEXT PRIMARY KEY,           -- ej. 'Hypothesis', 'ValueHypothesis'
    label       TEXT NOT NULL,
    definition  TEXT NOT NULL,
    source      TEXT NOT NULL,               -- 'Osterwalder' | 'Blank' | 'Ries' | 'Blank/Ries'
    parent_id   TEXT REFERENCES ontology_concepts(id),
    examples    JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ontology_concepts_parent ON ontology_concepts(parent_id);
CREATE INDEX IF NOT EXISTS idx_ontology_concepts_source ON ontology_concepts(source);

-- ---------------------------------------------------------------------
-- TBox: relaciones (tipos de vínculo entre conceptos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ontology_relations (
    id                  TEXT PRIMARY KEY,   -- ej. 'se_testea_con'
    label               TEXT NOT NULL,
    domain_concept_id   TEXT NOT NULL REFERENCES ontology_concepts(id),
    range_concept_id    TEXT NOT NULL REFERENCES ontology_concepts(id),
    definition          TEXT NOT NULL,
    cardinality         TEXT NOT NULL        -- '1:1' | '1:N' | 'N:M'
);

CREATE INDEX IF NOT EXISTS idx_ontology_relations_domain ON ontology_relations(domain_concept_id);
CREATE INDEX IF NOT EXISTS idx_ontology_relations_range  ON ontology_relations(range_concept_id);

-- ---------------------------------------------------------------------
-- ABox: individuos (instancias concretas, una por startup)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startup_individuals (
    startup_id   UUID NOT NULL,
    id           TEXT NOT NULL,              -- ej. 'hyp_valor_1' (único DENTRO de la startup)
    concept_id   TEXT NOT NULL REFERENCES ontology_concepts(id),
    label        TEXT NOT NULL,
    attributes   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (startup_id, id)
);

CREATE INDEX IF NOT EXISTS idx_startup_individuals_concept ON startup_individuals(concept_id);
CREATE INDEX IF NOT EXISTS idx_startup_individuals_startup ON startup_individuals(startup_id);

-- ---------------------------------------------------------------------
-- ABox: hechos (aristas entre individuos de una misma startup)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startup_facts (
    id          BIGSERIAL PRIMARY KEY,
    startup_id  UUID NOT NULL,
    source_id   TEXT NOT NULL,
    relation    TEXT NOT NULL,               -- normalmente coincide con ontology_relations.id
    target_id   TEXT NOT NULL,
    attributes  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (startup_id, source_id) REFERENCES startup_individuals(startup_id, id),
    FOREIGN KEY (startup_id, target_id) REFERENCES startup_individuals(startup_id, id)
);

CREATE INDEX IF NOT EXISTS idx_startup_facts_startup  ON startup_facts(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_facts_source   ON startup_facts(startup_id, source_id);
CREATE INDEX IF NOT EXISTS idx_startup_facts_target   ON startup_facts(startup_id, target_id);
CREATE INDEX IF NOT EXISTS idx_startup_facts_relation ON startup_facts(relation);

-- ---------------------------------------------------------------------
-- Nota: startup_id es UUID pero NO se declara FK aquí hacia tu tabla
-- `startups` (de la Fase 0/app principal) a propósito: el ontology-engine
-- no debe depender del esquema de la app. Si quieres integridad referencial
-- fuerte, añade la FK tú mismo desde una migración de tu app Next.js:
--
--   ALTER TABLE startup_individuals
--     ADD CONSTRAINT fk_startup_individuals_startup
--     FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;
--
--   (mismo patrón para startup_facts)
-- ---------------------------------------------------------------------
