"""
seed.py — puebla ontology_concepts / ontology_relations en Postgres desde
domain_ontology.py (única fuente de verdad del TBox).

Uso:
    export DATABASE_URL="postgresql://user:pass@host:port/dbname"
    python3 seed.py

Es idempotente: usa UPSERT (ON CONFLICT DO UPDATE), así que puedes
re-ejecutarlo cada vez que edites domain_ontology.py sin duplicar filas
ni tener que hacer DROP/CREATE manual.
"""

import os
import sys

import psycopg

from domain_ontology import CONCEPTS, RELATIONS


UPSERT_CONCEPT = """
    INSERT INTO ontology_concepts (id, label, definition, source, parent_id, examples)
    VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        definition = EXCLUDED.definition,
        source = EXCLUDED.source,
        parent_id = EXCLUDED.parent_id,
        examples = EXCLUDED.examples;
"""

UPSERT_RELATION = """
    INSERT INTO ontology_relations (id, label, domain_concept_id, range_concept_id, definition, cardinality)
    VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        domain_concept_id = EXCLUDED.domain_concept_id,
        range_concept_id = EXCLUDED.range_concept_id,
        definition = EXCLUDED.definition,
        cardinality = EXCLUDED.cardinality;
"""


def seed(database_url: str) -> None:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # 1) Conceptos SIN parent primero, para no violar la FK auto-referenciada
            no_parent = [c for c in CONCEPTS if c.parent is None]
            with_parent = [c for c in CONCEPTS if c.parent is not None]

            import json
            for c in no_parent + with_parent:
                cur.execute(UPSERT_CONCEPT, (
                    c.id, c.label, c.definition, c.source, c.parent,
                    json.dumps(c.examples),
                ))
            print(f"[seed] {len(CONCEPTS)} conceptos insertados/actualizados")

            # 2) Relaciones (ya pueden referenciar cualquier concepto)
            for r in RELATIONS:
                cur.execute(UPSERT_RELATION, (
                    r.id, r.label, r.domain, r.range, r.definition, r.cardinality.value,
                ))
            print(f"[seed] {len(RELATIONS)} relaciones insertadas/actualizadas")

        conn.commit()


def verify(database_url: str) -> None:
    """Comprobación de paridad: lo que hay en Postgres debe coincidir en
    número con domain_ontology.py. Falla ruidosamente si no."""
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM ontology_concepts;")
            n_concepts = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM ontology_relations;")
            n_relations = cur.fetchone()[0]

    assert n_concepts == len(CONCEPTS), (
        f"Discrepancia: {n_concepts} conceptos en BD vs {len(CONCEPTS)} en domain_ontology.py")
    assert n_relations == len(RELATIONS), (
        f"Discrepancia: {n_relations} relaciones en BD vs {len(RELATIONS)} en domain_ontology.py")
    print(f"[verify] OK — {n_concepts} conceptos y {n_relations} relaciones coinciden con el código fuente")


if __name__ == "__main__":
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: define DATABASE_URL antes de ejecutar seed.py", file=sys.stderr)
        sys.exit(1)

    seed(database_url)
    verify(database_url)
