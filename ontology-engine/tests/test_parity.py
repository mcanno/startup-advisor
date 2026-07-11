"""
tests/test_parity.py

Dos niveles de test:

1. `test_graph_logic_parity_*`: no requiere Postgres. Construye el grafo
   pasando filas ya materializadas (simulando lo que devolvería un
   cursor de psycopg), para validar que la LÓGICA de graph.py/rules.py
   coincide exactamente con lo que vimos en el notebook. Esto es lo que
   se ejecuta en CI sin dependencias externas.

2. `test_seed_and_verify_against_live_db` (marcado `skip` por defecto):
   test de integración real contra Postgres. Actívalo definiendo
   DATABASE_URL_TEST y quitando el @pytest.mark.skip, para correrlo una
   vez en tu entorno de dev tras crear una base de datos de pruebas.

Ejecutar con: pytest tests/test_parity.py -v
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from domain_ontology import CONCEPTS, RELATIONS
from graph import OntologyGraph
from rules import validate as run_validate


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


def test_validate_rules_detect_hypothesis_without_experiment(tbox):
    """Reproduce el caso forzado en el notebook (sección 10): una hipótesis
    sin experimento debe disparar R1."""
    og = OntologyGraph()
    og.g = tbox.g.copy()
    og.load_individuals_from_rows([
        {"id": "hyp_2", "concept_id": "ProblemHypothesis",
         "label": "Los usuarios no confían en subir documentos legales a la nube",
         "attributes": {}},
    ])

    report = run_validate(og)
    assert report["R1_hipotesis_sin_experimento"]["hallazgos"], (
        "Se esperaba que R1 detectara la hipótesis sin experimento")
    assert "hyp_2" in report["R1_hipotesis_sin_experimento"]["hallazgos"][0]


def test_validate_nubedoc_case_is_clean(tbox):
    """Reproduce el caso NubeDoc completo del notebook (sección 6): con
    todo el ciclo Construir-Medir-Aprender completo, no debe haber
    hallazgos en ninguna regla."""
    og = OntologyGraph()
    og.g = tbox.g.copy()

    og.load_individuals_from_rows([
        {"id": "nubedoc", "concept_id": "Startup", "label": "NubeDoc", "attributes": {}},
        {"id": "ana_fundadora", "concept_id": "Founder", "label": "Ana Pérez", "attributes": {}},
        {"id": "hyp_valor_1", "concept_id": "ValueHypothesis",
         "label": "Las pymes pagarán por firmar documentos legalmente desde el móvil", "attributes": {}},
        {"id": "exp_1", "concept_id": "Experiment", "label": "Landing page + smoke test", "attributes": {}},
        {"id": "mvp_1", "concept_id": "MVP", "label": "Landing page con demo", "attributes": {}},
        {"id": "metric_1", "concept_id": "ActionableMetric",
         "label": "Tasa de conversión de visitante a pre-registro", "attributes": {}},
        {"id": "learning_1", "concept_id": "ValidatedLearning",
         "label": "La propuesta de valor de firma legal no genera suficiente interés", "attributes": {}},
        {"id": "pivot_1", "concept_id": "CustomerNeedPivot",
         "label": "Pivotar a organización automática de documentos con IA", "attributes": {}},
    ])
    og.load_facts_from_rows([
        {"source_id": "nubedoc", "relation": "tiene_fundador", "target_id": "ana_fundadora", "attributes": {}},
        {"source_id": "ana_fundadora", "relation": "formula_hipotesis", "target_id": "hyp_valor_1", "attributes": {}},
        {"source_id": "hyp_valor_1", "relation": "se_testea_con", "target_id": "exp_1", "attributes": {}},
        {"source_id": "exp_1", "relation": "produce", "target_id": "mvp_1", "attributes": {}},
        {"source_id": "mvp_1", "relation": "se_mide_con", "target_id": "metric_1", "attributes": {}},
        {"source_id": "metric_1", "relation": "genera_aprendizaje", "target_id": "learning_1", "attributes": {}},
        {"source_id": "learning_1", "relation": "informa_decision_pivot", "target_id": "pivot_1", "attributes": {}},
    ])

    report = run_validate(og)
    for rule_id, r in report.items():
        assert not r["hallazgos"], f"Se esperaba {rule_id} limpio, pero hay hallazgos: {r['hallazgos']}"


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
