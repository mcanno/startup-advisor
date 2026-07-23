"""
tests/test_parity.py

ontology-engine es TBox puro (sin ABox de ninguna startup real, ver
diseno_ontology_engine_solo_consulta.md en startup-next) — estos tests
cubren solo el esquema (conceptos, relaciones, subclases, prerrequisitos),
sin Postgres real, construyendo el grafo a partir de domain_ontology.py
(la misma fuente de verdad que usa `seed.py`), para validar que la LÓGICA
de graph.py coincide exactamente con lo que vimos en el notebook. Esto es
lo que se ejecuta en CI sin dependencias externas.

`test_seed_and_verify_against_live_db` (marcado `skip` por defecto): test
de integración real contra Postgres. Actívalo definiendo DATABASE_URL_TEST
y quitando el @pytest.mark.skip, para correrlo una vez en tu entorno de
dev tras crear una base de datos de pruebas.

Ejecutar con: pytest tests/test_parity.py -v
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from domain_ontology import CONCEPTS, RELATIONS
from graph import OntologyGraph


def _build_tbox_graph_from_domain() -> OntologyGraph:
    """Simula load_tbox() pero sin tocar Postgres: convierte los dataclasses
    de domain_ontology.py al mismo formato de 'filas' que llegarían desde
    la BD, y las pasa por los mismos métodos que usa graph.py en producción."""
    concept_rows = [
        {"id": c.id, "label": c.label, "definition": c.definition,
         "source": c.source, "parent_id": c.parent}
        for c in CONCEPTS
    ]
    relation_rows = [
        {"id": r.id, "label": r.label, "domain_concept_id": r.domain,
         "range_concept_id": r.range, "definition": r.definition,
         "cardinality": r.cardinality.value, "is_sequential": r.is_sequential}
        for r in RELATIONS
    ]
    og = OntologyGraph()
    og.load_concepts_from_rows(concept_rows)
    og.load_relations_from_rows(relation_rows)
    return og


@pytest.fixture
def tbox():
    return _build_tbox_graph_from_domain()


def test_concept_count_matches_notebook(tbox):
    assert len(tbox.concepts()) == 43


def test_pivot_subclasses_match_ries(tbox):
    subclasses = set(tbox.subclasses_of("Pivot"))
    expected = {
        "ZoomInPivot", "ZoomOutPivot", "CustomerSegmentPivot", "CustomerNeedPivot",
        "PlatformPivot", "BusinessArchitecturePivot", "ValueCapturePivot",
        "EngineOfGrowthPivot", "ChannelPivot", "TechnologyPivot",
    }
    assert subclasses == expected


def test_hypothesis_subclasses_match_notebook(tbox):
    assert set(tbox.subclasses_of("Hypothesis")) == {
        "ProblemHypothesis", "ValueHypothesis", "GrowthHypothesis",
    }


def test_describe_includes_source(tbox):
    desc = tbox.describe("Hypothesis")
    assert "Blank/Ries" in desc


def test_precedents_of_mvp_follows_implicit_chain(tbox):
    """Caso que precede_a literal NO puede responder (no toca MVP en
    absoluto) — confirma que precedents_of() sigue la cadena implícita
    Hypothesis -> Experiment -> MVP vía se_testea_con/produce, no solo
    la relación llamada 'precede_a'."""
    prereqs = tbox.precedents_of("MVP")
    by_id = {p["concept_id"]: p for p in prereqs}
    assert set(by_id) == {"Hypothesis", "Experiment"}
    assert by_id["Experiment"] == {"concept_id": "Experiment", "relacion": "produce", "distancia": 1}
    assert by_id["Hypothesis"] == {"concept_id": "Hypothesis", "relacion": "se_testea_con", "distancia": 2}


def test_precedents_of_concept_without_predecessors_is_empty(tbox):
    # Founder no tiene ninguna arista is_sequential entrante.
    assert tbox.precedents_of("Founder") == []


def test_precedents_of_unknown_concept_is_empty_not_error(tbox):
    assert tbox.precedents_of("NoExiste") == []


# ---------------------------------------------------------------------
# Test de integración real (opt-in) contra una Postgres de verdad.
# ---------------------------------------------------------------------
@pytest.mark.skip(reason="Requiere DATABASE_URL_TEST apuntando a una Postgres de pruebas ya migrada")
def test_seed_and_verify_against_live_db():
    import psycopg
    from seed import seed, verify

    database_url = os.environ["DATABASE_URL_TEST"]
    seed(database_url)
    verify(database_url)  # lanza AssertionError si no coincide con domain_ontology.py

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM ontology_concepts WHERE source = 'Osterwalder';")
            assert cur.fetchone()[0] == 9  # los 9 bloques del canvas
