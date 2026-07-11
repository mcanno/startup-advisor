-- =====================================================================
-- Migración: is_sequential en ontology_relations
-- =====================================================================
-- Formaliza en el TBox qué relaciones ya se trataban como precedencia
-- sobre hechos reales en rules.py (R1/R2) — habilita precedents_of()
-- en graph.py sin tener que adivinar qué aristas seguir. Repoblar con
-- seed.py después de aplicar esta migración.
-- =====================================================================

ALTER TABLE ontology_relations
    ADD COLUMN IF NOT EXISTS is_sequential BOOLEAN NOT NULL DEFAULT false;
